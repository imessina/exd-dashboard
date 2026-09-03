import logging

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from auth import require_admin_key, require_api_key
from config import settings
from database import Base, engine
from routes import (
    personas,
    asignaciones,
    proyectos,
    oportunidades,
    skill_matrix,
    skills,
    curriculums,
    ofertas_valor,
    ai,
    usuarios,
)
import models  # noqa: F401  -- needed by /api/admin/* endpoints

logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Note: Tables are created via alembic migrations in production
    # or manually via: python -c "from database import Base, engine; Base.metadata.create_all(bind=engine)"
    yield


app = FastAPI(
    title="ExD Control Center API",
    description="Centro de Control Operativo para el Equipo Experience Design",
    version="1.0.0",
    lifespan=lifespan,
)

cors_origins = list(
    dict.fromkeys(
        [
            *settings.cors_origins_list,
            "https://talentia-dx.vercel.app",
        ]
    )
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers — todos los endpoints de datos exigen `X-API-Key`
_protegido = [Depends(require_api_key)]
app.include_router(personas.router, prefix="/api", dependencies=_protegido)
app.include_router(asignaciones.router, prefix="/api", dependencies=_protegido)
app.include_router(proyectos.router, prefix="/api", dependencies=_protegido)
app.include_router(oportunidades.router, prefix="/api", dependencies=_protegido)
app.include_router(skill_matrix.router, prefix="/api", dependencies=_protegido)
app.include_router(skills.router, prefix="/api", dependencies=_protegido)
app.include_router(curriculums.router, prefix="/api", dependencies=_protegido)
app.include_router(ofertas_valor.router, prefix="/api", dependencies=_protegido)
app.include_router(
    ai.router,
    prefix="/api",
    dependencies=_protegido,
)
app.include_router(usuarios.router, prefix="/api")

@app.get("/")
def root():
    return {"status": "ok", "app": "ExD Control Center", "version": "1.0.0"}


@app.get("/api/health")
def health():
    return {"status": "healthy"}


@app.get("/api/health/db")
def health_db():
    """Health check que toca la BD sin exponer datos. Sin auth a propósito:
    lo usa el workflow de keep-alive para registrar actividad en Supabase."""
    from fastapi import HTTPException
    from sqlalchemy import text

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "healthy", "db": "reachable"}
    except Exception:
        logger.exception("Health check de BD falló")
        raise HTTPException(status_code=503, detail="Base de datos no disponible")


@app.post("/api/admin/init-db", dependencies=[Depends(require_admin_key)])
def init_db():
    """Initialize database tables. Call this endpoint once after deployment."""
    import os
    from database import make_engine

    try:
        # Read DATABASE_URL from environment (not from config which may have stale value)
        db_url = os.environ.get("DATABASE_URL", "postgresql://localhost/exd_control")

        # Create a fresh engine (normalizes scheme + pool settings for Supabase)
        temp_engine = make_engine(db_url)
        Base.metadata.create_all(bind=temp_engine)
        temp_engine.dispose()

        return {"status": "success", "message": "Database tables created successfully!"}
    except Exception:
        logger.exception("init-db falló")
        return {"status": "error", "message": "Error interno; revisa los logs del servidor"}


