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
            raise RuntimeError("La oportunidad solicitada no existe en el backend.") from exc
        raise RuntimeError(f"Error HTTP {status} consultando el backend DX.") from exc
    except httpx.RequestError as exc:
        raise RuntimeError(
            "No fue posible conectar con el backend DX. "
            "Verifica que FastAPI esté iniciado y que DX_API_BASE_URL sea correcta."
        ) from exc


def _clean_oportunidad(o: dict) -> dict:
    """Expone los campos comerciales relevantes de una oportunidad."""
    return {
        "id": o.get("id"),
        "nombre": o.get("nombre"),
        "cliente": o.get("cliente"),
        "alcance": o.get("alcance"),
        "vacantes": o.get("vacantes"),
        "nivel_requerido": o.get("nivel_requerido"),
        "competencias_requeridas": o.get("competencias_requeridas") or [],
        "timeline_start": str(o.get("timeline_start") or ""),
        "timeline_end": str(o.get("timeline_end") or ""),
        "status": o.get("status"),
        "owner": o.get("owner"),
    }


@tool
def listar_oportunidades(
    status: Optional[str] = None,
    nivel: Optional[str] = None,
) -> dict:
    """
    Lista las oportunidades comerciales del pipeline de Dashboard DX.

    Puede filtrar por:
    - status: estado de la oportunidad.
      Valores posibles: "opportunity", "approved", "bidding", "won", "lost".
    - nivel: nivel de pirámide requerido para la oportunidad
      (ej. "Contributor", "Lead", "Expert Lead").

    Usa esta herramienta cuando el usuario quiera saber:
    - Qué oportunidades están abiertas en el pipeline.
    - Cuántas oportunidades hay en etapa de licitación.
    - Qué competencias se requieren en las oportunidades actuales.
    - Oportunidades ganadas o perdidas.
    - Cuándo inicia o termina el timeline de una oportunidad.
    """
    params = {}
    if status:
        params["status"] = status
    if nivel:
        params["nivel"] = nivel

    oportunidades = _get("/oportunidades/", params=params)
    limpias = [_clean_oportunidad(o) for o in oportunidades]

    return {
        "total": len(limpias),
        "oportunidades": limpias,
    }


@tool
def obtener_oportunidad(oportunidad_id: str) -> dict:
    """
    Obtiene el detalle completo de una oportunidad específica de Dashboard DX
    usando su identificador interno (UUID).

    Usa esta herramienta cuando el usuario quiera conocer el detalle de una
    oportunidad en particular: alcance, competencias requeridas, timeline, owner, etc.
    """
    oportunidad = _get(f"/oportunidades/{oportunidad_id}")
    return _clean_oportunidad(oportunidad)
