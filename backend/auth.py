import secrets
from typing import Optional

from fastapi import Header, HTTPException

from config import settings


def _verify(provided: Optional[str], expected: str) -> None:
    if not expected:
        # Sin key configurada: acceso libre solo en desarrollo local. En
        # producción se cierra (fail-closed) para que un despliegue sin la
        # variable de entorno no deje la API abierta a internet.
        if settings.ENVIRONMENT == "production":
            raise HTTPException(status_code=503, detail="API key no configurada en el servidor")
        return
    if not provided or not secrets.compare_digest(provided, expected):
        raise HTTPException(status_code=401, detail="API key inválida o ausente")


def require_api_key(x_api_key: Optional[str] = Header(default=None)):
    """Protege los endpoints de datos. El frontend envía la key en `X-API-Key`."""
    _verify(x_api_key, settings.API_KEY)


def require_admin_key(x_api_key: Optional[str] = Header(default=None)):
    """Protege `/api/admin/*` con una key distinta que nunca viaja al frontend."""
    _verify(x_api_key, settings.ADMIN_API_KEY)