@app.post("/api/admin/migrate-skills-catalog", dependencies=[Depends(require_admin_key)])
def migrate_skills_catalog():
    """
    Idempotent migration:
      1. Creates `skills` table if missing.
      2. Extracts unique skills from existing `personas.habilidades` and seeds them
         into the catalog with heuristic auto-categorization. Skills already in
         the catalog are skipped (no overwrite of manual edits).
      3. Personas rows are not modified — `personas.habilidades` already contains
         the canonical names.

    Categories used for auto-classification:
      - Research, Diseño, Sistemas y herramientas, AI, Soft skills
      - Skills that don't match any heuristic are left with categoria=NULL
        for the user to classify manually.
    """
    import os
    import re
    import unicodedata
    from typing import Optional
    from sqlalchemy import inspect
    from sqlalchemy.orm import sessionmaker
    from database import make_engine

    def _slugify(text: str) -> str:
        if not text:
            return ""
        nfkd = unicodedata.normalize("NFKD", text)
        ascii_only = "".join(c for c in nfkd if not unicodedata.combining(c))
        s = ascii_only.lower()
        s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
        return s or "skill"

    def _auto_categoria(nombre: str) -> Optional[str]:
        n = nombre.lower()
        # Research, Discovery & Insight
        if any(k in n for k in ["research", "discovery", "insight", "user research", "ethnography", "qualitative", "quantitative"]):
            return "Research, Discovery & Insight"
        # UX/UI, Interaction & Visual Design
        if any(k in n for k in ["ux design", "ui design", "interaction", "visual", "wireframe", "prototyp", "responsive"]):
            return "UX/UI, Interaction & Visual Design"
        # Product Design & Strategy
        if any(k in n for k in ["product design", "product strategy", "product management"]):
            return "Product Design & Strategy"
        # Service Design & Transformation
        if any(k in n for k in ["service design", "service blueprint", "customer journey", "experience mapping", "transformation"]):
            return "Service Design & Transformation"
        # Design Systems, Accesibility & Quality
        if any(k in n for k in ["design system", "figma", "component library", "accessibility", "wcag", "inclusive", "quality assurance"]):
            return "Design Systems, Accesibility & Quality"
        # Strategy, Business & Measurement
        if any(k in n for k in ["business strategy", "measurement", "analytics", "metrics", "kpi", "roi", "business model"]):
            return "Strategy, Business & Measurement"
        # Facilitation/Leadership & Stakeholder Management
        if any(k in n for k in ["facilitation", "workshop", "leadership", "mentoring", "stakeholder", "communication", "influence"]):
            return "Facilitation/Leadership & Stakeholder Management"
        # Technology, Tools, & AI Enablement
        if any(k in n for k in [" ai ", "ai ", " ai", "machine learning", "ml ", "artificial", "generative", "chatbot", "tool", "miro", "sketch", "notion", "automation"]):
            return "Technology, Tools, & AI Enablement"
        if n.startswith("ai ") or n == "ai" or "ai-" in n:
            return "Technology, Tools, & AI Enablement"
        # Professional & Interpersonal Skills
        if any(k in n for k in ["soft skill", "presentation", "negotiation", "problem solving", "creativity", "critical thinking", "collaboration"]):
            return "Professional & Interpersonal Skills"
        return None

    db_url = os.environ.get("DATABASE_URL", "postgresql://localhost/exd_control")
    temp_engine = None
    db = None

    try:
        temp_engine = make_engine(db_url)

        # 1. Ensure table exists. Base.metadata.create_all is idempotent (CREATE
        #    TABLE IF NOT EXISTS), so this is safe to call repeatedly.
        Base.metadata.create_all(bind=temp_engine, tables=[models.Skill.__table__])

        # 2. Open a session and seed
        Session = sessionmaker(bind=temp_engine)
        db = Session()

        ya_cat = {s.nombre for s in db.query(models.Skill).all()}

        personas = db.query(models.Persona).all()
        declaradas = set()
        for p in personas:
            for hab in (p.habilidades or []):
                if hab and isinstance(hab, str):
                    declaradas.add(hab.strip())

        nuevas = sorted(declaradas - ya_cat)
        for nombre in nuevas:
            db.add(models.Skill(
                id=_slugify(nombre),
                nombre=nombre,
                categoria=_auto_categoria(nombre),
                activa=True,
            ))
        db.commit()

        total = db.query(models.Skill).count()
        return {
            "status": "success",
            "message": f"Skills catalog migrated. Added {len(nuevas)} new entries. Total in catalog: {total}.",
            "nuevas": nuevas,
        }
    except Exception:
        if db is not None:
            db.rollback()
        logger.exception("migrate-skills-catalog falló")
        return {"status": "error", "message": "Error interno; revisa los logs del servidor"}
    finally:
        if db is not None:
            db.close()
        if temp_engine is not None:
            temp_engine.dispose()


