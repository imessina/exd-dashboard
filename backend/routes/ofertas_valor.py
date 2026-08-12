import re
import unicodedata

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db


router = APIRouter(prefix="/ofertas-valor", tags=["Ofertas de valor"])


def _slugify(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", text or "")
    ascii_only = "".join(c for c in nfkd if not unicodedata.combining(c))
    value = re.sub(r"[^a-z0-9]+", "-", ascii_only.lower()).strip("-")
    return value or "oferta"


def _responsable(db: Session, persona_id: str | None):
    if not persona_id:
        return None

    persona = (
        db.query(models.Persona)
        .filter(models.Persona.id == persona_id)
        .first()
    )

    if not persona:
        return None

    return {
        "id": persona.id,
        "nombre": persona.nombre,
        "rol": persona.rol,
        "nivel_piramide": persona.nivel_piramide,
    }


def _personas_count(db: Session, nombre: str) -> int:
    return (
        db.query(func.count(models.Persona.id))
        .filter(models.Persona.oferta_valor == nombre)
        .scalar()
        or 0
    )


def _serialize(db: Session, oferta: models.OfertaValor):
    return {
        "id": oferta.id,
        "nombre": oferta.nombre,
        "responsable_persona_id": oferta.responsable_persona_id,
        "responsable": _responsable(db, oferta.responsable_persona_id),
        "descripcion": oferta.descripcion,
        "activa": oferta.activa,
        "personas_count": _personas_count(db, oferta.nombre),
        "created_at": oferta.created_at,
        "updated_at": oferta.updated_at,
    }


def _validar_responsable(db: Session, persona_id: str | None):
    if not persona_id:
        return None

    persona = (
        db.query(models.Persona)
        .filter(models.Persona.id == persona_id)
        .first()
    )

    if not persona:
        raise HTTPException(
            status_code=400,
            detail="La persona seleccionada como responsable no existe.",
        )

    return persona


def _generar_id_unico(db: Session, nombre: str) -> str:
    base_id = _slugify(nombre)
    oferta_id = base_id
    suffix = 2

    while db.query(models.OfertaValor).filter(
        models.OfertaValor.id == oferta_id
    ).first():
        oferta_id = f"{base_id}-{suffix}"
        suffix += 1

    return oferta_id


@router.get("/", response_model=list[schemas.OfertaValorOut])
def listar_ofertas_valor(
    solo_activas: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    query = db.query(models.OfertaValor)

    if solo_activas:
        query = query.filter(models.OfertaValor.activa.is_(True))

    ofertas = query.order_by(models.OfertaValor.nombre.asc()).all()

    return [_serialize(db, oferta) for oferta in ofertas]


@router.get("/{oferta_id}", response_model=schemas.OfertaValorOut)
def obtener_oferta_valor(
    oferta_id: str,
    db: Session = Depends(get_db),
):
    oferta = (
        db.query(models.OfertaValor)
        .filter(models.OfertaValor.id == oferta_id)
        .first()
    )

    if not oferta:
        raise HTTPException(status_code=404, detail="Oferta de valor no encontrada.")

    return _serialize(db, oferta)


@router.post("/", response_model=schemas.OfertaValorOut, status_code=201)
def crear_oferta_valor(
    payload: schemas.OfertaValorCreate,
    db: Session = Depends(get_db),
):
    nombre = payload.nombre.strip()

    if not nombre:
        raise HTTPException(
            status_code=400,
            detail="El nombre de la oferta de valor es obligatorio.",
        )

    if nombre.lower() == "todas":
        raise HTTPException(
            status_code=400,
            detail='"Todas" es un filtro de la interfaz y no puede crearse como oferta.',
        )

    existente = (
        db.query(models.OfertaValor)
        .filter(func.lower(models.OfertaValor.nombre) == nombre.lower())
        .first()
    )

    if existente:
        raise HTTPException(
            status_code=409,
            detail="Ya existe una oferta de valor con ese nombre.",
        )

    responsable = _validar_responsable(db, payload.responsable_persona_id)

    oferta = models.OfertaValor(
        id=_generar_id_unico(db, nombre),
        nombre=nombre,
        responsable_persona_id=responsable.id if responsable else None,
        descripcion=payload.descripcion.strip() if payload.descripcion else None,
        activa=payload.activa,
    )

    db.add(oferta)
    db.commit()
    db.refresh(oferta)

    return _serialize(db, oferta)


@router.put("/{oferta_id}", response_model=schemas.OfertaValorOut)
def actualizar_oferta_valor(
    oferta_id: str,
    payload: schemas.OfertaValorUpdate,
    db: Session = Depends(get_db),
):
    oferta = (
        db.query(models.OfertaValor)
        .filter(models.OfertaValor.id == oferta_id)
        .first()
    )

    if not oferta:
        raise HTTPException(status_code=404, detail="Oferta de valor no encontrada.")

    cambios = payload.model_dump(exclude_unset=True)
    nombre_anterior = oferta.nombre

    if "nombre" in cambios:
        nombre_nuevo = (cambios["nombre"] or "").strip()

        if not nombre_nuevo:
            raise HTTPException(
                status_code=400,
                detail="El nombre de la oferta de valor es obligatorio.",
            )

        if nombre_nuevo.lower() == "todas":
            raise HTTPException(
                status_code=400,
                detail='"Todas" es un filtro de la interfaz y no puede usarse como oferta.',
            )

        duplicada = (
            db.query(models.OfertaValor)
            .filter(
                models.OfertaValor.id != oferta.id,
                func.lower(models.OfertaValor.nombre) == nombre_nuevo.lower(),
            )
            .first()
        )

        if duplicada:
            raise HTTPException(
                status_code=409,
                detail="Ya existe otra oferta de valor con ese nombre.",
            )

        oferta.nombre = nombre_nuevo

        if nombre_nuevo != nombre_anterior:
            # Preserva todas las asignaciones existentes al renombrar.
            db.query(models.Persona).filter(
                models.Persona.oferta_valor == nombre_anterior
            ).update(
                {models.Persona.oferta_valor: nombre_nuevo},
                synchronize_session=False,
            )

    if "responsable_persona_id" in cambios:
        responsable = _validar_responsable(
            db,
            cambios["responsable_persona_id"],
        )
        oferta.responsable_persona_id = responsable.id if responsable else None

    if "descripcion" in cambios:
        oferta.descripcion = (
            cambios["descripcion"].strip()
            if cambios["descripcion"]
            else None
        )

    if "activa" in cambios:
        oferta.activa = bool(cambios["activa"])

    # Compatibilidad: mantiene el campo histórico Persona.responsable sincronizado.
    responsable_actual = _validar_responsable(
        db,
        oferta.responsable_persona_id,
    )

    db.query(models.Persona).filter(
        models.Persona.oferta_valor == oferta.nombre
    ).update(
        {
            models.Persona.responsable: (
                responsable_actual.nombre if responsable_actual else None
            )
        },
        synchronize_session=False,
    )

    db.commit()
    db.refresh(oferta)

    return _serialize(db, oferta)


@router.delete("/{oferta_id}")
def eliminar_oferta_valor(
    oferta_id: str,
    db: Session = Depends(get_db),
):
    oferta = (
        db.query(models.OfertaValor)
        .filter(models.OfertaValor.id == oferta_id)
        .first()
    )

    if not oferta:
        raise HTTPException(status_code=404, detail="Oferta de valor no encontrada.")

    total_personas = _personas_count(db, oferta.nombre)

    if total_personas > 0:
        raise HTTPException(
            status_code=409,
            detail=(
                f"No se puede eliminar '{oferta.nombre}' porque tiene "
                f"{total_personas} persona(s) asociada(s). "
                "Reasígnalas primero o desactiva la oferta."
            ),
        )

    db.delete(oferta)
    db.commit()

    return {
        "status": "success",
        "message": "Oferta de valor eliminada.",
    }
