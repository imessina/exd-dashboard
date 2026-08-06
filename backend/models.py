from sqlalchemy import (
    Column, String, Integer, Boolean, Date, Text, JSON, Enum,
    CheckConstraint, ForeignKey, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from sqlalchemy.types import TIMESTAMP
import uuid
from database import Base


class Skill(Base):
    """Catálogo central de habilidades. Las personas referencian por `nombre`."""
    __tablename__ = "skills"

    id = Column(String(100), primary_key=True)        # slug, ej "ux-research"
    nombre = Column(String(150), nullable=False, unique=True)  # display, ej "UX Research"
    categoria = Column(String(80), nullable=True)     # ej "Research", "Diseño", null
    descripcion = Column(Text, nullable=True)
    activa = Column(Boolean, default=True, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())


class Persona(Base):
    __tablename__ = "personas"

    id = Column(String, primary_key=True)
    nombre = Column(String, nullable=False)

    # Cargo real, por ejemplo: Lead Engineer, Project Leader o Director.
    rol = Column(String, nullable=False)

    numero_empleado = Column(String, unique=True, nullable=True)
    responsable = Column(String, nullable=True)
    empresa_actual = Column(String)
    area = Column(String)

    # Columna histórica. Se mantiene temporalmente para no romper los datos
    # y pantallas anteriores, pero ya no será la fuente de la pirámide.
    nivel_seniority = Column(
        Enum(
            "Junior Designer",
            "Designer",
            "Lead Designer",
            "Expert Designer",
            "Chief Designer",
            "Junior Analyst",
            "Analyst",
            "Lead Analyst",
            "Expert Analyst",
            "Chief Analyst",
            "Junior Engineer",
            "Engineer",
            "Lead Engineer",
            "Expert Engineer",
            "Manager",
            name="nivel_seniority_enum",
        ),
        nullable=True,
        default=None,
    )

    # Nivel ejecutivo utilizado por Pirámide y filtros.
    nivel_piramide = Column(String(30), nullable=True)

    # Estado laboral visible y editable desde Equipo.
    estado_laboral = Column(String(20), nullable=False, default="Disponible", comment="Estado manual: Disponible, Staffing o Inactivo. En proyecto se calcula desde asignaciones.")

    # Datos visibles del nuevo listado.
    fecha_ingreso_compania = Column(Date, nullable=True)
    fecha_nacimiento = Column(Date, nullable=True)

    # Datos privados. Se almacenan, pero no se exponen en PersonaOut.
    numero_documento = Column(String(20), unique=True, nullable=True)
    sexo = Column(String(10), nullable=True)
    nacionalidad = Column(String(80), nullable=True)

    anos_experiencia = Column(Integer)

    # Campo histórico. Las skills con nivel se gestionarán en persona_skills.
    habilidades = Column(JSON, default=list)
    certificaciones = Column(JSON, default=list)
    intereses = Column(JSON, default=list)
    disponible_mentoria = Column(Boolean, default=False)
    portfolio_link = Column(String(500))
    evaluacion_ultima = Column(JSON)
    evaluacion_historico = Column(JSON, default=list)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())