@app.post("/api/admin/migrate-proyecto-types", dependencies=[Depends(require_admin_key)])
def migrate_proyecto_types():
    """Idempotent migration: add `tipo` and `estado` columns to `proyectos`.

    Adds enum types and columns if missing. Safe to call multiple times.
    Existing rows default to tipo='fixed_scope', estado='active'.
    """
    import os
    from sqlalchemy import text
    from database import make_engine

    db_url = os.environ.get("DATABASE_URL", "postgresql://localhost/exd_control")
    temp_engine = make_engine(db_url)

    statements = [
        # Create enum types if they don't exist (PostgreSQL requires this dance)
        """
        DO $$ BEGIN
            CREATE TYPE proyecto_tipo_enum AS ENUM ('fixed_scope', 'time_materials');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
        """,
        """
        DO $$ BEGIN
            CREATE TYPE proyecto_estado_enum AS ENUM ('pre_sales', 'active', 'paused', 'completed', 'cancelled');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
        """,
        # Add columns if they don't exist
        """
        ALTER TABLE proyectos
        ADD COLUMN IF NOT EXISTS tipo proyecto_tipo_enum NOT NULL DEFAULT 'fixed_scope';
        """,
        """
        ALTER TABLE proyectos
        ADD COLUMN IF NOT EXISTS estado proyecto_estado_enum NOT NULL DEFAULT 'active';
        """,
    ]

    try:
        with temp_engine.begin() as conn:
            for stmt in statements:
                conn.execute(text(stmt))
        temp_engine.dispose()
        return {"status": "success", "message": "Proyecto type/estado columns migrated"}
    except Exception:
        temp_engine.dispose()
        logger.exception("migrate-proyecto-types falló")
        return {"status": "error", "message": "Error interno; revisa los logs del servidor"}


@app.post("/api/admin/migrate-niveles-categoria", dependencies=[Depends(require_admin_key)])
def migrate_niveles_categoria():
    """Idempotente: renombra los valores de los enums de nivel a las nuevas
    'Categorías' de diseñador (mapeo por rango). Conserva los datos: ALTER TYPE
    RENAME VALUE solo cambia la etiqueta del enum, no el OID interno, así que las
    filas existentes y los defaults siguen apuntando al mismo valor.
    """
    import os
    from sqlalchemy import text
    from database import make_engine

    # (valor_actual, valor_nuevo) — por rango/posición
    mapping = [
        ("Junior", "Junior Designer"),
        ("Mid", "Designer"),
        ("Senior", "Lead Designer"),
        ("Lead", "Expert Designer"),
        ("Director", "Chief Designer"),
    ]
    enums = ["nivel_seniority_enum", "nivel_requerido_enum"]

    db_url = os.environ.get("DATABASE_URL", "postgresql://localhost/exd_control")
    temp_engine = make_engine(db_url)
    cambios = []
    try:
        with temp_engine.begin() as conn:
            for enum in enums:
                labels = set(conn.execute(text(
                    "SELECT e.enumlabel FROM pg_enum e "
                    "JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = :n"
                ), {"n": enum}).scalars().all())
                for old, new in mapping:
                    # Solo renombra si el viejo aún existe y el nuevo no (idempotente).
                    # Valores controlados (lista fija), no hay riesgo de inyección.
                    if old in labels and new not in labels:
                        conn.execute(text(f"ALTER TYPE {enum} RENAME VALUE '{old}' TO '{new}'"))
                        cambios.append(f"{enum}: '{old}' → '{new}'")
        return {"status": "success", "cambios": cambios, "total": len(cambios)}
    except Exception:
        logger.exception("migrate-niveles-categoria falló")
        return {"status": "error", "message": "Error interno; revisa los logs del servidor"}
    finally:
        temp_engine.dispose()


@app.post("/api/admin/migrate-add-manager-nivel", dependencies=[Depends(require_admin_key)])
def migrate_add_manager_nivel():
    """Idempotente: agrega el valor 'Manager' al enum `nivel_seniority_enum`
    en Postgres. SQLAlchemy no altera enums existentes automáticamente, por lo
    que este paso es necesario tras agregar 'Manager' a models.py/schemas.py.
    """
    import os
    from sqlalchemy import text
    from database import make_engine

    db_url = os.environ.get("DATABASE_URL", "postgresql://localhost/exd_control")
    temp_engine = make_engine(db_url)
    try:
        with temp_engine.begin() as conn:
            conn.execute(text(
                "ALTER TYPE nivel_seniority_enum ADD VALUE IF NOT EXISTS 'Manager'"
            ))
        return {"status": "success", "message": "'Manager' agregado a nivel_seniority_enum"}
    except Exception:
        logger.exception("migrate-add-manager-nivel falló")
        return {"status": "error", "message": "Error interno; revisa los logs del servidor"}
    finally:
        temp_engine.dispose()


