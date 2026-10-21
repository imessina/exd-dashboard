import os
from typing import Optional

import httpx
from strands import tool


API_BASE_URL = os.getenv(
    "DX_API_BASE_URL",
    "http://localhost:8000/api",
).rstrip("/")

API_KEY = os.getenv("DX_API_KEY", "")


def _headers() -> dict[str, str]:
    headers = {"Accept": "application/json"}
    if API_KEY:
        headers["X-API-Key"] = API_KEY
    return headers


def _get(path: str, params: Optional[dict] = None):
    url = f"{API_BASE_URL}{path}"
    try:
        with httpx.Client(timeout=15.0) as client:
            response = client.get(url, headers=_headers(), params=params)
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        if status == 404:
            raise RuntimeError("El recurso solicitado no existe en el backend.") from exc
        raise RuntimeError(f"Error HTTP {status} consultando el backend DX.") from exc
    except httpx.RequestError as exc:
        raise RuntimeError(
            "No fue posible conectar con el backend DX. "
            "Verifica que FastAPI esté iniciado y que DX_API_BASE_URL sea correcta."
        ) from exc


def _clean_asignacion(a: dict) -> dict:
    """Expone solo los campos relevantes de una asignación."""
    return {
        "id": a.get("id"),
        "persona_id": a.get("persona_id"),
        "proyecto_id": a.get("proyecto_id"),
        "cliente": a.get("cliente"),
        "dedicacion": a.get("dedicacion"),
        "fecha_inicio": str(a.get("fecha_inicio") or ""),
        "fecha_liberacion": str(a.get("fecha_liberacion") or ""),
        "estado": a.get("estado"),
    }


@tool
def listar_asignaciones(
    estado: Optional[str] = None,
    persona_id: Optional[str] = None,
) -> dict:
    """
    Lista las asignaciones de personas a proyectos registradas en Dashboard DX.

    Permite filtrar por estado de la asignación ("active", "completed", "cancelled")
    y/o por el ID interno de una persona (ej. "emp-284356").

    Usa esta herramienta cuando el usuario quiera saber:
    - Quién está asignado actualmente a proyectos.
    - Qué asignaciones tiene una persona concreta.
    - Cuántas asignaciones activas hay.
    - A qué cliente o proyecto está asignada una persona.
    """
    params = {}
    if estado:
        params["estado"] = estado
    if persona_id:
        params["persona_id"] = persona_id

    asignaciones = _get("/asignaciones/", params=params)
    limpias = [_clean_asignacion(a) for a in asignaciones]

    return {
        "total": len(limpias),
        "asignaciones": limpias,
    }


@tool
def proximas_liberaciones(dias: int = 14) -> dict:
    """
    Devuelve las personas que finalizan su asignación activa en los próximos N días.

    El parámetro "dias" controla el horizonte de búsqueda (por defecto 14 días).

    Usa esta herramienta cuando el usuario quiera saber:
    - Quién se libera próximamente.
    - Qué personas estarán disponibles en las próximas dos semanas.
    - Disponibilidad futura del equipo.
    """
    if dias < 1:
        dias = 1
    if dias > 365:
        dias = 365

    asignaciones = _get("/asignaciones/proximas-liberaciones", params={"dias": dias})
    limpias = [_clean_asignacion(a) for a in asignaciones]

    return {
        "total": len(limpias),
        "dias_horizonte": dias,
        "asignaciones": limpias,
    }
