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
            raise RuntimeError("El currículum solicitado no existe en el backend.") from exc
        raise RuntimeError(f"Error HTTP {status} consultando el backend DX.") from exc
    except httpx.RequestError as exc:
        raise RuntimeError(
            "No fue posible conectar con el backend DX. "
            "Verifica que FastAPI esté iniciado y que DX_API_BASE_URL sea correcta."
        ) from exc


def _clean_experiencia(exp: dict) -> dict:
    return {
        "orden": exp.get("orden"),
        "titulo": exp.get("titulo"),
        "cliente": exp.get("cliente"),
        "proyecto": exp.get("proyecto"),
        "rol": exp.get("rol"),
        "descripcion": exp.get("descripcion"),
        "periodo": exp.get("periodo"),
    }


def _clean_curriculum(cv: dict) -> dict:
    """
    Expone el contenido profesional del currículum.
    Excluye IDs técnicos internos y metadatos de revisión.
    """
    persona = cv.get("persona") or {}

    return {
        "persona_id": cv.get("persona_id"),
        "persona_nombre": persona.get("nombre"),
        "persona_rol": persona.get("rol"),
        "resumen_profesional": cv.get("resumen_profesional"),
        "areas_especializacion": cv.get("areas_especializacion") or [],
        "herramientas_tecnologias": cv.get("herramientas_tecnologias") or [],
        "clientes_asesorados": cv.get("clientes_asesorados") or [],
        "estudios_posgrados": cv.get("estudios_posgrados") or [],
        "idiomas": cv.get("idiomas") or [],
        "certificaciones": cv.get("certificaciones") or [],
        "experiencias": [
            _clean_experiencia(exp)
            for exp in sorted(
                cv.get("experiencias") or [],
                key=lambda e: e.get("orden", 999),
            )
        ],
        "skills": [
            {
                "nombre": s.get("nombre"),
                "categoria": s.get("categoria"),
                "nivel": s.get("nivel"),
            }
            for s in (cv.get("skills") or [])
        ],
    }


@tool
def obtener_curriculum_persona(persona_id: str) -> dict:
    """
    Obtiene el currículum profesional completo de una persona registrada
    en Dashboard DX, usando su ID interno (ej. "emp-284356").

    Devuelve:
    - Resumen profesional redactado.
    - Áreas de especialización.
    - Herramientas y tecnologías.
    - Clientes asesorados.
    - Estudios y posgrados.
    - Idiomas.
    - Certificaciones.
    - Experiencias laborales ordenadas (título, cliente, proyecto, rol, periodo).
    - Skills con nivel registrado.

    Usa esta herramienta cuando el usuario quiera conocer:
    - La experiencia laboral de una persona.
    - Los clientes con los que ha trabajado.
    - El resumen profesional de alguien del equipo.
    - Las herramientas o tecnologías que usa una persona según su CV.
    - Los estudios o certificaciones de una persona.
    """
    cv = _get(f"/curriculums/persona/{persona_id}")
    return _clean_curriculum(cv)


@tool
def buscar_curriculums(buscar: Optional[str] = None) -> dict:
    """
    Lista los currículums disponibles en Dashboard DX.

    El parámetro "buscar" permite filtrar por nombre, rol, área o número
    de empleado de la persona.

    Devuelve un resumen liviano de cada currículum: nombre, rol y si tiene
    resumen profesional redactado.

    Usa esta herramienta cuando el usuario quiera:
    - Saber qué personas tienen currículum registrado.
    - Buscar personas por nombre o rol dentro de los CVs.
    - Obtener una vista general antes de pedir el detalle de uno específico.
    """
    params = {}
    if buscar:
        params["buscar"] = buscar.strip()

    curriculums = _get("/curriculums/", params=params)

    resumen = [
        {
            "persona_id": cv.get("persona_id"),
            "nombre": (cv.get("persona") or {}).get("nombre"),
            "rol": (cv.get("persona") or {}).get("rol"),
            "tiene_resumen": bool(cv.get("resumen_profesional")),
            "num_experiencias": len(cv.get("experiencias") or []),
        }
        for cv in curriculums
    ]

    return {
        "total": len(resumen),
        "curriculums": resumen,
    }
