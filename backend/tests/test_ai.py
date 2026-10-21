"""Verifica autenticación y transmisión incremental del chat con servicios simulados."""
import json
import os
import unittest
from unittest.mock import Mock, patch

import httpx
from fastapi import FastAPI
from fastapi.testclient import TestClient

with patch.dict(os.environ, {"DEBUG": "false", "DATABASE_URL": "sqlite://"}):
    import auth
    from routes import ai


class ChatStreamingTests(unittest.IsolatedAsyncioTestCase):
    async def test_aws_proposal_is_bound_to_authenticated_user(self):
        proposal = {"operation": "crear_persona", "payload": {}}
        user = {"auth_user_id": "owner", "rol": "editor"}
        body = Mock()
        body.iter_lines.return_value = iter([("data: " + json.dumps({"action_proposal": proposal})).encode()])
        action_event = {"type": "action", "action": {"id": "saved"}}
        with patch.object(ai, "_invoke_agentcore_aws_sync", return_value=("text/event-stream", body)), patch.object(ai, "prepare_action", return_value=action_event) as prepare:
            events = [event async for event in ai._stream_agentcore_aws("consulta", "scope", user)]
        prepare.assert_called_once_with(proposal, user, "scope")
        self.assertIn('"type": "action"', events[0])
        self.assertIn('"type": "done"', events[-1])

    async def test_aws_delivers_first_fragment_before_reading_the_rest(self):
        received_first = False
        body = Mock()

        def lines(chunk_size):
            yield b'data: {"text":"Hola"}'
            self.assertTrue(received_first)
            yield b'data: {"text":" mundo"}'

        body.iter_lines.side_effect = lines
        with patch.object(ai, "_invoke_agentcore_aws_sync", return_value=("text/event-stream", body)):
            stream = ai._stream_agentcore_aws("consulta", "session")
            self.assertIn('"text": "Hola"', await anext(stream))
            received_first = True
            remaining = [event async for event in stream]

        self.assertIn('"text": " mundo"', remaining[0])
        self.assertIn('"type": "done"', remaining[-1])
        body.close.assert_called_once()

    async def test_aws_closes_body_when_consumer_stops(self):
        body = Mock()
        body.iter_lines.return_value = iter([b'data: {"text":"Hola"}'])
        with patch.object(ai, "_invoke_agentcore_aws_sync", return_value=("text/event-stream", body)):
            stream = ai._stream_agentcore_aws("consulta", "session")
            await anext(stream)
            await stream.aclose()
        body.close.assert_called_once()

    async def test_aws_failure_after_partial_text_emits_error_without_done(self):
        body = Mock()

        def lines(chunk_size):
            yield b'data: {"text":"Hola"}'
            raise OSError("stream interrupted")

        body.iter_lines.side_effect = lines
        with patch.object(ai, "_invoke_agentcore_aws_sync", return_value=("text/event-stream", body)):
            with self.assertLogs("uvicorn.error", level="ERROR"):
                events = [event async for event in ai._stream_agentcore_aws("consulta", "session")]
        self.assertIn('"type": "delta"', events[0])
        self.assertIn('"type": "error"', events[-1])
        self.assertFalse(any('"type": "done"' in event for event in events))
        body.close.assert_called_once()

    async def test_empty_aws_response_emits_error(self):
        with patch.object(ai, "_invoke_agentcore_aws_sync", return_value=("text/event-stream", None)):
            events = [event async for event in ai._stream_agentcore_aws("consulta", "session")]
        self.assertEqual(len(events), 1)
        self.assertIn('"type": "error"', events[0])

    async def test_local_forwards_session_header(self):
        def respond(request):
            self.assertEqual(request.headers["X-Amzn-Bedrock-AgentCore-Runtime-Session-Id"], "session-local")
            self.assertEqual(json.loads(request.content), {"prompt": "consulta"})
            return httpx.Response(200, headers={"content-type": "text/event-stream"}, content='data: {"text":"Hola"}\n\n')

        client = httpx.AsyncClient(transport=httpx.MockTransport(respond))
        with patch.object(ai.httpx, "AsyncClient", return_value=client):
            events = [event async for event in ai._stream_agentcore_local("consulta", "session-local")]
        self.assertIn('"type": "done"', events[-1])


class ChatAuthenticationTests(unittest.TestCase):
    def setUp(self):
        self.app = FastAPI()
        self.app.include_router(ai.router)
        self.client = TestClient(self.app)
        self.payload = {"message": "Hola", "session_id": "browser-session"}

    def test_missing_token_is_rejected(self):
        with patch.object(auth.settings, "SUPABASE_URL", "https://auth.invalid"):
            with patch.object(auth.settings, "SUPABASE_SECRET_KEY", "test"):
                response = self.client.post("/ai/chat", json=self.payload)
        self.assertEqual(response.status_code, 401)

    def test_inactive_user_is_rejected(self):
        database = Mock()
        database.execute.return_value.mappings.return_value.first.return_value = None
        self.app.dependency_overrides[auth.require_supabase_user] = lambda: {"id": "user"}
        self.app.dependency_overrides[auth.get_db] = lambda: database
        response = self.client.post("/ai/chat", json=self.payload)
        self.assertEqual(response.status_code, 403)

    def test_session_is_stable_for_user_and_isolated_between_users(self):
        sessions = []

        async def stream(message, session_id, user=None):
            sessions.append(session_id)
            yield ai._encode_sse({"type": "done"})

        with patch.object(ai, "_stream_agentcore", stream):
            for user_id in ["first-user", "first-user", "second-user"]:
                self.app.dependency_overrides[auth.require_authorized_user] = lambda: {"auth_user_id": user_id}
                response = self.client.post("/ai/chat", json=self.payload)
                self.assertEqual(response.status_code, 200)
        self.assertEqual(sessions[0], sessions[1])
        self.assertNotEqual(sessions[0], sessions[2])
        self.assertEqual(len(sessions[0]), 64)


if __name__ == "__main__":
    unittest.main()
