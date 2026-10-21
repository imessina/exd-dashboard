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
            raise RuntimeError("El proyecto solicitado no existe en el backend.") from exc
        raise RuntimeError(f"Error HTTP {status} consultando el backend DX.") from exc
    except httpx.RequestError as exc:
        raise RuntimeError(
            "No fue posible conectar con el backend DX. "
            "Verifica que FastAPI esté iniciado y que DX_API_BASE_URL sea correcta."
        ) from exc


def _clean_proyecto(p: dict) -> dict:
    """Expone los campos operativos de un proyecto."""
    return {
        "id": p.get("id"),
        "nombre": p.get("nombre"),
        "cliente": p.get("cliente"),
        "descripcion": p.get("descripcion"),
        "tipo": p.get("tipo"),
        "estado": p.get("estado"),
        "fase": p.get("fase"),
        "porcentaje_completado": p.get("porcentaje_completado"),
        "fecha_inicio": str(p.get("fecha_inicio") or ""),
        "fecha_launch": str(p.get("fecha_launch") or ""),
        "stakeholder": p.get("stakeholder"),
        "health": p.get("health"),
        "equipo": p.get("equipo") or [],
        "issues": p.get("issues"),
        "next_milestone": p.get("next_milestone"),
    }


@tool
def listar_proyectos(
    fase: Optional[str] = None,
    health: Optional[str] = None,
) -> dict:
    """
    Lista los proyectos registrados en Dashboard DX.

    Puede filtrar por:
    - fase: etapa del proyecto (ej. "discovery", "design", "delivery", "launch").
    - health: estado de salud del proyecto ("on_track", "at_risk", "blocked").

    Usa esta herramienta cuando el usuario quiera saber:
    - Qué proyectos existen actualmente.
    - Cuántos proyectos hay en una fase determinada.
    - Qué proyectos están en riesgo o bloqueados.
    - El equipo asignado a un proyecto.
    - El próximo hito o issues de los proyectos.
    """
    params = {}
    if fase:
        params["fase"] = fase
    if health:
        params["health"] = health

    proyectos = _get("/proyectos/", params=params)
    limpios = [_clean_proyecto(p) for p in proyectos]

    return {
        "total": len(limpios),
        "proyectos": limpios,
    }


@tool
def obtener_proyecto(proyecto_id: str) -> dict:
    """
    Obtiene los detalles completos de un proyecto específico de Dashboard DX
    usando su identificador interno.

    Usa esta herramienta cuando el usuario quiera conocer el detalle de un
    proyecto en particular: descripción, estado, equipo, hitos, issues, etc.
    """
    proyecto = _get(f"/proyectos/{proyecto_id}")
    return _clean_proyecto(proyecto)
