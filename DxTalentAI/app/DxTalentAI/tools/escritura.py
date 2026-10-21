"""
Herramientas de escritura para TalentIA.

IMPORTANTE: Todas estas herramientas modifican datos reales en el Dashboard DX.
El agente DEBE pedir confirmación explícita al usuario antes de llamar cualquiera
de estas funciones.
"""
import os
import re
import unicodedata
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
        "Content-Type": "application/json",
    }
    if API_KEY:
        headers["X-API-Key"] = API_KEY
    return headers


def _post(path: str, body: dict):
    url = f"{API_BASE_URL}{path}"
    try:
        with httpx.Client(timeout=20.0) as client:
            response = client.post(url, headers=_headers(), json=body)
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        try:
            detail = exc.response.json().get("detail", "")
        except Exception:
            detail = ""
        if status == 400:
            raise RuntimeError(f"Datos inválidos: {detail or 'revisa los campos enviados.'}") from exc
        if status == 409:
            raise RuntimeError(f"Conflicto: {detail or 'el registro ya existe.'}") from exc
        raise RuntimeError(f"Error HTTP {status} al crear el registro: {detail}") from exc
    except httpx.RequestError as exc:
        raise RuntimeError(
            "No fue posible conectar con el backend DX. "
            "Verifica que FastAPI esté iniciado y que DX_API_BASE_URL sea correcta."
        ) from exc


def _put(path: str, body: dict):
    url = f"{API_BASE_URL}{path}"
    try:
        with httpx.Client(timeout=20.0) as client:
            response = client.put(url, headers=_headers(), json=body)
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        try:
            detail = exc.response.json().get("detail", "")
        except Exception:
            detail = ""
        if status == 404:
            raise RuntimeError("El registro no fue encontrado en el backend.") from exc
        if status == 400:
            raise RuntimeError(f"Datos inválidos: {detail or 'revisa los campos enviados.'}") from exc
        raise RuntimeError(f"Error HTTP {status} al actualizar el registro: {detail}") from exc
    except httpx.RequestError as exc:
        raise RuntimeError(
            "No fue posible conectar con el backend DX."
        ) from exc


def _slugify(texto: str) -> str:
    """Genera un ID legible a partir de un texto."""
    nfkd = unicodedata.normalize("NFKD", texto or "")
    ascii_only = "".join(c for c in nfkd if not unicodedata.combining(c))
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_only.lower()).strip("-")
    return (slug or "proyecto")[:60]


# ─────────────────────────────────────────────────────────────────────────────
# CREAR OPORTUNIDAD
# ─────────────────────────────────────────────────────────────────────────────

@tool
def crear_oportunidad(
    nombre: str,
    cliente: str,
    alcance: Optional[str] = None,
    vacantes: int = 1,
    nivel_requerido: Optional[str] = None,
    competencias_requeridas: Optional[list] = None,
    timeline_start: Optional[str] = None,
    timeline_end: Optional[str] = None,
    status: str = "opportunity",
    owner: Optional[str] = None,
) -> dict:
    """
    Crea una nueva oportunidad comercial en el Dashboard DX.

    IMPORTANTE: Antes de llamar esta herramienta DEBES mostrar al usuario
    un resumen con todos los datos y esperar su confirmación explícita
    ("sí", "confirmo", "adelante", etc.).

    Parámetros:
    - nombre: nombre de la oportunidad (obligatorio)
    - cliente: nombre del cliente (obligatorio)
    - alcance: descripción del alcance del trabajo
    - vacantes: número de personas requeridas (default: 1)
    - nivel_requerido: nivel de pirámide requerido. Valores válidos:
      "Contributor", "Key Contributor", "Lead", "Expert Lead",
      "Top Expert Leader", "Top Leader", "Top manager", "Executive"
    - competencias_requeridas: lista de competencias necesarias, ej. ["Figma", "UX Research"]
    - timeline_start: fecha de inicio en formato YYYY-MM-DD
    - timeline_end: fecha de fin en formato YYYY-MM-DD
    - status: estado inicial. Valores válidos:
      "opportunity" (default), "approved", "bidding", "signed", "executing"
    - owner: nombre del responsable de la oportunidad

    Devuelve los datos de la oportunidad creada incluyendo su ID.
    """
    body = {
        "nombre": nombre.strip(),
        "cliente": cliente.strip(),
        "vacantes": vacantes,
        "status": status,
        "competencias_requeridas": competencias_requeridas or [],
    }

    if alcance:
        body["alcance"] = alcance.strip()
    if nivel_requerido:
        body["nivel_requerido"] = nivel_requerido
    if timeline_start:
        body["timeline_start"] = timeline_start
    if timeline_end:
        body["timeline_end"] = timeline_end
    if owner:
        body["owner"] = owner.strip()

    resultado = _post("/oportunidades/", body)

    return {
        "status": "created",
        "id": str(resultado.get("id")),
        "nombre": resultado.get("nombre"),
        "cliente": resultado.get("cliente"),
        "status_oportunidad": resultado.get("status"),
        "vacantes": resultado.get("vacantes"),
        "owner": resultado.get("owner"),
        "timeline_start": str(resultado.get("timeline_start") or ""),
        "timeline_end": str(resultado.get("timeline_end") or ""),
    }


