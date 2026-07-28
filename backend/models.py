from sqlalchemy import Column, String, Integer, Boolean, Date, Text, JSON, Enum, CheckConstraint, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
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
    rol = Column(String, nullable=False)
    numero_empleado = Column(String, unique=True, nullable=True)
    responsable = Column(String, nullable=True)
    empresa_actual = Column(String)
    area = Column(String)
    nivel_seniority = Column(
        Enum("Junior Designer", "Designer", "Lead Designer", "Expert Designer", "Chief Designer", "Manager", name="nivel_seniority_enum"),
        default="Designer"
    )
    anos_experiencia = Column(Integer)
    habilidades = Column(JSON, default=list)
    certificaciones = Column(JSON, default=list)
    intereses = Column(JSON, default=list)
    disponible_mentoria = Column(Boolean, default=False)
    portfolio_link = Column(String(500))
    evaluacion_ultima = Column(JSON)
    evaluacion_historico = Column(JSON, default=list)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    


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
        Enum("Junior Designer", "Designer", "Lead Designer", "Expert Designer", "Chief Designer", name="nivel_requerido_enum"),
        nullable=True
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
