from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
import models, schemas
from datetime import date

router = APIRouter(prefix="/oportunidades", tags=["oportunidades"])


@router.get("/", response_model=List[schemas.OportunidadOut])
def list_oportunidades(
    status: Optional[str] = Query(None),
    nivel: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    q = db.query(models.Oportunidad)
    if status:
        q = q.filter(models.Oportunidad.status == status)
    if nivel:
        q = q.filter(models.Oportunidad.nivel_requerido == nivel)
    return q.order_by(models.Oportunidad.timeline_start).all()


@router.get("/{oportunidad_id}", response_model=schemas.OportunidadOut)
def get_oportunidad(oportunidad_id: str, db: Session = Depends(get_db)):
    o = db.query(models.Oportunidad).filter(models.Oportunidad.id == oportunidad_id).first()
    if not o:
        raise HTTPException(status_code=404, detail="Oportunidad no encontrada")
    return o


@router.post("/", response_model=schemas.OportunidadOut, status_code=201)
def create_oportunidad(data: schemas.OportunidadCreate, db: Session = Depends(get_db)):
    oportunidad = models.Oportunidad(**data.model_dump())
    db.add(oportunidad)
    db.commit()
    db.refresh(oportunidad)
    return oportunidad


@router.put("/{oportunidad_id}", response_model=schemas.OportunidadOut)
def update_oportunidad(oportunidad_id: str, data: schemas.OportunidadUpdate, db: Session = Depends(get_db)):
    o = db.query(models.Oportunidad).filter(models.Oportunidad.id == oportunidad_id).first()
    if not o:
        raise HTTPException(status_code=404, detail="Oportunidad no encontrada")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(o, field, value)
    db.commit()
    db.refresh(o)
    return o


@router.delete("/{oportunidad_id}", status_code=204)
def delete_oportunidad(oportunidad_id: str, db: Session = Depends(get_db)):
    o = db.query(models.Oportunidad).filter(models.Oportunidad.id == oportunidad_id).first()
    if not o:
        raise HTTPException(status_code=404, detail="Oportunidad no encontrada")
    db.delete(o)
    db.commit()


@router.post("/{oportunidad_id}/match")
def match_personas(oportunidad_id: str, db: Session = Depends(get_db)):
    """Sugiere las personas más adecuadas para una oportunidad."""
    o = db.query(models.Oportunidad).filter(models.Oportunidad.id == oportunidad_id).first()
    if not o:
        raise HTTPException(status_code=404, detail="Oportunidad no encontrada")

    # Personas disponibles (sin asignación activa vigente)
    hoy = date.today()
    asignadas = db.query(models.Asignacion.persona_id).filter(
        models.Asignacion.estado == "active",
        (models.Asignacion.fecha_liberacion == None) |
        (models.Asignacion.fecha_liberacion > hoy)
    ).all()
    ids_asignadas = {a[0] for a in asignadas}

    candidatos = db.query(models.Persona).filter(
        models.Persona.id.not_in(ids_asignadas)
    ).all()

    # Filtrar por nivel de pirámide mínimo si se especificó.
    # El orden va desde el nivel inicial al nivel más alto.
    if o.nivel_requerido:
        niveles = [
            "Junior",
            "Professional",
            "Leader",
            "Expert",
            "Evangelist",
            "Chief",
            "Manager",
            "Director",
        ]
        nivel_requerido = (
            o.nivel_requerido.value
            if hasattr(o.nivel_requerido, "value")
            else str(o.nivel_requerido)
        )
        nivel_min = niveles.index(nivel_requerido)
        candidatos = [
            p
            for p in candidatos
            if p.nivel_piramide in niveles
            and niveles.index(p.nivel_piramide) >= nivel_min
        ]

    # Score: cuántas competencias requeridas tiene.
    competencias = o.competencias_requeridas or []

    def score(p):
        habilidades = p.habilidades or []
        return sum(1 for c in competencias if c in habilidades)

    candidatos_sorted = sorted(candidatos, key=score, reverse=True)[:5]

    return [
        {
            "persona_id": p.id,
            "nombre": p.nombre,
            "nivel": p.nivel_piramide,
            "habilidades": p.habilidades,
            "match_score": score(p),
            "max_score": len(competencias),
        }
        for p in candidatos_sorted
    ]
