"""Completa el primer ingreso verificando la contraseña temporal y reemplazándola sin enviar correo."""
import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, SecretStr
from sqlalchemy import text
from sqlalchemy.orm import Session

from auth import require_supabase_identity
from config import settings
from database import get_db

router = APIRouter(prefix="/usuarios", tags=["usuarios"])


class PasswordInicial(BaseModel):
    password_actual: SecretStr = Field(min_length=1, max_length=128)
    password_nueva: SecretStr = Field(min_length=8, max_length=128)


def _auth_request(path: str, payload: dict, method="POST"):
    """Mantiene las claves y contraseñas fuera de respuestas y registros de error."""
    request = Request(
        f"{settings.SUPABASE_URL.rstrip('/')}{path}",
        data=json.dumps(payload).encode("utf-8"),
        method=method,
        headers={
            "apikey": settings.SUPABASE_SECRET_KEY,
            "Authorization": f"Bearer {settings.SUPABASE_SECRET_KEY}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urlopen(request, timeout=15) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        if exc.code == 429:
            raise HTTPException(429, "Demasiados intentos. Espera un momento y vuelve a intentar.") from None
        raise HTTPException(400, "No fue posible cambiar la contraseña. Revisa la contraseña temporal y los requisitos de la nueva.") from None
    except (URLError, TimeoutError):
        raise HTTPException(503, "No fue posible contactar a Supabase Auth") from None
    except (ValueError, UnicodeDecodeError):
        raise HTTPException(502, "Respuesta inválida de Supabase Auth") from None


@router.post("/password-inicial")
def cambiar_password_inicial(
    payload: PasswordInicial,
    user: dict = Depends(require_supabase_identity),
    db: Session = Depends(get_db),
):
    """Solo permite cambiar la clave de la propia cuenta activa pendiente de primer ingreso."""
    if not user.get("app_metadata", {}).get("must_change_password"):
        raise HTTPException(409, "Esta cuenta no tiene un cambio inicial pendiente")
    autorizado = db.execute(text(
        "SELECT id FROM public.usuarios_autorizados "
        "WHERE auth_user_id = :user_id AND activo = true LIMIT 1"
    ), {"user_id": user["id"]}).first()
    if not autorizado:
        raise HTTPException(403, "Usuario no autorizado o inactivo")

    actual = payload.password_actual.get_secret_value()
    nueva = payload.password_nueva.get_secret_value()
    if actual == nueva:
        raise HTTPException(400, "La nueva contraseña debe ser diferente de la temporal")

    # Reautentica antes de usar la API administrativa: conocer un token no basta.
    verified = _auth_request("/auth/v1/token?grant_type=password", {
        "email": user["email"], "password": actual,
    })
    if verified.get("user", {}).get("id") != user["id"]:
        raise HTTPException(401, "No fue posible verificar tu identidad")

    # Actualiza contraseña y requisito en la misma operación de Supabase Auth.
    _auth_request(f"/auth/v1/admin/users/{user['id']}", {
        "password": nueva,
        "app_metadata": {**user.get("app_metadata", {}), "must_change_password": False},
    }, method="PUT")
    return {"status": "success"}
