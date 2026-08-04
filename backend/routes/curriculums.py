import io
import zipfile

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload
from pydantic import BaseModel, Field

from database import get_db
import models, schemas
from services.curriculum_pdf import generar_curriculum_pdf, nombre_archivo_pdf

router = APIRouter(prefix="/curriculums", tags=["curriculums"])


class CurriculumZipRequest(BaseModel):
    persona_ids: list[str] = Field(
        min_length=1,
        max_length=100,
        description="IDs de personas cuyos currículums se incluirán en el ZIP.",
    )



def _crear_curriculums_faltantes(db: Session) -> int:
    """Crea un registro vacío para cada persona que todavía no tiene CV."""
    personas_sin_cv = (
        db.query(models.Persona)
        .outerjoin(
            models.Curriculum,
            models.Curriculum.persona_id == models.Persona.id,
        )
        .filter(models.Curriculum.id.is_(None))
        .all()
    )

    if not personas_sin_cv:
        return 0

    for persona in personas_sin_cv:
        db.add(
            models.Curriculum(
                persona_id=persona.id,
                resumen_profesional=None,
                areas_especializacion=[],
                herramientas_tecnologias=[],
                clientes_asesorados=[],
                estudios_posgrados=[],
                idiomas=[],
                certificaciones=[],
                archivo_origen=None,
                requiere_revision=True,
                activo=True,
            )
        )

    db.commit()
    return len(personas_sin_cv)


def _skills_por_persona(db: Session, persona_ids: list[str]) -> dict[str, list[dict]]:
    if not persona_ids:
        return {}

    rows = (
        db.query(models.PersonaSkill, models.Skill)
        .join(models.Skill, models.Skill.id == models.PersonaSkill.skill_id)
        .filter(models.PersonaSkill.persona_id.in_(persona_ids))
        .order_by(models.Skill.nombre)
        .all()
    )

    resultado: dict[str, list[dict]] = {persona_id: [] for persona_id in persona_ids}
    for persona_skill, skill in rows:
        resultado.setdefault(persona_skill.persona_id, []).append(
            {
                "skill_id": persona_skill.skill_id,
                "nombre": skill.nombre,
                "categoria": skill.categoria,
                "nivel": persona_skill.nivel,
            }
        )
    return resultado


def _serializar(curriculum: models.Curriculum, skills: list[dict]) -> dict:
    return {
        "id": curriculum.id,
        "persona_id": curriculum.persona_id,
        "persona": curriculum.persona,
        "resumen_profesional": curriculum.resumen_profesional,
        "areas_especializacion": curriculum.areas_especializacion or [],
        "herramientas_tecnologias": curriculum.herramientas_tecnologias or [],
        "clientes_asesorados": curriculum.clientes_asesorados or [],
        "estudios_posgrados": curriculum.estudios_posgrados or [],
        "idiomas": curriculum.idiomas or [],
        "certificaciones": curriculum.certificaciones or [],
        "archivo_origen": curriculum.archivo_origen,
        "requiere_revision": curriculum.requiere_revision,
        "activo": curriculum.activo,
        "experiencias": curriculum.experiencias,
        "skills": skills,
        "created_at": curriculum.created_at,
        "updated_at": curriculum.updated_at,
    }


def _validar_experiencias(experiencias: list[schemas.CurriculumExperienciaInput]) -> None:
    ordenes = [item.orden for item in experiencias]
    if len(ordenes) != len(set(ordenes)):
        raise HTTPException(status_code=400, detail="No se permiten experiencias con el mismo orden")


def _reemplazar_experiencias(
    db: Session,
    curriculum: models.Curriculum,
    experiencias: list[schemas.CurriculumExperienciaInput],
) -> None:
    _validar_experiencias(experiencias)

    # Eliminar primero las experiencias existentes y forzar el DELETE
    # antes de insertar las nuevas. Esto evita colisiones con la restricción
    # UNIQUE (curriculum_id, orden).
    (
        db.query(models.CurriculumExperiencia)
        .filter(
            models.CurriculumExperiencia.curriculum_id == curriculum.id
        )
        .delete(synchronize_session=False)
    )
    db.flush()

    for item in sorted(experiencias, key=lambda experiencia: experiencia.orden):
        db.add(
            models.CurriculumExperiencia(
                curriculum_id=curriculum.id,
                **item.model_dump(),
            )
        )