class PersonaSkill(Base):
    """Nivel de dominio (1–5) de una skill para una persona."""

    __tablename__ = "persona_skills"
    __table_args__ = (
        UniqueConstraint("persona_id", "skill_id", name="persona_skills_persona_skill_unique"),
        CheckConstraint(
    "orden >= 1",
    name="curriculum_experiencias_orden_check",
),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    persona_id = Column(
        String,
        ForeignKey("personas.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    skill_id = Column(
        String(100),
        ForeignKey("skills.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    nivel = Column(Integer, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())


class Curriculum(Base):
    __tablename__ = "curriculums"
    __table_args__ = (
        UniqueConstraint("persona_id", name="curriculums_persona_unique"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    persona_id = Column(
        String,
        ForeignKey("personas.id", onupdate="CASCADE", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    resumen_profesional = Column(Text, nullable=True)
    areas_especializacion = Column(JSONB, nullable=False, default=list)
    herramientas_tecnologias = Column(JSONB, nullable=False, default=list)
    clientes_asesorados = Column(JSONB, nullable=False, default=list)
    estudios_posgrados = Column(JSONB, nullable=False, default=list)
    idiomas = Column(JSONB, nullable=False, default=list)
    certificaciones = Column(JSONB, nullable=False, default=list)
    archivo_origen = Column(Text, nullable=True)
    requiere_revision = Column(Boolean, nullable=False, default=True)
    activo = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())

    persona = relationship("Persona")
    experiencias = relationship(
        "CurriculumExperiencia",
        back_populates="curriculum",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="CurriculumExperiencia.orden",
    )


class CurriculumExperiencia(Base):
    __tablename__ = "curriculum_experiencias"
    __table_args__ = (
        CheckConstraint("orden BETWEEN 1 AND 3", name="curriculum_experiencias_orden_check"),
        UniqueConstraint(
            "curriculum_id",
            "orden",
            name="curriculum_experiencias_curriculum_orden_unique",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    curriculum_id = Column(
        UUID(as_uuid=True),
        ForeignKey("curriculums.id", onupdate="CASCADE", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    titulo = Column(Text, nullable=True)
    cliente = Column(Text, nullable=True)
    proyecto = Column(Text, nullable=True)
    rol = Column(Text, nullable=True)
    descripcion = Column(Text, nullable=True)
    periodo = Column(Text, nullable=True)
    orden = Column(Integer, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())

    curriculum = relationship("Curriculum", back_populates="experiencias")


class Asignacion(Base):
    __tablename__ = "asignaciones"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    persona_id = Column(String, ForeignKey("personas.id", ondelete="CASCADE"), nullable=False)
    proyecto_id = Column(String(100), nullable=False)
    cliente = Column(String(200), nullable=False)
    dedicacion = Column(Integer, default=100)
    fecha_inicio = Column(Date, nullable=False)
    fecha_liberacion = Column(Date)
    estado = Column(
        Enum("active", "paused", "completed", name="asignacion_estado_enum"),
        default="active"
    )
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())


class Proyecto(Base):
    __tablename__ = "proyectos"

    id = Column(String(100), primary_key=True)
    nombre = Column(String, nullable=False)
    cliente = Column(String(200), nullable=False)
    descripcion = Column(Text)
    tipo = Column(
        Enum("fixed_scope", "time_materials", name="proyecto_tipo_enum"),
        default="fixed_scope",
        nullable=False,
    )
    estado = Column(
        Enum("pre_sales", "active", "paused", "completed", "cancelled", name="proyecto_estado_enum"),
        default="active",
        nullable=False,
    )
    fase = Column(
        Enum("discovery", "design", "testing", "launch", "evolution", name="proyecto_fase_enum"),
        default="discovery",
        nullable=True,
    )
    porcentaje_completado = Column(Integer, default=0, nullable=True)
    fecha_inicio = Column(Date)
    fecha_launch = Column(Date)
    stakeholder = Column(String(200))
    health = Column(
        Enum("on_track", "at_risk", "blocked", name="proyecto_health_enum"),
        default="on_track"
    )
    equipo = Column(JSON, default=list)
    issues = Column(Text)
    next_milestone = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())


class HitoLog(Base):
    """Log histórico de hitos/acciones declarados por proyecto.

    Cada vez que se declara un nuevo `next_milestone` en un proyecto se registra
    una entrada aquí (registro automático), para mantener la trazabilidad de los
    hitos y acciones a lo largo del tiempo. El estado permite marcar el avance.
    """
    __tablename__ = "hitos_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    proyecto_id = Column(String(100), ForeignKey("proyectos.id", ondelete="CASCADE"), nullable=False)
    descripcion = Column(Text, nullable=False)
    tipo = Column(
        Enum("hito", "accion", name="hito_tipo_enum"),
        default="hito",
        nullable=False,
    )
    estado = Column(
        Enum("pendiente", "cumplido", name="hito_estado_enum"),
        default="pendiente",
        nullable=False,
    )
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())


class Oportunidad(Base):
    __tablename__ = "oportunidades"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre = Column(String, nullable=False)
    cliente = Column(String(200), nullable=False)
    alcance = Column(Text)
    fases = Column(JSON)
    vacantes = Column(Integer, default=1)
    nivel_requerido = Column(
        Enum(
            "Director",
            "Manager",
            "Chief",
            "Evangelist",
            "Expert",
            "Leader",
            "Professional",
            "Junior",
            name="nivel_requerido_enum",
        ),
        nullable=True,
    )
    competencias_requeridas = Column(JSON, default=list)
    timeline_start = Column(Date)
    timeline_end = Column(Date)
    status = Column(
        Enum("opportunity", "approved", "bidding", "signed", "executing", name="oportunidad_status_enum"),
        default="opportunity"
    )
    owner = Column(String(200))
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
