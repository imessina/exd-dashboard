import json
import secrets
from typing import Optional

from fastapi import Depends, Header, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from config import settings
from database import get_db


bearer_scheme = HTTPBearer(auto_error=False)

def _verify(provided: Optional[str], expected: str) -> None:
    if not expected:
        # Sin key configurada: acceso libre solo en desarrollo local.
        # En producción se cierra (fail-closed).
        if settings.ENVIRONMENT == "production":
            raise HTTPException(
                status_code=503,
                detail="API key no configurada en el servidor",
            )
        return

    if not provided or not secrets.compare_digest(provided, expected):
        raise HTTPException(
            status_code=401,
            detail="API key inválida o ausente",
        )


def require_api_key(
    x_api_key: Optional[str] = Header(default=None),
):
    """
    Protege los endpoints de datos existentes.
    El frontend envía la key en X-API-Key.
    """
    _verify(x_api_key, settings.API_KEY)


def require_admin_key(
    x_api_key: Optional[str] = Header(default=None),
):
    """
    Protege /api/admin/* con una key privada
    que nunca debe viajar al frontend.
    """
    _verify(x_api_key, settings.ADMIN_API_KEY)


def require_supabase_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
):
    """
    Valida el access token de Supabase enviado como Bearer token.
    """

    if not settings.SUPABASE_URL or not settings.SUPABASE_SECRET_KEY:
        raise HTTPException(
            status_code=503,
            detail="Supabase Auth no está configurado en el servidor",
        )

    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Token de autenticación ausente",
        )

    access_token = credentials.credentials

    if not access_token:
        raise HTTPException(
            status_code=401,
            detail="Token de autenticación vacío",
        )

    request = Request(
        f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/user",
        method="GET",
        headers={
            "Authorization": f"Bearer {access_token}",
            "apikey": settings.SUPABASE_SECRET_KEY,
        },
    )

    try:
        with urlopen(request, timeout=10) as response:
            body = response.read().decode("utf-8")
            user = json.loads(body)

    except HTTPError as exc:
        if exc.code in (401, 403):
            raise HTTPException(
                status_code=401,
                detail="Sesión inválida o expirada",
            )

        raise HTTPException(
            status_code=502,
            detail="Error validando sesión con Supabase",
        )

    except (URLError, TimeoutError):
        raise HTTPException(
            status_code=503,
            detail="No fue posible contactar a Supabase Auth",
        )

    except json.JSONDecodeError:
        raise HTTPException(
            status_code=502,
            detail="Respuesta inválida de Supabase Auth",
        )

    if not user or not user.get("id"):
        raise HTTPException(
            status_code=401,
            detail="Usuario autenticado inválido",
        )

    return user


def require_superadmin(
    user: dict = Depends(require_supabase_user),
    db: Session = Depends(get_db),
):
    """
    Permite acceso únicamente a usuarios activos
    con rol superadmin.
    """

    result = db.execute(
        text("""
            SELECT
                id,
                auth_user_id,
                email,
                nombre,
                apellido,
                rol,
                activo
            FROM public.usuarios_autorizados
            WHERE auth_user_id = :auth_user_id
              AND rol = 'superadmin'
              AND activo = true
            LIMIT 1
        """),
        {
            "auth_user_id": user["id"],
        },
    ).mappings().first()

    if not result:
        raise HTTPException(
            status_code=403,
            detail="Acceso reservado a superadministradores",
        )

    return dict(result)


def require_authorized_user(
    user: dict = Depends(require_supabase_user),
    db: Session = Depends(get_db),
):
    result = db.execute(
        text(
            """
            SELECT
                id,
                auth_user_id,
                email,
                nombre,
                apellido,
                rol,
                activo
            FROM public.usuarios_autorizados
            WHERE auth_user_id = :auth_user_id
              AND activo = true
            LIMIT 1
            """
        ),
        {
            "auth_user_id": user["id"],
        },
    ).mappings().first()

    if not result:
        raise HTTPException(
            status_code=403,
            detail="Usuario no autorizado o inactivo",
        )

    return dict(result)


def require_editor_or_higher(
    usuario: dict = Depends(require_authorized_user),
):
    if usuario["rol"] not in {
        "superadmin",
        "admin",
        "editor",
    }:
        raise HTTPException(
            status_code=403,
            detail="No tienes permisos para realizar esta acción",
        )

    return usuario


def require_admin_or_higher(
    usuario: dict = Depends(require_authorized_user),
):
    if usuario["rol"] not in {
        "superadmin",
        "admin",
    }:
        raise HTTPException(
            status_code=403,
            detail="Acceso reservado a administradores",
        )

    return usuario

def require_authorized_user(
    user: dict = Depends(require_supabase_user),
    db: Session = Depends(get_db),
):
    result = db.execute(
        text(
            """
            SELECT
                id,
                auth_user_id,
                email,
                nombre,
                apellido,
                rol,
                activo
            FROM public.usuarios_autorizados
            WHERE auth_user_id = :auth_user_id
              AND activo = true
            LIMIT 1
            """
        ),
        {
            "auth_user_id": user["id"],
        },
    ).mappings().first()

    if not result:
        raise HTTPException(
            status_code=403,
            detail="Usuario no autorizado o inactivo",
        )

    return dict(result)


def require_editor_or_higher(
    usuario: dict = Depends(require_authorized_user),
):
    if usuario["rol"] not in {
        "superadmin",
        "admin",
        "editor",
    }:
        raise HTTPException(
            status_code=403,
            detail="No tienes permisos para realizar esta acción",
        )

    return usuario


def require_admin_or_higher(
    usuario: dict = Depends(require_authorized_user),
):
    if usuario["rol"] not in {
        "superadmin",
        "admin",
    }:
        raise HTTPException(
            status_code=403,
            detail="Acceso reservado a administradores",
        )

    return usuario