@router.get("/", response_model=List[schemas.CurriculumOut])
def list_curriculums(
    buscar: Optional[str] = Query(None, min_length=1),
    incluir_inactivos: bool = Query(False),
    db: Session = Depends(get_db),
):
    # Sincroniza personas sin CV para que todas aparezcan en el mantenedor
    # y puedan completar su información desde la misma pantalla.
    _crear_curriculums_faltantes(db)

    query = (
        db.query(models.Curriculum)
        .join(models.Persona, models.Persona.id == models.Curriculum.persona_id)
        .options(
            selectinload(models.Curriculum.persona),
            selectinload(models.Curriculum.experiencias),
        )
    )

    if not incluir_inactivos:
        query = query.filter(models.Curriculum.activo.is_(True))

    if buscar:
        termino = f"%{buscar.strip()}%"
        query = query.filter(
            or_(
                models.Persona.nombre.ilike(termino),
                models.Persona.rol.ilike(termino),
                models.Persona.area.ilike(termino),
                models.Persona.numero_empleado.ilike(termino),
            )
        )

    curriculums = query.order_by(models.Persona.nombre).all()
    skills = _skills_por_persona(db, [item.persona_id for item in curriculums])
    return [_serializar(item, skills.get(item.persona_id, [])) for item in curriculums]


@router.get("/persona/{persona_id}", response_model=schemas.CurriculumOut)
def get_curriculum_por_persona(persona_id: str, db: Session = Depends(get_db)):
    curriculum = (
        db.query(models.Curriculum)
        .options(
            selectinload(models.Curriculum.persona),
            selectinload(models.Curriculum.experiencias),
        )
        .filter(models.Curriculum.persona_id == persona_id)
        .first()
    )
    if not curriculum:
        raise HTTPException(status_code=404, detail="Currículum no encontrado")

    skills = _skills_por_persona(db, [persona_id]).get(persona_id, [])
    return _serializar(curriculum, skills)


@router.post("/exportar-zip")
def descargar_curriculums_zip(
    payload: CurriculumZipRequest,
    db: Session = Depends(get_db),
):
    persona_ids = list(dict.fromkeys(payload.persona_ids))

    curriculums = (
        db.query(models.Curriculum)
        .options(
            selectinload(models.Curriculum.persona),
            selectinload(models.Curriculum.experiencias),
        )
        .filter(
            models.Curriculum.persona_id.in_(persona_ids),
            models.Curriculum.activo.is_(True),
        )
        .all()
    )

    encontrados = {item.persona_id: item for item in curriculums}
    faltantes = [persona_id for persona_id in persona_ids if persona_id not in encontrados]

    if faltantes:
        raise HTTPException(
            status_code=404,
            detail={
                "mensaje": "Uno o más currículums no fueron encontrados.",
                "persona_ids": faltantes,
            },
        )

    skills_por_persona = _skills_por_persona(db, persona_ids)

    memoria_zip = io.BytesIO()

    with zipfile.ZipFile(
        memoria_zip,
        mode="w",
        compression=zipfile.ZIP_DEFLATED,
    ) as archivo_zip:
        nombres_usados: set[str] = set()

        for persona_id in persona_ids:
            curriculum = encontrados[persona_id]
            skills = skills_por_persona.get(persona_id, [])
            datos = _serializar(curriculum, skills)
            datos_pdf = schemas.CurriculumOut.model_validate(datos).model_dump(
                mode="python"
            )

            contenido_pdf = generar_curriculum_pdf(datos_pdf)

            nombre_persona = (
                curriculum.persona.nombre
                if curriculum.persona
                else persona_id
            )
            nombre_archivo = nombre_archivo_pdf(nombre_persona)

            nombre_base = nombre_archivo[:-4]
            nombre_final = nombre_archivo
            consecutivo = 2

            while nombre_final.lower() in nombres_usados:
                nombre_final = f"{nombre_base}_{consecutivo}.pdf"
                consecutivo += 1

            nombres_usados.add(nombre_final.lower())
            archivo_zip.writestr(nombre_final, contenido_pdf)

    memoria_zip.seek(0)
    contenido_zip = memoria_zip.getvalue()

    return StreamingResponse(
        io.BytesIO(contenido_zip),
        media_type="application/zip",
        headers={
            "Content-Disposition": 'attachment; filename="curriculums_seleccionados.zip"',
            "Content-Length": str(len(contenido_zip)),
        },
    )


