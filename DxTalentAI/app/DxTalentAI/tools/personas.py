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
    headers = {
        "Accept": "application/json",
    }

    if API_KEY:
        headers["X-API-Key"] = API_KEY

    return headers


def _clean_persona(persona: dict) -> dict:
    """
    Expone al agente solo información laboral relevante.
    Excluye datos personales que no son necesarios para búsqueda de talento.
    """

    return {
        "id": persona.get("id"),
        "nombre": persona.get("nombre"),
        "rol": persona.get("rol"),
        "numero_empleado": persona.get("numero_empleado"),
        "nivel_piramide": persona.get("nivel_piramide"),
        "nivel_seniority": persona.get("nivel_seniority"),
        "estado_laboral": persona.get("estado_laboral"),
        "responsable": persona.get("responsable"),
        "oferta_valor": persona.get("oferta_valor"),
        "empresa_actual": persona.get("empresa_actual"),
        "area": persona.get("area"),
        "anos_experiencia": persona.get("anos_experiencia"),
        "certificaciones": persona.get("certificaciones") or [],
        "intereses": persona.get("intereses") or [],
        "disponible_mentoria": persona.get(
            "disponible_mentoria",
            False,
        ),
        "portfolio_link": persona.get("portfolio_link"),
        "habilidades": persona.get("habilidades") or [],
    }


def _get(
    path: str,
    params: Optional[dict] = None,
):
    url = f"{API_BASE_URL}{path}"

    try:
        with httpx.Client(timeout=15.0) as client:
            response = client.get(
                url,
                headers=_headers(),
                params=params,
            )

        response.raise_for_status()
        return response.json()

    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code

        if status == 401:
            raise RuntimeError(
                "El backend rechazó la API key de DX Talent AI."
            ) from exc

        if status == 404:
            raise RuntimeError(
                "El recurso solicitado no existe en el backend."
            ) from exc

        raise RuntimeError(
            f"Error HTTP {status} consultando el backend DX."
        ) from exc

    except httpx.RequestError as exc:
        raise RuntimeError(
            "No fue posible conectar con el backend DX. "
            "Verifica que FastAPI esté iniciado y que "
            "DX_API_BASE_URL sea correcta."
        ) from exc


@tool
def listar_personas(
    nivel: Optional[str] = None,
    habilidad: Optional[str] = None,
    oferta_valor: Optional[str] = None,
) -> list[dict]:
    """
    Lista personas reales registradas en Dashboard DX.

    Puede filtrar opcionalmente por nivel de pirámide,
    habilidad histórica y oferta de valor.

    Usa esta herramienta cuando el usuario quiera conocer,
    contar, buscar o filtrar personas del equipo DX.

    Para búsquedas por capacidades actuales y nivel de dominio,
    utiliza buscar_personas_por_capacidad.
    """

    params = {}

    if nivel:
        params["nivel"] = nivel

    if habilidad:
        params["habilidad"] = habilidad

    if oferta_valor:
        params["oferta_valor"] = oferta_valor

    personas = _get(
        "/personas/",
        params=params,
    )

    return [
        _clean_persona(persona)
        for persona in personas
    ]


@tool
def obtener_persona(
    persona_id: str,
) -> dict:
    """
    Obtiene los datos laborales de una persona real del Dashboard DX
    utilizando su identificador interno.
    """

    persona = _get(
        f"/personas/{persona_id}"
    )

    return _clean_persona(persona)


@tool
def obtener_capacidades_persona(
    persona_id: str,
) -> list[dict]:
    """
    Obtiene las capacidades registradas de una persona del Dashboard DX,
    incluyendo nombre, categoría y nivel de cada capacidad.
    """

    return _get(
        f"/personas/{persona_id}/skills"
    )


@tool
def buscar_personas_por_capacidad(
    capacidad: str,
    nivel_minimo: int = 1,
) -> dict:
    """
    Busca en toda la base de datos del Dashboard DX las personas
    que tienen una capacidad determinada con un nivel igual o superior
    al solicitado.

    Esta herramienta consulta la fuente actual persona_skills y debe
    utilizarse para preguntas como:

    - Quién tiene AWS nivel 3 o más.
    - Personas con React nivel 4 o superior.
    - Quién sabe Python.
    - Personas con Figma nivel 5.

    El nivel válido es de 1 a 5.

    No uses recuerdos de consultas anteriores para afirmar que la lista
    está completa. Para búsquedas globales por capacidad, utiliza siempre
    esta herramienta.
    """

    capacidad = capacidad.strip()

    if not capacidad:
        raise ValueError(
            "La capacidad no puede estar vacía."
        )

    if nivel_minimo < 1 or nivel_minimo > 5:
        raise ValueError(
            "El nivel mínimo debe estar entre 1 y 5."
        )

    return _get(
        "/skill-matrix/search",
        params={
            "skill": capacidad,
            "nivel_minimo": nivel_minimo,
        },
    )