@app.post("/api/admin/migrate-hitos-log", dependencies=[Depends(require_admin_key)])
def migrate_hitos_log():
    """Idempotente: crea la tabla `hitos_log` (y sus enums) si no existe.

    Soporta la trazabilidad de hitos/acciones por proyecto. Seguro de llamar
    múltiples veces (create_all usa CREATE TABLE IF NOT EXISTS).
    """
    import os
    from database import make_engine

    db_url = os.environ.get("DATABASE_URL", "postgresql://localhost/exd_control")
    temp_engine = make_engine(db_url)
    try:
        Base.metadata.create_all(bind=temp_engine, tables=[models.HitoLog.__table__])
        return {"status": "success", "message": "Tabla hitos_log creada/verificada"}
    except Exception:
        logger.exception("migrate-hitos-log falló")
        return {"status": "error", "message": "Error interno; revisa los logs del servidor"}
    finally:
        temp_engine.dispose()


@app.post("/api/admin/migrate-ofertas-valor", dependencies=[Depends(require_admin_key)])
def migrate_ofertas_valor():
    """Crea y siembra el catálogo de ofertas sin perder asignaciones existentes.

    Reglas:
    - Conserva todas las ofertas reales ya asignadas a personas.
    - Corrige únicamente aliases/typos conocidos.
    - "Todas" no es una oferta: se convierte en NULL.
    - Crea las 7 ofertas oficiales si faltan.
    - Las ofertas reales adicionales encontradas en personas también se preservan.
    - No sobreescribe ofertas ya existentes al volver a ejecutar la migración.
    """
    import re
    import unicodedata
    from sqlalchemy import func
    from database import SessionLocal

    def _slugify(texto: str) -> str:
        nfkd = unicodedata.normalize("NFKD", texto or "")
        ascii_only = "".join(
            c for c in nfkd if not unicodedata.combining(c)
        )
        slug = re.sub(r"[^a-z0-9]+", "-", ascii_only.lower()).strip("-")
        return slug or "oferta"

    def _id_unico(db, nombre: str) -> str:
        base_id = _slugify(nombre)
        oferta_id = base_id
        suffix = 2

        while db.query(models.OfertaValor).filter(
            models.OfertaValor.id == oferta_id
        ).first():
            oferta_id = f"{base_id}-{suffix}"
            suffix += 1

        return oferta_id

    db = None

    responsables_oficiales = {
        "Creative Design": "emp-259091",
        "Experience Optimization & Martech": "emp-259091",
        "Experience Design & Research": "emp-172741",
        "X-Reality": "emp-114556",
        "Conversational AI & VoiceBot": "emp-229913",
        "Digital Experiences Platforms": "emp-125193",
        "Mobile Platforms": "emp-125193",
    }

    aliases = {
        "Experience Optimizatión & Martech": "Experience Optimization & Martech",
        "Digital Experiences Plataforms": "Digital Experiences Platforms",
        "Mobile Plataform": "Mobile Platforms",
        "Mobile Platform": "Mobile Platforms",
    }

    try:
        # Usa exactamente el mismo engine configurado que ya utiliza FastAPI.
        # Así respetamos DATABASE_URL/.env y evitamos caer en localhost.
        Base.metadata.create_all(
            bind=engine,
            tables=[models.OfertaValor.__table__],
        )

        db = SessionLocal()

        # 1) Verifica que existan los responsables oficiales.
        ids_requeridos = set(responsables_oficiales.values())
        ids_existentes = {
            persona.id
            for persona in db.query(models.Persona).filter(
                models.Persona.id.in_(ids_requeridos)
            ).all()
        }

        faltantes = sorted(ids_requeridos - ids_existentes)

        if faltantes:
            return {
                "status": "error",
                "message": "Faltan responsables requeridos para crear el catálogo.",
                "persona_ids_faltantes": faltantes,
            }

        # 2) Corrige solo aliases conocidos, preservando las asignaciones.
        correcciones_alias = 0

        for anterior, correcto in aliases.items():
            correcciones_alias += (
                db.query(models.Persona)
                .filter(models.Persona.oferta_valor == anterior)
                .update(
                    {models.Persona.oferta_valor: correcto},
                    synchronize_session=False,
                )
            )

        # 3) "Todas" deja de existir como dato real.
        todas_limpiadas = (
            db.query(models.Persona)
            .filter(func.lower(models.Persona.oferta_valor) == "todas")
            .update(
                {models.Persona.oferta_valor: None},
                synchronize_session=False,
            )
        )

        db.flush()

        # 4) Descubre todas las ofertas reales que YA existen en personas.
        nombres_existentes = {
            nombre.strip()
            for (nombre,) in db.query(models.Persona.oferta_valor)
            .filter(models.Persona.oferta_valor.isnot(None))
            .distinct()
            .all()
            if nombre and nombre.strip()
        }

        # 5) Asegura además las 7 ofertas oficiales, aunque hoy no tengan personas.
        nombres_catalogo = nombres_existentes | set(responsables_oficiales.keys())

        agregadas = []

        for nombre in sorted(nombres_catalogo):
            existente = (
                db.query(models.OfertaValor)
                .filter(func.lower(models.OfertaValor.nombre) == nombre.lower())
                .first()
            )

            if existente:
                continue

            responsable_id = responsables_oficiales.get(nombre)

            nueva = models.OfertaValor(
                id=_id_unico(db, nombre),
                nombre=nombre,
                responsable_persona_id=responsable_id,
                activa=True,
            )
            db.add(nueva)
            agregadas.append(nombre)

        db.flush()

        # 6) Para ofertas oficiales ya existentes pero todavía sin responsable,
        # completa el responsable una sola vez. No pisa futuras ediciones.
        responsables_completados = []

        for nombre, responsable_id in responsables_oficiales.items():
            oferta = (
                db.query(models.OfertaValor)
                .filter(func.lower(models.OfertaValor.nombre) == nombre.lower())
                .first()
            )

            if oferta and not oferta.responsable_persona_id:
                oferta.responsable_persona_id = responsable_id
                responsables_completados.append(nombre)

        db.flush()

        # 7) Sincroniza el campo histórico Persona.responsable solamente para
        # ofertas que tengan un responsable oficial/configurado.
        personas_responsable_sincronizado = 0

        for oferta in db.query(models.OfertaValor).all():
            if not oferta.responsable_persona_id:
                continue

            responsable = (
                db.query(models.Persona)
                .filter(models.Persona.id == oferta.responsable_persona_id)
                .first()
            )

            if not responsable:
                continue

            personas_responsable_sincronizado += (
                db.query(models.Persona)
                .filter(models.Persona.oferta_valor == oferta.nombre)
                .update(
                    {models.Persona.responsable: responsable.nombre},
                    synchronize_session=False,
                )
            )

        db.commit()

        return {
            "status": "success",
            "total_ofertas": db.query(models.OfertaValor).count(),
            "ofertas_agregadas": agregadas,
            "responsables_completados": responsables_completados,
            "personas_alias_corregido": correcciones_alias,
            "personas_todas_convertidas_a_sin_asignar": todas_limpiadas,
            "personas_responsable_sincronizado": personas_responsable_sincronizado,
        }
    except Exception:
        if db is not None:
            db.rollback()
        logger.exception("migrate-ofertas-valor falló")
        return {
            "status": "error",
            "message": "Error interno; revisa los logs del servidor",
        }
    finally:
        if db is not None:
            db.close()