@router.get("/persona/{persona_id}/pdf")
def descargar_curriculum_pdf(
    persona_id: str,
    db: Session = Depends(get_db),
):
    curriculum = (
        db.query(models.Curriculum)
        .options(
            selectinload(models.Curriculum.persona),
            selectinload(models.Curriculum.experiencias),
        )
        .filter(
            models.Curriculum.persona_id == persona_id,
            models.Curriculum.activo.is_(True),
        )
        .first()
    )
    if not curriculum:
        raise HTTPException(status_code=404, detail="Currículum no encontrado")

    skills = _skills_por_persona(db, [persona_id]).get(persona_id, [])
    datos = _serializar(curriculum, skills)

    # Convertir relaciones SQLAlchemy (persona y experiencias) a datos
    # serializables antes de enviarlas al generador PDF.
    datos_pdf = schemas.CurriculumOut.model_validate(datos).model_dump(
        mode="python"
    )
    contenido = generar_curriculum_pdf(datos_pdf)

    nombre_persona = (
        curriculum.persona.nombre
        if curriculum.persona
        else persona_id
    )
    nombre_archivo = nombre_archivo_pdf(nombre_persona)

    return StreamingResponse(
        io.BytesIO(contenido),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo}"',
            "Content-Length": str(len(contenido)),
        },
    )


@router.post("/", response_model=schemas.CurriculumOut, status_code=201)
def create_curriculum(data: schemas.CurriculumCreate, db: Session = Depends(get_db)):
    persona = db.query(models.Persona).filter(models.Persona.id == data.persona_id).first()
    if not persona:
        raise HTTPException(status_code=404, detail="Persona no encontrada")

    existente = (
        db.query(models.Curriculum)
        .filter(models.Curriculum.persona_id == data.persona_id)
        .first()
    )
    if existente:
        raise HTTPException(status_code=400, detail="La persona ya tiene un currículum")

    _validar_experiencias(data.experiencias)
    valores = data.model_dump(exclude={"experiencias"})
    curriculum = models.Curriculum(**valores)
    for experiencia in sorted(data.experiencias, key=lambda item: item.orden):
        curriculum.experiencias.append(
            models.CurriculumExperiencia(**experiencia.model_dump())
        )

    db.add(curriculum)
    db.commit()
    db.refresh(curriculum)

    curriculum = (
        db.query(models.Curriculum)
        .options(
            selectinload(models.Curriculum.persona),
            selectinload(models.Curriculum.experiencias),
        )
        .filter(models.Curriculum.id == curriculum.id)
        .one()
    )
    skills = _skills_por_persona(db, [curriculum.persona_id]).get(curriculum.persona_id, [])
    return _serializar(curriculum, skills)


@router.put("/persona/{persona_id}", response_model=schemas.CurriculumOut)
def update_curriculum(
    persona_id: str,
    data: schemas.CurriculumUpdate,
    db: Session = Depends(get_db),
):
    curriculum = (
        db.query(models.Curriculum)
        .options(
            selectinload(models.Curriculum.persona),
            selectinload(models.Curriculum.experiencias),
        )
        .filter(models.Curriculum.persona_id == persona_id)
        .first()
    )
    if not curriculum:
        raise HTTPException(status_code=404, detail="Currículum no encontrado")

    valores = data.model_dump(exclude_unset=True)
    experiencias = valores.pop("experiencias", None)

    # Todo guardado desde el mantenedor deja el CV en estado Actualizado.
    valores["requiere_revision"] = False

    for campo, valor in valores.items():
        setattr(curriculum, campo, valor)

    if experiencias is not None:
        entradas = [schemas.CurriculumExperienciaInput(**item) for item in experiencias]
        _reemplazar_experiencias(db, curriculum, entradas)

    db.commit()

    curriculum = (
        db.query(models.Curriculum)
        .options(
            selectinload(models.Curriculum.persona),
            selectinload(models.Curriculum.experiencias),
        )
        .filter(models.Curriculum.persona_id == persona_id)
        .one()
    )

    skills = _skills_por_persona(db, [persona_id]).get(persona_id, [])
    return _serializar(curriculum, skills)
