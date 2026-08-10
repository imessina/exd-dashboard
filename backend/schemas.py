from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import date, datetime
from uuid import UUID
from enum import Enum


# ── Enums ────────────────────────────────────────────────────────────────────

class NivelSeniority(str, Enum):
    junior_designer = "Junior Designer"
    designer = "Designer"
    lead_designer = "Lead Designer"
    expert_designer = "Expert Designer"
    chief_designer = "Chief Designer"
    
    junior_analyst = "Junior Analyst"
    analyst = "Analyst"
    lead_analyst = "Lead Analyst"
    expert_analyst = "Expert Analyst"
    chief_analyst = "Chief Analyst"

    junior_engineer = "Junior Engineer"
    engineer = "Engineer"
    lead_engineer = "Lead Engineer"
    expert_engineer = "Expert Engineer"

    manager = "Manager"


class NivelPiramide(str, Enum):
    executive = "Executive"
    top_manager = "Top manager"
    top_leader = "Top Leader"
    top_expert_leader = "Top Expert Leader"
    expert_lead = "Expert Lead"
    lead = "Lead"
    key_contributor = "Key Contributor"
    contributor = "Contributor"

class EstadoLaboral(str, Enum):
    disponible = "Disponible"
    staffing = "Staffing"
    inactivo = "Inactivo"


class AsignacionEstado(str, Enum):
    active = "active"
    paused = "paused"
    completed = "completed"

class ProyectoFase(str, Enum):
    discovery = "discovery"
    design = "design"
    testing = "testing"
    launch = "launch"
    evolution = "evolution"

class ProyectoHealth(str, Enum):
    on_track = "on_track"
    at_risk = "at_risk"
    blocked = "blocked"

class ProyectoTipo(str, Enum):
    fixed_scope = "fixed_scope"
    time_materials = "time_materials"

class ProyectoEstado(str, Enum):
    pre_sales = "pre_sales"
    active = "active"
    paused = "paused"
    completed = "completed"
    cancelled = "cancelled"

class OportunidadStatus(str, Enum):
    opportunity = "opportunity"
    approved = "approved"
    bidding = "bidding"
    signed = "signed"
    executing = "executing"


# ── Persona Schemas ──────────────────────────────────────────────────────────

class PersonaBase(BaseModel):
    # Datos visibles en la aplicación.
    nombre: str
    rol: str
    numero_empleado: Optional[str] = None
    fecha_ingreso_compania: Optional[date] = None
    fecha_nacimiento: Optional[date] = None
    nivel_piramide: Optional[NivelPiramide] = None
    estado_laboral: EstadoLaboral = EstadoLaboral.disponible

    responsable: Optional[str] = None
    oferta_valor: Optional[str] = None
    empresa_actual: Optional[str] = None
    area: Optional[str] = None
    anos_experiencia: Optional[int] = None
    certificaciones: List[str] = Field(default_factory=list)
    intereses: List[str] = Field(default_factory=list)
    disponible_mentoria: bool = False
    portfolio_link: Optional[str] = None
    evaluacion_ultima: Optional[Any] = None
    evaluacion_historico: List[Any] = Field(default_factory=list)

    # Compatibilidad temporal con la versión anterior.
    nivel_seniority: Optional[NivelSeniority] = None
    habilidades: List[Any] = Field(default_factory=list)


class PersonaCreate(PersonaBase):
    id: str


class PersonaUpdate(BaseModel):
    nombre: Optional[str] = None
    rol: Optional[str] = None
    numero_empleado: Optional[str] = None
    fecha_ingreso_compania: Optional[date] = None
    fecha_nacimiento: Optional[date] = None
    nivel_piramide: Optional[NivelPiramide] = None
    estado_laboral: Optional[EstadoLaboral] = None

    responsable: Optional[str] = None
    oferta_valor: Optional[str] = None
    empresa_actual: Optional[str] = None
    area: Optional[str] = None
    anos_experiencia: Optional[int] = None
    certificaciones: Optional[List[str]] = None
    intereses: Optional[List[str]] = None
    disponible_mentoria: Optional[bool] = None
    portfolio_link: Optional[str] = None
    evaluacion_ultima: Optional[Any] = None
    evaluacion_historico: Optional[List[Any]] = None

    # Compatibilidad temporal. No usar para las personas nuevas.
    nivel_seniority: Optional[NivelSeniority] = None
    habilidades: Optional[List[Any]] = None


