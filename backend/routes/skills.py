from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
import re
import unicodedata
from database import get_db
import models, schemas

router = APIRouter(prefix="/skills", tags=["skills"])


def _slugify(text: str) -> str:
    """Genera un slug minúsculas-con-guiones a partir del nombre."""
    if not text:
        return ""
    # Quita acentos
    nfkd = unicodedata.normalize("NFKD", text)
    ascii_only = "".join(c for c in nfkd if not unicodedata.combining(c))
    # A minúsculas, espacios y caracteres no-alfanuméricos -> guión, comprime guiones
    s = ascii_only.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "skill"


def _personas_count(db: Session, skill_nombre: str) -> int:
    """Cuenta personas que tienen `skill_nombre` en su array de habilidades."""
    # Postgres JSONB: usar el operador ? para ver si contiene el string
    # SQLAlchemy: cast a text + LIKE como fallback portable
    personas = db.query(models.Persona).all()
    return sum(1 for p in personas if skill_nombre in (p.habilidades or []))


@router.get("/", response_model=List[schemas.SkillOut])
def list_skills(db: Session = Depends(get_db)):
    """Lista todas las skills del catálogo, con conteo de uso."""
    skills = db.query(models.Skill).order_by(
        models.Skill.categoria.nullslast(), models.Skill.nombre
    ).all()
    # Calcular personas_count en una sola pasada por la tabla personas
    personas = db.query(models.Persona).all()
    use_counts = {}
    for p in personas:
        for hab in (p.habilidades or []):
            use_counts[hab] = use_counts.get(hab, 0) + 1

    out = []
    for s in skills:
        s_dict = {
            "id": s.id, "nombre": s.nombre, "categoria": s.categoria,
            "descripcion": s.descripcion, "activa": s.activa,
            "created_at": s.created_at, "updated_at": s.updated_at,
            "personas_count": use_counts.get(s.nombre, 0),
        }
        out.append(s_dict)
    return out


@router.get("/categorias", response_model=List[str])
def list_categorias(db: Session = Depends(get_db)):
    """Devuelve las categorías existentes (para autocompletar en el form)."""
    rows = db.query(models.Skill.categoria).filter(models.Skill.categoria.isnot(None)).distinct().all()
    return sorted([r[0] for r in rows])


# ── Gestión de categorías (operaciones masivas) ──────────────────────────────
# OJO: estas rutas literales deben ir ANTES de las rutas con `/{skill_id}` para
# que el router no interprete "categorias" como un skill_id.

@router.put("/categorias")
def rename_categoria(data: schemas.CategoriaRename, db: Session = Depends(get_db)):
    """Renombra una categoría en todas sus skills. Si `nuevo` ya existe, fusiona."""
    actual = (data.actual or "").strip()
    nuevo = (data.nuevo or "").strip()
    if not nuevo:
        raise HTTPException(status_code=400, detail="El nuevo nombre no puede estar vacío")
    if actual == nuevo:
        raise HTTPException(status_code=400, detail="El nombre nuevo es igual al actual")

    afectadas = db.query(models.Skill).filter(models.Skill.categoria == actual).all()
    if not afectadas:
        raise HTTPException(status_code=404, detail=f"No hay capacidades en la categoría '{actual}'")

    # ¿`nuevo` ya tenía skills? entonces es una fusión.
    fusion = db.query(models.Skill).filter(models.Skill.categoria == nuevo).count() > 0

    for s in afectadas:
        s.categoria = nuevo
    db.commit()
    return {"actualizadas": len(afectadas), "categoria": nuevo, "fusionada": fusion}


