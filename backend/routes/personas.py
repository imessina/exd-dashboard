import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session
from typing import List, Optional

from database import get_db
import models, schemas

router = APIRouter(prefix="/personas", tags=["personas"])

logger = logging.getLogger("uvicorn.error")


@router.get("/", response_model=List[schemas.PersonaOut])
def list_personas(
    nivel: Optional[str] = Query(None, description="Nivel de pirámide"),
    habilidad: Optional[str] = Query(None),
    oferta_valor: Optional[str] = Query(None, description="Oferta de valor; __sin_asignar__ para valores nulos"),
    db: Session = Depends(get_db),
):
    q = db.query(models.Persona)

    if nivel:
        # La primera condición es la nueva fuente oficial. La segunda mantiene
        # compatibilidad mientras todavía existan personas antiguas.
        q = q.filter(
            or_(
                models.Persona.nivel_piramide == nivel,
                models.Persona.nivel_seniority == nivel,
            )
        )

    if oferta_valor == "__sin_asignar__":
        q = q.filter(models.Persona.oferta_valor.is_(None))
    elif oferta_valor:
        q = q.filter(models.Persona.oferta_valor == oferta_valor)

    personas = q.order_by(models.Persona.nombre).all()

    # Filtro histórico. Cuando carguemos las skills por nivel, esta búsqueda
    # pasará a consultar persona_skills.
    if habilidad:
        personas = [
            persona
            for persona in personas
            if habilidad in (persona.habilidades or [])
        ]

    return personas


@router.get("/{persona_id}", response_model=schemas.PersonaOut)
def get_persona(persona_id: str, db: Session = Depends(get_db)):
    persona = (
        db.query(models.Persona)
        .filter(models.Persona.id == persona_id)
        .first()
    )
    if not persona:
        raise HTTPException(status_code=404, detail="Persona no encontrada")
    return persona


