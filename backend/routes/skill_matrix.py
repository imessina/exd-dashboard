"""Skill Matrix basada en persona_skills y niveles de dominio 1–5."""

from collections import defaultdict
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
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
        c
        for c in cats
        if c not in CATEGORIAS_SUGERIDAS_ORDEN and c != SIN_CATEGORIA
    )

    return sugeridas + otras + sin_cat


@router.get("/")
def get_skill_matrix(
    oferta_valor: Optional[str] = Query(
        None,
        description="Oferta de valor; __sin_asignar__ para valores nulos",
    ),
    db: Session = Depends(get_db),
):
    skills = db.query(models.Skill).order_by(models.Skill.nombre).all()

    personas_query = db.query(models.Persona)

    if oferta_valor == "__sin_asignar__":
        personas_query = personas_query.filter(
            models.Persona.oferta_valor.is_(None)
        )
    elif oferta_valor:
        personas_query = personas_query.filter(
            models.Persona.oferta_valor == oferta_valor
        )

    personas = personas_query.order_by(models.Persona.nombre).all()

    persona_by_id = {
        persona.id: persona
        for persona in personas
    }

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
            evaluaciones_por_skill[evaluacion.skill_id].append(
                (persona, evaluacion.nivel)
            )

    grupos: Dict[str, List[dict]] = defaultdict(list)

    for skill in skills:
        categoria = skill.categoria or SIN_CATEGORIA
        personas_skill = evaluaciones_por_skill.get(skill.id, [])

        distribucion_niveles = {
            str(nivel): 0
            for nivel in range(1, 6)
        }

        for _, nivel in personas_skill:
            distribucion_niveles[str(nivel)] += 1

        grupos[categoria].append(
            {
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
            }
        )

    categorias_orden = _ordenar_categorias(list(grupos.keys()))

    data = {
        categoria: {
            "categoria": categoria,
            "skills": grupos[categoria],
        }
        for categoria in categorias_orden
    }

    skills_sin_personas = sum(
        1
        for skill in skills
        if not evaluaciones_por_skill.get(skill.id)
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


@router.get("/search")
def buscar_personas_por_capacidad(
    skill: str = Query(
        ...,
        min_length=1,
        description="Nombre exacto de la capacidad, sin distinguir mayúsculas/minúsculas",
    ),
    nivel_minimo: int = Query(
        1,
        ge=1,
        le=5,
        description="Nivel mínimo de dominio requerido, entre 1 y 5",
    ),
    db: Session = Depends(get_db),
):
    """
    Busca en toda la base de datos las personas que tienen una capacidad
    determinada con un nivel igual o superior al solicitado.

    La fuente de verdad es persona_skills.
    """

    skill_buscada = skill.strip()

    capacidad = (
        db.query(models.Skill)
        .filter(
            func.lower(models.Skill.nombre)
            == skill_buscada.lower()
        )
        .first()
    )

    if capacidad is None:
        sugerencias = (
            db.query(models.Skill)
            .filter(
                func.lower(models.Skill.nombre).contains(
                    skill_buscada.lower()
                )
            )
            .order_by(models.Skill.nombre)
            .limit(10)
            .all()
        )

        return {
            "skill_encontrada": False,
            "consulta": skill_buscada,
            "nivel_minimo": nivel_minimo,
            "total": 0,
            "personas": [],
            "sugerencias": [
                {
                    "skill_id": item.id,
                    "nombre": item.nombre,
                    "categoria": item.categoria,
                }
                for item in sugerencias
            ],
        }

    resultados = (
        db.query(
            models.Persona,
            models.PersonaSkill.nivel,
        )
        .join(
            models.PersonaSkill,
            models.PersonaSkill.persona_id == models.Persona.id,
        )
        .filter(
            models.PersonaSkill.skill_id == capacidad.id,
            models.PersonaSkill.nivel >= nivel_minimo,
        )
        .order_by(
            models.PersonaSkill.nivel.desc(),
            models.Persona.nombre.asc(),
        )
        .all()
    )

    personas = [
        {
            "persona_id": persona.id,
            "nombre": persona.nombre,
            "rol": persona.rol,
            "nivel_piramide": persona.nivel_piramide,
            "nivel_seniority": persona.nivel_seniority,
            "oferta_valor": persona.oferta_valor,
            "nivel_capacidad": nivel,
        }
        for persona, nivel in resultados
    ]

    return {
        "skill_encontrada": True,
        "skill": {
            "skill_id": capacidad.id,
            "nombre": capacidad.nombre,
            "categoria": capacidad.categoria,
            "activa": capacidad.activa,
        },
        "nivel_minimo": nivel_minimo,
        "total": len(personas),
        "personas": personas,
        "sugerencias": [],
    }


@router.get("/gaps")
def get_skill_gaps(
    db: Session = Depends(get_db),
):
    skills = (
        db.query(models.Skill)
        .filter(models.Skill.activa == True)
        .all()
    )

    counts: Dict[str, int] = defaultdict(int)

    for evaluacion in db.query(models.PersonaSkill).all():
        counts[evaluacion.skill_id] += 1

    gaps = []

    for skill in skills:
        cantidad = counts.get(skill.id, 0)

        if cantidad <= 1:
            gaps.append(
                {
                    "skill_id": skill.id,
                    "nombre": skill.nombre,
                    "categoria": skill.categoria,
                    "personas_count": cantidad,
                    "severidad": (
                        "alta"
                        if cantidad == 0
                        else "media"
                    ),
                }
            )

    return sorted(
        gaps,
        key=lambda item: (
            item["personas_count"],
            item["nombre"],
        ),
    )