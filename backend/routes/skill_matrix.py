"""Skill Matrix basada en persona_skills y niveles de dominio 1–5."""
from collections import defaultdict
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
import models

router = APIRouter(prefix="/skill-matrix", tags=["skill-matrix"])
SIN_CATEGORIA = "— Sin categoría —"

CATEGORIAS_SUGERIDAS_ORDEN = [
    "Cloud & DevOps",
    "Data & Analytics",
    "Delivery & Producto",
    "Desarrollo",
    "IA & GenAI",
    "Idioma",
    "Marketing & Creative",
    "Spatial Computing",
    "UX / CX",
]


def _ordenar_categorias(cats: List[str]) -> List[str]:
    sugeridas = [c for c in CATEGORIAS_SUGERIDAS_ORDEN if c in cats]
    sin_cat = [SIN_CATEGORIA] if SIN_CATEGORIA in cats else []
    otras = sorted(
        c for c in cats
        if c not in CATEGORIAS_SUGERIDAS_ORDEN and c != SIN_CATEGORIA
    )
    return sugeridas + otras + sin_cat


@router.get("/")
def get_skill_matrix(
    oferta_valor: Optional[str] = Query(None, description="Oferta de valor; __sin_asignar__ para valores nulos"),
    db: Session = Depends(get_db),
):
    skills = db.query(models.Skill).order_by(models.Skill.nombre).all()
    personas_query = db.query(models.Persona)
    if oferta_valor == "__sin_asignar__":
        personas_query = personas_query.filter(models.Persona.oferta_valor.is_(None))
    elif oferta_valor:
        personas_query = personas_query.filter(models.Persona.oferta_valor == oferta_valor)
    personas = personas_query.order_by(models.Persona.nombre).all()

    persona_by_id = {persona.id: persona for persona in personas}
    persona_ids = list(persona_by_id)
    evaluaciones = (
        db.query(models.PersonaSkill)
        .filter(models.PersonaSkill.persona_id.in_(persona_ids))
        .all()
        if persona_ids
        else []
    )
    evaluaciones_por_skill: Dict[str, list] = defaultdict(list)
    for evaluacion in evaluaciones:
        persona = persona_by_id.get(evaluacion.persona_id)
        if persona:
            evaluaciones_por_skill[evaluacion.skill_id].append((persona, evaluacion.nivel))

    grupos: Dict[str, List[dict]] = defaultdict(list)
    for skill in skills:
        categoria = skill.categoria or SIN_CATEGORIA
        personas_skill = evaluaciones_por_skill.get(skill.id, [])
        distribucion_niveles = {str(nivel): 0 for nivel in range(1, 6)}
        for _, nivel in personas_skill:
            distribucion_niveles[str(nivel)] += 1

        grupos[categoria].append({
            "skill_id": skill.id,
            "nombre": skill.nombre,
            "activa": skill.activa,
            "descripcion": skill.descripcion,
            "personas": [
                {
                    "persona_id": persona.id,
                    "nombre": persona.nombre,
                    "rol": persona.rol,
                    "nivel_piramide": persona.nivel_piramide,
                    "nivel_seniority": persona.nivel_seniority,
                    "nivel": nivel,
                }
                for persona, nivel in personas_skill
            ],
            "distribucion_niveles": distribucion_niveles,
        })

    categorias_orden = _ordenar_categorias(list(grupos.keys()))
    data = {
        categoria: {"categoria": categoria, "skills": grupos[categoria]}
        for categoria in categorias_orden
    }

    skills_sin_personas = sum(
        1 for skill in skills if not evaluaciones_por_skill.get(skill.id)
    )

    return {
        "categorias_orden": categorias_orden,
        "data": data,
        "huerfanas": [],
        "total_personas": len(personas),
        "total_skills_catalogo": len(skills),
        "skills_sin_personas": skills_sin_personas,
        "total_evaluaciones": len(evaluaciones),
    }


@router.get("/gaps")
def get_skill_gaps(db: Session = Depends(get_db)):
    skills = db.query(models.Skill).filter(models.Skill.activa == True).all()
    counts: Dict[str, int] = defaultdict(int)
    for evaluacion in db.query(models.PersonaSkill).all():
        counts[evaluacion.skill_id] += 1

    gaps = []
    for skill in skills:
        cantidad = counts.get(skill.id, 0)
        if cantidad <= 1:
            gaps.append({
                "skill_id": skill.id,
                "nombre": skill.nombre,
                "categoria": skill.categoria,
                "personas_count": cantidad,
                "severidad": "alta" if cantidad == 0 else "media",
            })
    return sorted(gaps, key=lambda item: (item["personas_count"], item["nombre"]))