@router.post("/", response_model=schemas.PersonaOut, status_code=201)
def create_persona(data: schemas.PersonaCreate, db: Session = Depends(get_db)):
    existing = (
        db.query(models.Persona)
        .filter(models.Persona.id == data.id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="ID ya existe")

    employee_exists = None
    if data.numero_empleado:
        employee_exists = (
            db.query(models.Persona)
            .filter(models.Persona.numero_empleado == data.numero_empleado)
            .first()
        )
    if employee_exists:
        raise HTTPException(status_code=400, detail="Número de empleado ya existe")

    persona = models.Persona(**data.model_dump())
    db.add(persona)
    db.commit()
    db.refresh(persona)
    return persona


@router.put("/{persona_id}", response_model=schemas.PersonaOut)
def update_persona(
    persona_id: str,
    data: schemas.PersonaUpdate,
    db: Session = Depends(get_db),
):
    persona = (
        db.query(models.Persona)
        .filter(models.Persona.id == persona_id)
        .first()
    )
    if not persona:
        raise HTTPException(status_code=404, detail="Persona no encontrada")

    values = data.model_dump(exclude_unset=True)

    numero_empleado = values.get("numero_empleado")
    if numero_empleado:
        duplicate = (
            db.query(models.Persona)
            .filter(
                models.Persona.numero_empleado == numero_empleado,
                models.Persona.id != persona_id,
            )
            .first()
        )
        if duplicate:
            raise HTTPException(status_code=400, detail="Número de empleado ya existe")

    for field, value in values.items():
        setattr(persona, field, value)

    db.commit()
    db.refresh(persona)
    return persona


@router.get("/{persona_id}/skills", response_model=list[schemas.PersonaSkillOut])
def get_persona_skills(persona_id: str, db: Session = Depends(get_db)):
    persona = db.query(models.Persona).filter(models.Persona.id == persona_id).first()
    if not persona:
        raise HTTPException(status_code=404, detail="Persona no encontrada")

    rows = (
        db.query(models.PersonaSkill, models.Skill)
        .join(models.Skill, models.Skill.id == models.PersonaSkill.skill_id)
        .filter(models.PersonaSkill.persona_id == persona_id)
        .order_by(models.Skill.nombre)
        .all()
    )

    return [
        {
            "skill_id": persona_skill.skill_id,
            "nombre": skill.nombre,
            "categoria": skill.categoria,
            "nivel": persona_skill.nivel,
        }
        for persona_skill, skill in rows
    ]


@router.put("/{persona_id}/skills", response_model=list[schemas.PersonaSkillOut])
def replace_persona_skills(
    persona_id: str,
    data: schemas.PersonaSkillsReplace,
    db: Session = Depends(get_db),
):
    logger.info(
        "[SKILLS] Inicio guardado | persona_id=%s | cantidad=%s",
        persona_id,
        len(data.skills),
    )
    logger.info(
        "[SKILLS] Payload recibido | persona_id=%s | skills=%s",
        persona_id,
        [
            {
                "skill_id": item.skill_id,
                "nivel": item.nivel,
            }
            for item in data.skills
        ],
    )

    persona = db.query(models.Persona).filter(models.Persona.id == persona_id).first()
    if not persona:
        logger.warning(
            "[SKILLS] Persona no encontrada | persona_id=%s",
            persona_id,
        )
        raise HTTPException(status_code=404, detail="Persona no encontrada")

    skill_ids = [item.skill_id for item in data.skills]
    if len(skill_ids) != len(set(skill_ids)):
        raise HTTPException(status_code=400, detail="No se permiten capacidades duplicadas")

    skills = db.query(models.Skill).filter(models.Skill.id.in_(skill_ids)).all() if skill_ids else []
    skills_by_id = {skill.id: skill for skill in skills}
    faltantes = sorted(set(skill_ids) - set(skills_by_id))
    if faltantes:
        raise HTTPException(
            status_code=400,
            detail=f"Capacidades inexistentes: {', '.join(faltantes)}",
        )

    db.query(models.PersonaSkill).filter(
        models.PersonaSkill.persona_id == persona_id
    ).delete(synchronize_session=False)

    for item in data.skills:
        db.add(
            models.PersonaSkill(
                persona_id=persona_id,
                skill_id=item.skill_id,
                nivel=item.nivel,
            )
        )

    # Compatibilidad temporal con vistas antiguas: conservar también los nombres.
    persona.habilidades = [skills_by_id[item.skill_id].nombre for item in data.skills]

    try:
        db.commit()

        guardadas = (
            db.query(models.PersonaSkill)
            .filter(models.PersonaSkill.persona_id == persona_id)
            .all()
        )

        logger.info(
            "[SKILLS] Guardado OK | persona_id=%s | cantidad_bd=%s | skills_bd=%s",
            persona_id,
            len(guardadas),
            [
                {
                    "skill_id": item.skill_id,
                    "nivel": item.nivel,
                }
                for item in guardadas
            ],
        )
    except Exception:
        db.rollback()
        logger.exception(
            "[SKILLS] Error guardando skills | persona_id=%s",
            persona_id,
        )
        raise

    return [
        {
            "skill_id": item.skill_id,
            "nombre": skills_by_id[item.skill_id].nombre,
            "categoria": skills_by_id[item.skill_id].categoria,
            "nivel": item.nivel,
        }
        for item in sorted(data.skills, key=lambda x: skills_by_id[x.skill_id].nombre)
    ]


@router.delete("/{persona_id}", status_code=204)
def delete_persona(persona_id: str, db: Session = Depends(get_db)):
    persona = (
        db.query(models.Persona)
        .filter(models.Persona.id == persona_id)
        .first()
    )
    if not persona:
        raise HTTPException(status_code=404, detail="Persona no encontrada")

    try:
        curriculum_ids = [
            curriculum_id
            for (curriculum_id,) in (
                db.query(models.Curriculum.id)
                .filter(models.Curriculum.persona_id == persona_id)
                .all()
            )
        ]

        if curriculum_ids:
            (
                db.query(models.CurriculumExperiencia)
                .filter(
                    models.CurriculumExperiencia.curriculum_id.in_(curriculum_ids)
                )
                .delete(synchronize_session=False)
            )

            (
                db.query(models.Curriculum)
                .filter(models.Curriculum.id.in_(curriculum_ids))
                .delete(synchronize_session=False)
            )

        db.delete(persona)
        db.commit()
    except Exception:
        db.rollback()
        raise