@app.get("/api/dashboard/summary", dependencies=[Depends(require_api_key)])
def dashboard_summary(db=None):
    """Quick stats para el dashboard principal."""
    from database import SessionLocal
    from sqlalchemy import func
    from datetime import date, timedelta
    import models

    db = SessionLocal()
    try:
        total_personas = db.query(func.count(models.Persona.id)).scalar()
        asignaciones_activas = db.query(func.count(models.Asignacion.id)).filter(
            models.Asignacion.estado == "active"
        ).scalar()
        proyectos_activos = db.query(func.count(models.Proyecto.id)).scalar()
        oportunidades_abiertas = db.query(func.count(models.Oportunidad.id)).filter(
            models.Oportunidad.status.in_(["opportunity", "approved", "bidding"])
        ).scalar()

        # Liberaciones próximas (14 días)
        hoy = date.today()
        limite = hoy + timedelta(days=14)
        liberaciones = db.query(models.Asignacion).filter(
            models.Asignacion.estado == "active",
            models.Asignacion.fecha_liberacion >= hoy,
            models.Asignacion.fecha_liberacion <= limite,
        ).count()

        # At risk
        at_risk = db.query(func.count(models.Proyecto.id)).filter(
            models.Proyecto.health.in_(["at_risk", "blocked"])
        ).scalar()

        return {
            "total_personas": total_personas,
            "asignaciones_activas": asignaciones_activas,
            "proyectos_activos": proyectos_activos,
            "oportunidades_abiertas": oportunidades_abiertas,
            "liberaciones_proximas": liberaciones,
            "proyectos_at_risk": at_risk,
        }
    finally:
        db.close()


if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=settings.DEBUG)