# ─────────────────────────────────────────────────────────────────────────────
# CREAR PROYECTO
# ─────────────────────────────────────────────────────────────────────────────

@tool
def crear_proyecto(
    nombre: str,
    cliente: str,
    descripcion: Optional[str] = None,
    tipo: str = "fixed_scope",
    estado: str = "active",
    fase: Optional[str] = None,
    fecha_inicio: Optional[str] = None,
    fecha_launch: Optional[str] = None,
    stakeholder: Optional[str] = None,
    health: str = "on_track",
    next_milestone: Optional[str] = None,
) -> dict:
    """
    Crea un nuevo proyecto en el Dashboard DX.

    IMPORTANTE: Antes de llamar esta herramienta DEBES mostrar al usuario
    un resumen con todos los datos y esperar su confirmación explícita
    ("sí", "confirmo", "adelante", etc.).

    Parámetros:
    - nombre: nombre del proyecto (obligatorio)
    - cliente: nombre del cliente (obligatorio)
    - descripcion: descripción del proyecto
    - tipo: tipo de contrato. Valores válidos:
      "fixed_scope" (default), "time_materials"
    - estado: estado del proyecto. Valores válidos:
      "pre_sales", "active" (default), "paused", "completed", "cancelled"
    - fase: fase actual. Valores válidos:
      "discovery", "design", "testing", "launch", "evolution"
    - fecha_inicio: fecha de inicio en formato YYYY-MM-DD
    - fecha_launch: fecha de lanzamiento en formato YYYY-MM-DD
    - stakeholder: nombre del stakeholder principal
    - health: salud del proyecto. Valores válidos:
      "on_track" (default), "at_risk", "blocked"
    - next_milestone: descripción del próximo hito

    El ID del proyecto se genera automáticamente a partir del nombre.
    Devuelve los datos del proyecto creado incluyendo su ID.
    """
    proyecto_id = _slugify(nombre)

    body = {
        "id": proyecto_id,
        "nombre": nombre.strip(),
        "cliente": cliente.strip(),
        "tipo": tipo,
        "estado": estado,
        "health": health,
        "equipo": [],
    }

    if descripcion:
        body["descripcion"] = descripcion.strip()
    if fase:
        body["fase"] = fase
    if fecha_inicio:
        body["fecha_inicio"] = fecha_inicio
    if fecha_launch:
        body["fecha_launch"] = fecha_launch
    if stakeholder:
        body["stakeholder"] = stakeholder.strip()
    if next_milestone:
        body["next_milestone"] = next_milestone.strip()

    resultado = _post("/proyectos/", body)

    return {
        "status": "created",
        "id": resultado.get("id"),
        "nombre": resultado.get("nombre"),
        "cliente": resultado.get("cliente"),
        "tipo": resultado.get("tipo"),
        "estado": resultado.get("estado"),
        "fase": resultado.get("fase"),
        "health": resultado.get("health"),
        "fecha_inicio": str(resultado.get("fecha_inicio") or ""),
        "fecha_launch": str(resultado.get("fecha_launch") or ""),
    }


