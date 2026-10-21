"""Consulta proyectos y exige un usuario editor activo en todas las modificaciones."""
from fastapi import APIRouter, Depends, HTTPException, Query
from auth import require_editor_or_higher
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
import models, schemas

router = APIRouter(prefix="/proyectos", tags=["proyectos"])


@router.get("/", response_model=List[schemas.ProyectoOut])
def list_proyectos(
    fase: Optional[str] = Query(None),
    health: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    q = db.query(models.Proyecto)
    if fase:
        q = q.filter(models.Proyecto.fase == fase)
    if health:
        q = q.filter(models.Proyecto.health == health)
    return q.order_by(models.Proyecto.nombre).all()


@router.get("/{proyecto_id}", response_model=schemas.ProyectoOut)
def get_proyecto(proyecto_id: str, db: Session = Depends(get_db)):
    p = db.query(models.Proyecto).filter(models.Proyecto.id == proyecto_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    return p


@router.post("/", response_model=schemas.ProyectoOut, status_code=201, dependencies=[Depends(require_editor_or_higher)])
def create_proyecto(data: schemas.ProyectoCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Proyecto).filter(models.Proyecto.id == data.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="ID ya existe")
    proyecto = models.Proyecto(**data.model_dump())
    db.add(proyecto)
    db.commit()
    db.refresh(proyecto)
    return proyecto


@router.put("/{proyecto_id}", response_model=schemas.ProyectoOut, dependencies=[Depends(require_editor_or_higher)])
def update_proyecto(proyecto_id: str, data: schemas.ProyectoUpdate, db: Session = Depends(get_db)):
    p = db.query(models.Proyecto).filter(models.Proyecto.id == proyecto_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    fields = data.model_dump(exclude_unset=True)

    # Registro automático: si se declara un próximo hito nuevo (no vacío y
    # distinto al actual), se guarda una entrada en el log para trazabilidad.
    nuevo_hito = fields.get("next_milestone")
    if "next_milestone" in fields and nuevo_hito and nuevo_hito.strip() != (p.next_milestone or "").strip():
        db.add(models.HitoLog(
            proyecto_id=p.id,
            descripcion=nuevo_hito.strip(),
            tipo="hito",
            estado="pendiente",
        ))

    for field, value in fields.items():
        setattr(p, field, value)
    db.commit()
    db.refresh(p)
    return p


@router.get("/{proyecto_id}/hitos", response_model=List[schemas.HitoLogOut])
def list_hitos(proyecto_id: str, db: Session = Depends(get_db)):
    """Log histórico de hitos/acciones del proyecto, más reciente primero."""
    p = db.query(models.Proyecto).filter(models.Proyecto.id == proyecto_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    return (
        db.query(models.HitoLog)
        .filter(models.HitoLog.proyecto_id == proyecto_id)
        .order_by(models.HitoLog.created_at.desc())
        .all()
    )


@router.patch("/{proyecto_id}/hitos/{hito_id}", response_model=schemas.HitoLogOut, dependencies=[Depends(require_editor_or_higher)])
def update_hito(proyecto_id: str, hito_id: str, data: schemas.HitoUpdate, db: Session = Depends(get_db)):
    """Gestiona una entrada del log: marcar cumplido/pendiente, reclasificar, editar."""
    h = (
        db.query(models.HitoLog)
        .filter(models.HitoLog.id == hito_id, models.HitoLog.proyecto_id == proyecto_id)
        .first()
    )
    if not h:
        raise HTTPException(status_code=404, detail="Hito no encontrado")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(h, field, value)
    db.commit()
    db.refresh(h)
    return h


@router.delete("/{proyecto_id}", status_code=204, dependencies=[Depends(require_editor_or_higher)])
def delete_proyecto(proyecto_id: str, db: Session = Depends(get_db)):
    p = db.query(models.Proyecto).filter(models.Proyecto.id == proyecto_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    db.delete(p)
    db.commit()