class PersonaOut(PersonaBase):
    id: str
    # Datos agregados para indicadores ejecutivos de Pirámide.
    # numero_documento continúa siendo privado y no se expone.
    sexo: Optional[str] = None
    nacionalidad: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True




# ── Persona Skill Schemas ────────────────────────────────────────────────────

class PersonaSkillInput(BaseModel):
    skill_id: str
    nivel: int = Field(ge=1, le=5)


class PersonaSkillsReplace(BaseModel):
    skills: List[PersonaSkillInput] = Field(default_factory=list)


class PersonaSkillOut(BaseModel):
    skill_id: str
    nombre: str
    categoria: Optional[str] = None
    nivel: int


# ── Curriculum Schemas ───────────────────────────────────────────────────────

class CurriculumExperienciaInput(BaseModel):
    titulo: Optional[str] = None
    cliente: Optional[str] = None
    proyecto: Optional[str] = None
    rol: Optional[str] = None
    descripcion: Optional[str] = None
    periodo: Optional[str] = None
    orden: int = Field(ge=1)


class CurriculumExperienciaOut(CurriculumExperienciaInput):
    id: UUID
    curriculum_id: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CurriculumBase(BaseModel):
    resumen_profesional: Optional[str] = None
    areas_especializacion: List[Any] = Field(default_factory=list)
    herramientas_tecnologias: List[Any] = Field(default_factory=list)
    clientes_asesorados: List[Any] = Field(default_factory=list)
    estudios_posgrados: List[Any] = Field(default_factory=list)
    idiomas: List[Any] = Field(default_factory=list)
    certificaciones: List[Any] = Field(default_factory=list)
    archivo_origen: Optional[str] = None
    requiere_revision: bool = True
    activo: bool = True


class CurriculumCreate(CurriculumBase):
    persona_id: str
    experiencias: List[CurriculumExperienciaInput] = Field(default_factory=list)


class CurriculumUpdate(BaseModel):
    resumen_profesional: Optional[str] = None
    areas_especializacion: Optional[List[Any]] = None
    herramientas_tecnologias: Optional[List[Any]] = None
    clientes_asesorados: Optional[List[Any]] = None
    estudios_posgrados: Optional[List[Any]] = None
    idiomas: Optional[List[Any]] = None
    certificaciones: Optional[List[Any]] = None
    archivo_origen: Optional[str] = None
    requiere_revision: Optional[bool] = None
    activo: Optional[bool] = None
    experiencias: Optional[List[CurriculumExperienciaInput]] = Field(default=None)


class CurriculumPersonaResumen(BaseModel):
    id: str
    nombre: str
    rol: str
    area: Optional[str] = None
    empresa_actual: Optional[str] = None
    anos_experiencia: Optional[int] = None
    numero_empleado: Optional[str] = None

    class Config:
        from_attributes = True


class CurriculumOut(CurriculumBase):
    id: UUID
    persona_id: str
    persona: CurriculumPersonaResumen
    experiencias: List[CurriculumExperienciaOut] = Field(default_factory=list)
    skills: List[PersonaSkillOut] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Asignacion Schemas ───────────────────────────────────────────────────────

class AsignacionBase(BaseModel):
    persona_id: str
    proyecto_id: str
    cliente: str
    dedicacion: Optional[int] = 100
    fecha_inicio: date
    fecha_liberacion: Optional[date] = None
    estado: Optional[AsignacionEstado] = AsignacionEstado.active

class AsignacionCreate(AsignacionBase):
    pass

class AsignacionUpdate(BaseModel):
    cliente: Optional[str] = None
    dedicacion: Optional[int] = None
    fecha_inicio: Optional[date] = None
    fecha_liberacion: Optional[date] = None
    estado: Optional[AsignacionEstado] = None

class AsignacionOut(AsignacionBase):
    id: UUID
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Proyecto Schemas ─────────────────────────────────────────────────────────

