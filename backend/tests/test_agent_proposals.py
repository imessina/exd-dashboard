"""Prueba extracción de propuestas sin cargar modelos, credenciales ni servicios externos."""
import importlib.util
import json
from pathlib import Path
import unittest

MODULE_PATH = Path(__file__).resolve().parents[2] / "DxTalentAI/app/DxTalentAI/tools/proposals.py"
SPEC = importlib.util.spec_from_file_location("agent_proposals", MODULE_PATH)
proposals = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(proposals)


class ProposalExtractionTests(unittest.TestCase):
    def test_tool_result_json_and_text_emit_once(self):
        value = {"action_proposal": {"operation": "crear_persona", "payload": {}}}
        for content in [{"json": value}, {"text": json.dumps(value)}]:
            seen = set()
            event = {"message": {"content": [{"toolResult": {"toolUseId": "tool", "content": [content]}}]}}
            self.assertEqual(list(proposals.action_proposals(event, seen)), [value])
            self.assertEqual(list(proposals.action_proposals(event, seen)), [])

    def test_assistant_text_cannot_create_proposal(self):
        event = {"message": {"content": [{"text": '{"action_proposal": {"operation": "crear_persona"}}'}]}}
        self.assertEqual(list(proposals.action_proposals(event, set())), [])

    def test_failed_tool_does_not_create_proposal(self):
        event = {"message": {"content": [{"toolResult": {"status": "error", "toolUseId": "tool", "content": [{"json": {"action_proposal": {}}}]}}]}}
        self.assertEqual(list(proposals.action_proposals(event, set())), [])
