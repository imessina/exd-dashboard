"""
Herramientas de propuesta para TalentIA; nunca ejecutan escrituras.

El backend valida y guarda cada propuesta. Solo el navegador del usuario autorizado
puede confirmar su ejecución, con el contenido exacto y durante diez minutos.
"""
import re
import unicodedata
from typing import Optional

from strands import tool


def _proposal(operation: str, body: dict, target_id: str | None = None) -> dict:
    """Solo describe cambios. No tiene credenciales ni realiza llamadas de escritura."""
    return {
        "status": "pending_confirmation",
        "message": "Propuesta preparada. No se ha guardado nada; usa el botón Confirmar del chat.",
        "action_proposal": {
            "operation": operation,
            "payload": body,
            "target_id": target_id,
        },
    }


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

    Prepara la propuesta cuando tengas los datos. No guarda cambios.
    El usuario debe usar el botón Confirmar del chat para ejecutarla.

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

    Devuelve una propuesta pendiente; no crea la oportunidad.
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

    return _proposal("crear_oportunidad", body)


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

    Prepara la propuesta cuando tengas los datos. No guarda cambios.
    El usuario debe usar el botón Confirmar del chat para ejecutarla.

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
    Devuelve una propuesta pendiente; no crea el proyecto.
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

    return _proposal("crear_proyecto", body)


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

    Prepara la propuesta cuando tengas los datos. No guarda cambios.
    El usuario debe usar el botón Confirmar del chat para ejecutarla.

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
    Devuelve una propuesta pendiente; no modifica el proyecto.
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

    return _proposal("actualizar_proyecto", body, proyecto_id)


# ─────────────────────────────────────────────────────────────────────────────
# CREAR PERSONA (miembro del equipo)
# ─────────────────────────────────────────────────────────────────────────────

@tool
def crear_persona(
    nombre: str,
    rol: str,
    numero_empleado: str,
    nivel_piramide: Optional[str] = None,
    estado_laboral: str = "Disponible",
    oferta_valor: Optional[str] = None,
    empresa_actual: Optional[str] = None,
    area: Optional[str] = None,
    anos_experiencia: Optional[int] = None,
    fecha_ingreso_compania: Optional[str] = None,
    disponible_mentoria: bool = False,
    portfolio_link: Optional[str] = None,
) -> dict:
    """
    Agrega una nueva persona al equipo DX en el Dashboard.

    Prepara la propuesta cuando tengas los datos. No guarda cambios.
    El usuario debe usar el botón Confirmar del chat para ejecutarla.

    Parámetros:
    - nombre: nombre completo de la persona (obligatorio)
    - rol: cargo o rol, ej. "UX Designer", "Lead Engineer" (obligatorio)
    - numero_empleado: número de empleado único, solo dígitos, ej. "284356" (obligatorio)
    - nivel_piramide: nivel en la pirámide. Valores válidos:
      "Contributor", "Key Contributor", "Lead", "Expert Lead",
      "Top Expert Leader", "Top Leader", "Top manager", "Executive"
    - estado_laboral: "Disponible" (default), "Staffing", "Inactivo"
    - oferta_valor: nombre de la oferta de valor a la que pertenece
    - empresa_actual: empresa donde trabaja actualmente (default: NTT DATA)
    - area: área o práctica, ej. "Diseño", "Desarrollo"
    - anos_experiencia: años de experiencia profesional
    - fecha_ingreso_compania: fecha de ingreso en formato YYYY-MM-DD
    - disponible_mentoria: true si está disponible para mentoría
    - portfolio_link: URL del portfolio personal

    Devuelve una propuesta pendiente; no crea la persona.
    """
    numero_empleado = str(numero_empleado).strip()
    persona_id = f"emp-{numero_empleado}"

    body = {
        "id": persona_id,
        "nombre": nombre.strip(),
        "rol": rol.strip(),
        "numero_empleado": numero_empleado,
        "estado_laboral": estado_laboral,
        "disponible_mentoria": disponible_mentoria,
        "habilidades": [],
        "certificaciones": [],
        "intereses": [],
    }

    if nivel_piramide:
        body["nivel_piramide"] = nivel_piramide
    if oferta_valor:
        body["oferta_valor"] = oferta_valor.strip()
    if empresa_actual:
        body["empresa_actual"] = empresa_actual.strip()
    if area:
        body["area"] = area.strip()
    if anos_experiencia is not None:
        body["anos_experiencia"] = anos_experiencia
    if fecha_ingreso_compania:
        body["fecha_ingreso_compania"] = fecha_ingreso_compania
    if portfolio_link:
        body["portfolio_link"] = portfolio_link.strip()

    return _proposal("crear_persona", body)