class ProyectoBase(BaseModel):
    nombre: str
    cliente: str
    descripcion: Optional[str] = None
    tipo: Optional[ProyectoTipo] = ProyectoTipo.fixed_scope
    estado: Optional[ProyectoEstado] = ProyectoEstado.active
    fase: Optional[ProyectoFase] = None
    porcentaje_completado: Optional[int] = None
    fecha_inicio: Optional[date] = None
    fecha_launch: Optional[date] = None
    stakeholder: Optional[str] = None
    health: Optional[ProyectoHealth] = ProyectoHealth.on_track
    equipo: Optional[List[Any]] = []
    issues: Optional[str] = None
    next_milestone: Optional[str] = None

class ProyectoCreate(ProyectoBase):
    id: str

class ProyectoUpdate(BaseModel):
    nombre: Optional[str] = None
    cliente: Optional[str] = None
    descripcion: Optional[str] = None
    tipo: Optional[ProyectoTipo] = None
    estado: Optional[ProyectoEstado] = None
    fase: Optional[ProyectoFase] = None
    porcentaje_completado: Optional[int] = None
    fecha_inicio: Optional[date] = None
    fecha_launch: Optional[date] = None
    stakeholder: Optional[str] = None
    health: Optional[ProyectoHealth] = None
    equipo: Optional[List[Any]] = None
    issues: Optional[str] = None
    next_milestone: Optional[str] = None

class ProyectoOut(ProyectoBase):
    id: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Oportunidad Schemas ──────────────────────────────────────────────────────

class OportunidadBase(BaseModel):
    nombre: str
    cliente: str
    alcance: Optional[str] = None
    fases: Optional[Any] = None
    vacantes: Optional[int] = 1
    nivel_requerido: Optional[NivelPiramide] = None
    competencias_requeridas: Optional[List[str]] = []
    timeline_start: Optional[date] = None
    timeline_end: Optional[date] = None
    status: Optional[OportunidadStatus] = OportunidadStatus.opportunity
    owner: Optional[str] = None

class OportunidadCreate(OportunidadBase):
    pass

class OportunidadUpdate(BaseModel):
    nombre: Optional[str] = None
    cliente: Optional[str] = None
    alcance: Optional[str] = None
    vacantes: Optional[int] = None
    nivel_requerido: Optional[NivelPiramide] = None
    competencias_requeridas: Optional[List[str]] = None
    timeline_start: Optional[date] = None
    timeline_end: Optional[date] = None
    status: Optional[OportunidadStatus] = None
    owner: Optional[str] = None

class OportunidadOut(OportunidadBase):
    id: UUID
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Hito Log Schemas ─────────────────────────────────────────────────────────

class HitoTipo(str, Enum):
    hito = "hito"
    accion = "accion"

class HitoEstado(str, Enum):
    pendiente = "pendiente"
    cumplido = "cumplido"

class HitoLogOut(BaseModel):
    id: UUID
    proyecto_id: str
    descripcion: str
    tipo: HitoTipo
    estado: HitoEstado
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class HitoUpdate(BaseModel):
    """Para gestionar entradas ya registradas (marcar cumplido, reclasificar)."""
    tipo: Optional[HitoTipo] = None
    estado: Optional[HitoEstado] = None
    descripcion: Optional[str] = None


# ── Skill Catalog Schemas ────────────────────────────────────────────────────

class SkillBase(BaseModel):
    nombre: str
    categoria: Optional[str] = None
    descripcion: Optional[str] = None
    activa: Optional[bool] = True

class SkillCreate(SkillBase):
    id: Optional[str] = None  # auto-slug si no se proporciona

class SkillUpdate(BaseModel):
    nombre: Optional[str] = None
    categoria: Optional[str] = None
    descripcion: Optional[str] = None
    activa: Optional[bool] = None

class CategoriaRename(BaseModel):
    """Renombrar una categoría existente. Si `nuevo` ya existe, las skills se fusionan."""
    actual: str
    nuevo: str

class SkillOut(SkillBase):
    id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    personas_count: Optional[int] = 0  # cuántas personas la usan

    class Config:
        from_attributes = True


# ── Skill Matrix Schema ──────────────────────────────────────────────────────

class SkillEntry(BaseModel):
    persona_id: str
    nombre: str
    nivel_seniority: Optional[str]
    habilidades: List[str]
    score: Optional[float] = None

class SkillMatrixOut(BaseModel):
    competencias: List[str]
    personas: List[SkillEntry]