# ─────────────────────────────────────────────────────────────────────────────
# ACTUALIZAR PROYECTO
# ─────────────────────────────────────────────────────────────────────────────

@tool
def actualizar_proyecto(
    proyecto_id: str,
    nombre: Optional[str] = None,
    cliente: Optional[str] = None,
    descripcion: Optional[str] = None,
    tipo: Optional[str] = None,
    estado: Optional[str] = None,
    fase: Optional[str] = None,
    porcentaje_completado: Optional[int] = None,
    fecha_inicio: Optional[str] = None,
    fecha_launch: Optional[str] = None,
    stakeholder: Optional[str] = None,
    health: Optional[str] = None,
    issues: Optional[str] = None,
    next_milestone: Optional[str] = None,
) -> dict:
    """
    Actualiza uno o más campos de un proyecto existente en el Dashboard DX.

    IMPORTANTE: Antes de llamar esta herramienta DEBES mostrar al usuario
    un resumen con los cambios que se van a aplicar y esperar su confirmación
    explícita ("sí", "confirmo", "adelante", etc.).

    Parámetros:
    - proyecto_id: ID interno del proyecto (obligatorio). Si no lo sabes,
      usa listar_proyectos primero para encontrarlo.
    - nombre, cliente, descripcion: datos básicos del proyecto
    - tipo: "fixed_scope" o "time_materials"
    - estado: "pre_sales", "active", "paused", "completed", "cancelled"
    - fase: "discovery", "design", "testing", "launch", "evolution"
    - porcentaje_completado: número entre 0 y 100
    - fecha_inicio, fecha_launch: fechas en formato YYYY-MM-DD
    - stakeholder: nombre del stakeholder principal
    - health: "on_track", "at_risk", "blocked"
    - issues: descripción de problemas o bloqueos
    - next_milestone: descripción del próximo hito

    Solo envía los campos que quieres cambiar. Los demás quedan sin modificar.
    Devuelve los datos actualizados del proyecto.
    """
    body = {}

    if nombre is not None:
        body["nombre"] = nombre.strip()
    if cliente is not None:
        body["cliente"] = cliente.strip()
    if descripcion is not None:
        body["descripcion"] = descripcion.strip()
    if tipo is not None:
        body["tipo"] = tipo
    if estado is not None:
        body["estado"] = estado
    if fase is not None:
        body["fase"] = fase
    if porcentaje_completado is not None:
        body["porcentaje_completado"] = max(0, min(100, porcentaje_completado))
    if fecha_inicio is not None:
        body["fecha_inicio"] = fecha_inicio
    if fecha_launch is not None:
        body["fecha_launch"] = fecha_launch
    if stakeholder is not None:
        body["stakeholder"] = stakeholder.strip()
    if health is not None:
        body["health"] = health
    if issues is not None:
        body["issues"] = issues.strip()
    if next_milestone is not None:
        body["next_milestone"] = next_milestone.strip()

    if not body:
        raise ValueError(
            "No se especificó ningún campo para actualizar. "
            "Indica al menos un campo que quieras cambiar."
        )

    resultado = _put(f"/proyectos/{proyecto_id}", body)

    return {
        "status": "updated",
        "id": resultado.get("id"),
        "nombre": resultado.get("nombre"),
        "cliente": resultado.get("cliente"),
        "estado": resultado.get("estado"),
        "fase": resultado.get("fase"),
        "health": resultado.get("health"),
        "porcentaje_completado": resultado.get("porcentaje_completado"),
        "next_milestone": resultado.get("next_milestone"),
        "issues": resultado.get("issues"),
    }
