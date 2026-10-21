"""Prueba el alta sin correo y el cambio obligatorio usando Auth y base de datos simulados."""
import json
import os
import unittest
from unittest.mock import Mock, patch

from fastapi import HTTPException

with patch.dict(os.environ, {"DEBUG": "false", "DATABASE_URL": "sqlite://"}):
    from auth import require_supabase_user
    from routes import usuarios, passwords


class PasswordInicialTests(unittest.TestCase):
    def setUp(self):
        self.user = {"id": "test-user", "email": "user@example.com", "app_metadata": {"must_change_password": True, "provider": "email"}}
        self.db = Mock()
        self.db.execute.return_value.first.return_value = ("authorized",)
        self.payload = passwords.PasswordInicial(password_actual="Temporal123!", password_nueva="Personal456!")

    def test_pending_user_cannot_pass_normal_authorization(self):
        with self.assertRaises(HTTPException) as raised:
            require_supabase_user(self.user)
        self.assertEqual(raised.exception.status_code, 403)

    def test_existing_users_keep_access(self):
        user = {"id": "existing", "app_metadata": {}}
        self.assertEqual(require_supabase_user(user), user)

    def test_same_password_rejected_before_auth_request(self):
        payload = passwords.PasswordInicial(password_actual="Temporal123!", password_nueva="Temporal123!")
        with patch.object(passwords, "_auth_request") as request:
            with self.assertRaises(HTTPException):
                passwords.cambiar_password_inicial(payload, self.user, self.db)
            request.assert_not_called()

    def test_password_and_flag_updated_together_after_reauthentication(self):
        with patch.object(passwords, "_auth_request", side_effect=[{"user": {"id": "test-user"}}, {}]) as request:
            result = passwords.cambiar_password_inicial(self.payload, self.user, self.db)
        self.assertEqual(result, {"status": "success"})
        self.assertEqual(request.call_args_list[0].args[0], "/auth/v1/token?grant_type=password")
        updated = request.call_args_list[1].args[1]
        self.assertEqual(updated["password"], "Personal456!")
        self.assertFalse(updated["app_metadata"]["must_change_password"])
        self.assertEqual(updated["app_metadata"]["provider"], "email")

    def test_wrong_identity_does_not_clear_flag(self):
        with patch.object(passwords, "_auth_request", return_value={"user": {"id": "other"}}) as request:
            with self.assertRaises(HTTPException):
                passwords.cambiar_password_inicial(self.payload, self.user, self.db)
        self.assertEqual(request.call_count, 1)

    def test_inactive_user_cannot_change_password(self):
        self.db.execute.return_value.first.return_value = None
        with patch.object(passwords, "_auth_request") as request:
            with self.assertRaises(HTTPException):
                passwords.cambiar_password_inicial(self.payload, self.user, self.db)
        request.assert_not_called()

    def test_temporary_creation_uses_admin_endpoint_without_invitation(self):
        data = usuarios.UsuarioCreate(email="user@example.com", nombre="Test", apellido="User", rol="viewer", password_temporal="Temporal123!")
        self.db.execute.return_value.first.return_value = None
        self.db.execute.return_value.mappings.return_value.first.return_value = {"id": "authorized"}
        response = Mock()
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        response.read.return_value = b'{"id":"new-user"}'
        with patch.object(usuarios.settings, "SUPABASE_URL", "https://auth.invalid"):
            with patch.object(usuarios.settings, "SUPABASE_SECRET_KEY", "test"):
                with patch.object(usuarios, "urlopen", return_value=response) as request:
                    result = usuarios.crear_usuario(data, {"rol": "superadmin"}, self.db)
        outgoing = request.call_args.args[0]
        payload = json.loads(outgoing.data)
        self.assertTrue(outgoing.full_url.endswith("/auth/v1/admin/users"))
        self.assertTrue(payload["email_confirm"])
        self.assertTrue(payload["app_metadata"]["must_change_password"])
        self.assertNotIn("password", result)
        self.assertNotIn("Temporal123!", repr(data))
