"""Comprueba permisos, confirmación explícita, aislamiento e idempotencia sin servicios reales."""
from datetime import datetime, timedelta, timezone
import os
import unittest
from unittest.mock import patch

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, func
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.compiler import compiles


@compiles(UUID, "sqlite")
def compile_test_uuid(element, compiler, **kwargs):
    """Representa UUID de PostgreSQL en la base SQLite aislada de las pruebas."""
    return "CHAR(32)"

with patch.dict(os.environ, {"DEBUG": "false", "DATABASE_URL": "sqlite://"}):
    import auth
    import models
    from services import agent_actions as actions
    from routes import agent_actions, personas, proyectos, oportunidades


class ActionTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        for table in [models.Persona.__table__, models.Proyecto.__table__, models.HitoLog.__table__, models.Oportunidad.__table__, actions.AgentAction.__table__]:
            table.create(self.engine)
        self.db = Session(self.engine)
        self.user = {"auth_user_id": "owner", "rol": "editor"}
        self.session = "browser-session"

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def proposal(self, **changes):
        value = {"operation": "crear_persona", "payload": {"id": "emp-test", "nombre": "Prueba", "rol": "Designer", "numero_empleado": "test"}}
        value.update(changes)
        with patch.object(actions, "SessionLocal", lambda: Session(self.engine)):
            return actions.prepare_action(value, self.user, actions.scoped_session("owner", self.session))

    def test_proposal_does_not_create_persona(self):
        event = self.proposal()
        self.assertEqual(event["type"], "action")
        self.assertEqual(self.db.scalar(select(func.count()).select_from(models.Persona)), 0)

    def test_confirm_once_and_retry_returns_same_result(self):
        action_id = self.proposal()["action"]["id"]
        first = actions.resolve_action(self.db, action_id, self.user, self.session, True)
        second = actions.resolve_action(self.db, action_id, self.user, self.session, True)
        self.assertEqual(first, second)
        self.assertEqual(self.db.scalar(select(func.count()).select_from(models.Persona)), 1)

    def test_other_user_session_and_reader_are_rejected(self):
        action_id = self.proposal()["action"]["id"]
        for user, session in [({"auth_user_id": "other", "rol": "editor"}, self.session), (self.user, "other-session"), ({**self.user, "rol": "viewer"}, self.session)]:
            with self.assertRaises(HTTPException):
                actions.resolve_action(self.db, action_id, user, session, True)
            self.db.rollback()
        self.assertEqual(self.db.scalar(select(func.count()).select_from(models.Persona)), 0)

    def test_expired_proposal_cannot_execute(self):
        action_id = self.proposal()["action"]["id"]
        action = self.db.get(actions.AgentAction, action_id)
        action.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        self.db.commit()
        with self.assertRaises(HTTPException) as raised:
            actions.resolve_action(self.db, action_id, self.user, self.session, True)
        self.assertEqual(raised.exception.status_code, 410)

    def test_cancelled_proposal_cannot_execute(self):
        action_id = self.proposal()["action"]["id"]
        actions.resolve_action(self.db, action_id, self.user, self.session, False)
        with self.assertRaises(HTTPException):
            actions.resolve_action(self.db, action_id, self.user, self.session, True)

    def test_duplicate_record_rolls_back_action(self):
        self.db.add(models.Persona(id="emp-test", nombre="Original", rol="Designer", numero_empleado="test"))
        self.db.commit()
        action_id = self.proposal()["action"]["id"]
        with self.assertRaises(HTTPException) as raised:
            actions.resolve_action(self.db, action_id, self.user, self.session, True)
        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(self.db.get(actions.AgentAction, action_id).status, "pending")
        self.assertEqual(self.db.get(models.Persona, "emp-test").nombre, "Original")

    def test_project_update_preserves_milestone_log(self):
        self.db.add(models.Proyecto(id="project", nombre="Proyecto", cliente="Cliente"))
        self.db.commit()
        action_id = self.proposal(operation="actualizar_proyecto", target_id="project", payload={"next_milestone": "Entrega"})["action"]["id"]
        actions.resolve_action(self.db, action_id, self.user, self.session, True)
        self.assertEqual(self.db.get(models.Proyecto, "project").next_milestone, "Entrega")
        self.assertEqual(self.db.scalar(select(func.count()).select_from(models.HitoLog)), 1)

    def test_reader_cannot_prepare_action(self):
        self.user["rol"] = "viewer"
        self.assertEqual(self.proposal()["type"], "delta")
        self.assertEqual(self.db.scalar(select(func.count()).select_from(actions.AgentAction)), 0)

    def test_unknown_fields_and_operations_are_rejected(self):
        self.assertEqual(self.proposal(operation="delete_all")["type"], "delta")
        self.assertEqual(self.proposal(payload={"id": "x", "nombre": "X", "rol": "X", "admin": True})["type"], "delta")


class RoutePermissionTests(unittest.TestCase):
    def test_api_key_alone_does_not_authorize_writes(self):
        app = FastAPI()
        for router in [personas.router, proyectos.router, oportunidades.router, agent_actions.router]:
            app.include_router(router)
        with patch.object(auth.settings, "SUPABASE_URL", "https://auth.invalid"), patch.object(auth.settings, "SUPABASE_SECRET_KEY", "test"):
            with TestClient(app) as client:
                for url in ["/personas/agent-create", "/proyectos/", "/oportunidades/", "/ai/actions/fake/decision"]:
                    response = client.post(url, json={}, headers={"X-API-Key": "public-key"})
                    self.assertEqual(response.status_code, 401, url)

    def test_reader_cannot_write_even_with_valid_identity(self):
        app = FastAPI()
        app.include_router(personas.router)
        app.dependency_overrides[auth.require_authorized_user] = lambda: {"rol": "viewer", "auth_user_id": "reader"}
        with TestClient(app) as client:
            response = client.post("/personas/agent-create", json={})
        self.assertEqual(response.status_code, 403)