@router.delete("/categorias", status_code=200)
def delete_categoria(
    nombre: str = Query(..., description="Categoría a eliminar"),
    db: Session = Depends(get_db),
):
    """
    Elimina una categoría y todas las capacidades que pertenecen a ella.

    Antes de borrar las capacidades:
    - elimina sus relaciones en `persona_skills`;
    - limpia sus nombres del campo histórico `personas.habilidades`.

    La operación se ejecuta en una sola transacción.
    """
    nombre = (nombre or "").strip()

    afectadas = (
        db.query(models.Skill)
        .filter(models.Skill.categoria == nombre)
        .all()
    )
    if not afectadas:
        raise HTTPException(
            status_code=404,
            detail=f"No hay capacidades en la categoría '{nombre}'",
        )

    skill_ids = [s.id for s in afectadas]
    skill_nombres = {s.nombre for s in afectadas}

    try:
        # Limpiar relaciones normalizadas persona <-> capacidad.
        db.query(models.PersonaSkill).filter(
            models.PersonaSkill.skill_id.in_(skill_ids)
        ).delete(synchronize_session=False)

        # Limpiar el campo histórico JSON de capacidades en personas.
        personas = db.query(models.Persona).all()
        for persona in personas:
            habilidades = persona.habilidades or []
            nuevas_habilidades = [
                habilidad
                for habilidad in habilidades
                if habilidad not in skill_nombres
            ]
            if nuevas_habilidades != habilidades:
                persona.habilidades = nuevas_habilidades

        # Borrar todas las capacidades de la categoría.
        db.query(models.Skill).filter(
            models.Skill.id.in_(skill_ids)
        ).delete(synchronize_session=False)

        db.commit()
    except Exception:
        db.rollback()
        raise

    return {
        "categoria": nombre,
        "capacidades_eliminadas": len(afectadas),
    }


@router.post("/", response_model=schemas.SkillOut, status_code=201)
def create_skill(data: schemas.SkillCreate, db: Session = Depends(get_db)):
    """Crea una skill nueva. Si no se da `id`, se genera del nombre."""
    skill_id = data.id or _slugify(data.nombre)
    if not skill_id:
        raise HTTPException(status_code=400, detail="Nombre inválido")

    # ID único
    if db.query(models.Skill).filter(models.Skill.id == skill_id).first():
        raise HTTPException(status_code=400, detail=f"Ya existe una capacidad con id '{skill_id}'")
    # Nombre único
    if db.query(models.Skill).filter(models.Skill.nombre == data.nombre).first():
        raise HTTPException(status_code=400, detail=f"Ya existe una capacidad con nombre '{data.nombre}'")

    skill = models.Skill(
        id=skill_id,
        nombre=data.nombre,
        categoria=data.categoria,
        descripcion=data.descripcion,
        activa=data.activa if data.activa is not None else True,
    )
    db.add(skill)
    db.commit()
    db.refresh(skill)
    return {**skill.__dict__, "personas_count": 0}


@router.put("/{skill_id}", response_model=schemas.SkillOut)
def update_skill(skill_id: str, data: schemas.SkillUpdate, db: Session = Depends(get_db)):
    """
    Edita una skill. Si cambia el nombre, propaga el cambio a `personas.habilidades`
    para mantener consistencia.
    """
    skill = db.query(models.Skill).filter(models.Skill.id == skill_id).first()
    if not skill:
        raise HTTPException(status_code=404, detail="Capacidad no encontrada")

    payload = data.model_dump(exclude_unset=True)

    # Si renombra: validar unicidad y propagar a personas
    if "nombre" in payload and payload["nombre"] != skill.nombre:
        nuevo = payload["nombre"]
        existe = db.query(models.Skill).filter(
            models.Skill.nombre == nuevo, models.Skill.id != skill.id
        ).first()
        if existe:
            raise HTTPException(status_code=400, detail=f"Ya existe una capacidad con nombre '{nuevo}'")
        # Propagar a personas
        viejo = skill.nombre
        personas = db.query(models.Persona).all()
        for p in personas:
            habs = p.habilidades or []
            if viejo in habs:
                p.habilidades = [nuevo if h == viejo else h for h in habs]

    for field, value in payload.items():
        setattr(skill, field, value)

    db.commit()
    db.refresh(skill)
    return {**skill.__dict__, "personas_count": _personas_count(db, skill.nombre)}


@router.delete("/{skill_id}", status_code=204)
def delete_skill(skill_id: str, db: Session = Depends(get_db)):
    """
    Borra una skill SI no está en uso. Si está en uso, error 409.
    Para "ocultar" una skill en uso, edita y pon `activa=false`.
    """
    skill = db.query(models.Skill).filter(models.Skill.id == skill_id).first()
    if not skill:
        raise HTTPException(status_code=404, detail="Capacidad no encontrada")

    count = _personas_count(db, skill.nombre)
    if count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"La capacidad está en uso por {count} persona(s). Quítala de sus perfiles, o desactívala en lugar de borrarla.",
        )
    db.delete(skill)
    db.commit()
