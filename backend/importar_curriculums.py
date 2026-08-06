"""Importa currículums desde un archivo JSON a Supabase/PostgreSQL.

Ejemplos:

    # Simulación
    python importar_curriculums.py \
        --source .\data\curriculums_carga_limpia.json \
        --replace-all

    # Aplicación real
    python importar_curriculums.py \
        --source .\data\curriculums_carga_limpia.json \
        --replace-all \
        --apply

Comportamiento:

- Sin --apply, solo simula.
- --source permite elegir el archivo JSON.
- --replace-existing actualiza solamente las personas incluidas.
- --replace-all elimina todos los currículums y experiencias actuales
  antes de insertar la nueva carga.
- No modifica personas, skills ni persona_skills.
- Importa todas las experiencias, sin límite de tres.
- La operación real se ejecuta en una sola transacción.
- Antes de --replace-all crea un respaldo JSON de la información actual.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

from database import SessionLocal
import models


BASE_DIR = Path(__file__).resolve().parent
DEFAULT_DATA_PATH = (
    BASE_DIR / "data" / "curriculums_carga_limpia.json"
)
REPORT_PATH = (
    BASE_DIR / "reporte_importacion_curriculums.json"
)
BACKUP_DIR = BASE_DIR / "backups"


def resolver_ruta_fuente(valor: str | None) -> Path:
    if not valor:
        return DEFAULT_DATA_PATH

    ruta = Path(valor)

    if not ruta.is_absolute():
        ruta = BASE_DIR / ruta

    return ruta.resolve()


def cargar_datos(
    data_path: Path,
) -> list[dict[str, Any]]:
    if not data_path.exists():
        raise FileNotFoundError(
            f"No se encontró el archivo de carga: {data_path}"
        )

    contenido = json.loads(
        data_path.read_text(encoding="utf-8")
    )

    if not isinstance(contenido, list):
        raise ValueError(
            "El archivo de carga debe contener una lista."
        )

    return contenido


def lista_segura(valor: Any) -> list[Any]:
    return valor if isinstance(valor, list) else []


def texto_opcional(valor: Any) -> str | None:
    if valor is None:
        return None

    texto = str(valor).strip()
    return texto or None


def lista_textos(valor: Any) -> list[str]:
    resultado: list[str] = []
    vistos: set[str] = set()

    for item in lista_segura(valor):
        texto = texto_opcional(item)

        if not texto:
            continue

        clave = texto.casefold()

        if clave in vistos:
            continue

        vistos.add(clave)
        resultado.append(texto)

    return resultado


def preparar_experiencias(
    experiencias_origen: Any,
) -> list[dict[str, Any]]:
    experiencias: list[dict[str, Any]] = []

    for orden, item in enumerate(
        lista_segura(experiencias_origen),
        start=1,
    ):
        if not isinstance(item, dict):
            continue

        experiencia = {
            "titulo": texto_opcional(item.get("titulo")),
            "cliente": texto_opcional(item.get("cliente")),
            "proyecto": texto_opcional(item.get("proyecto")),
            "rol": texto_opcional(item.get("rol")),
            "descripcion": texto_opcional(
                item.get("descripcion")
            ),
            "periodo": texto_opcional(item.get("periodo")),
            "orden": orden,
        }

        tiene_contenido = any(
            experiencia.get(campo)
            for campo in (
                "titulo",
                "cliente",
                "proyecto",
                "rol",
                "descripcion",
                "periodo",
            )
        )

        if tiene_contenido:
            experiencias.append(experiencia)

    return experiencias


def preparar_curriculum(
    item: dict[str, Any],
) -> dict[str, Any]:
    curriculum = item.get("curriculum")

    if not isinstance(curriculum, dict):
        raise ValueError(
            "El registro no contiene un objeto "
            "curriculum válido."
        )

    return {
        "resumen_profesional": texto_opcional(
            curriculum.get("resumen_profesional")
        ),
        "areas_especializacion": lista_textos(
            curriculum.get("areas_especializacion")
        ),
        "herramientas_tecnologias": lista_textos(
            curriculum.get("herramientas_tecnologias")
        ),
        "clientes_asesorados": lista_textos(
            curriculum.get("clientes_asesorados")
        ),
        "estudios_posgrados": lista_textos(
            curriculum.get("estudios_posgrados")
        ),
        "idiomas": lista_textos(
            curriculum.get("idiomas")
        ),
        "certificaciones": lista_textos(
            curriculum.get("certificaciones")
        ),
        "archivo_origen": texto_opcional(
            curriculum.get("archivo_origen")
        ),
        "requiere_revision": True,
        "activo": True,
    }


def serializar_curriculum_actual(
    curriculum: Any,
    experiencias: list[Any],
) -> dict[str, Any]:
    return {
        "id": curriculum.id,
        "persona_id": curriculum.persona_id,
        "resumen_profesional": (
            curriculum.resumen_profesional
        ),
        "areas_especializacion": (
            curriculum.areas_especializacion
        ),
        "herramientas_tecnologias": (
            curriculum.herramientas_tecnologias
        ),
        "clientes_asesorados": (
            curriculum.clientes_asesorados
        ),
        "estudios_posgrados": (
            curriculum.estudios_posgrados
        ),
        "idiomas": curriculum.idiomas,
        "certificaciones": curriculum.certificaciones,
        "archivo_origen": curriculum.archivo_origen,
        "requiere_revision": (
            curriculum.requiere_revision
        ),
        "activo": curriculum.activo,
        "experiencias": [
            {
                "id": experiencia.id,
                "titulo": experiencia.titulo,
                "cliente": experiencia.cliente,
                "proyecto": experiencia.proyecto,
                "rol": experiencia.rol,
                "descripcion": experiencia.descripcion,
                "periodo": experiencia.periodo,
                "orden": experiencia.orden,
            }
            for experiencia in experiencias
        ],
    }


def crear_backup_base_datos(db: Any) -> Path:
    BACKUP_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    marca_tiempo = datetime.now().strftime(
        "%Y%m%d_%H%M%S"
    )

    backup_path = (
        BACKUP_DIR
        / f"curriculums_db_{marca_tiempo}.json"
    )

    curriculums = (
        db.query(models.Curriculum)
        .order_by(models.Curriculum.persona_id)
        .all()
    )

    datos_backup: list[dict[str, Any]] = []

    for curriculum in curriculums:
        experiencias = (
            db.query(models.CurriculumExperiencia)
            .filter(
                models.CurriculumExperiencia.curriculum_id
                == curriculum.id
            )
            .order_by(
                models.CurriculumExperiencia.orden
            )
            .all()
        )

        datos_backup.append(
            serializar_curriculum_actual(
                curriculum,
                experiencias,
            )
        )

    backup_path.write_text(
        json.dumps(
            datos_backup,
            ensure_ascii=False,
            indent=2,
            default=str,
        ),
        encoding="utf-8",
    )

    return backup_path


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Importa currículums desde un JSON."
    )

    parser.add_argument(
        "--source",
        help=(
            "Ruta del archivo JSON de carga. "
            "Por defecto usa "
            "data/curriculums_carga_limpia.json."
        ),
    )

    parser.add_argument(
        "--apply",
        action="store_true",
        help=(
            "Aplica los cambios. Sin esta opción "
            "solo se realiza una simulación."
        ),
    )

    parser.add_argument(
        "--replace-existing",
        action="store_true",
        help=(
            "Reemplaza solamente los currículums "
            "de las personas incluidas en el archivo."
        ),
    )

    parser.add_argument(
        "--replace-all",
        action="store_true",
        help=(
            "Elimina todos los currículums y experiencias "
            "actuales antes de importar la nueva carga."
        ),
    )

    args = parser.parse_args()

    if args.replace_existing and args.replace_all:
        print(
            "ERROR: --replace-existing y --replace-all "
            "no pueden utilizarse juntos.",
            file=sys.stderr,
        )
        return 1

    data_path = resolver_ruta_fuente(args.source)

    try:
        datos = cargar_datos(data_path)
    except (
        OSError,
        ValueError,
        json.JSONDecodeError,
    ) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    db = SessionLocal()

    try:
        ids_personas = {
            persona_id
            for (persona_id,) in db.query(
                models.Persona.id
            ).all()
        }

        existentes = {
            curriculum.persona_id: curriculum
            for curriculum in db.query(
                models.Curriculum
            ).all()
        }

        vistos: set[str] = set()
        validos: list[dict[str, Any]] = []
        omitidos: list[dict[str, Any]] = []
        duplicados_archivo: list[dict[str, Any]] = []

        for indice, item in enumerate(datos, start=1):
            if not isinstance(item, dict):
                omitidos.append({
                    "indice": indice,
                    "motivo": (
                        "Registro inválido: no es un objeto."
                    ),
                })
                continue

            persona_id = texto_opcional(
                item.get("persona_id")
            )

            nombre = texto_opcional(
                item.get("nombre_persona")
            )

            if not persona_id:
                omitidos.append({
                    "indice": indice,
                    "nombre_persona": nombre,
                    "motivo": "Falta persona_id.",
                })
                continue

            if persona_id in vistos:
                duplicados_archivo.append({
                    "persona_id": persona_id,
                    "nombre_persona": nombre,
                    "motivo": (
                        "persona_id repetido en "
                        "el archivo de carga."
                    ),
                })
                continue

            vistos.add(persona_id)

            if persona_id not in ids_personas:
                omitidos.append({
                    "persona_id": persona_id,
                    "nombre_persona": nombre,
                    "motivo": (
                        "La persona no existe "
                        "en public.personas."
                    ),
                })
                continue

            try:
                curriculum_data = preparar_curriculum(
                    item
                )

                experiencias = preparar_experiencias(
                    item.get("experiencias")
                )

            except ValueError as exc:
                omitidos.append({
                    "persona_id": persona_id,
                    "nombre_persona": nombre,
                    "motivo": str(exc),
                })
                continue

            existe = persona_id in existentes

            if args.replace_all:
                accion = "insertar"

            elif existe and args.replace_existing:
                accion = "reemplazar"

            elif existe:
                omitidos.append({
                    "persona_id": persona_id,
                    "nombre_persona": nombre,
                    "motivo": (
                        "Ya existe un currículum. "
                        "Use --replace-existing o "
                        "--replace-all."
                    ),
                })
                continue

            else:
                accion = "insertar"

            validos.append({
                "persona_id": persona_id,
                "nombre_persona": nombre,
                "accion": accion,
                "curriculum": curriculum_data,
                "experiencias": experiencias,
            })

        total_curriculums_actuales = len(existentes)

        total_experiencias_actuales = (
            db.query(models.CurriculumExperiencia)
            .count()
        )

        reporte: dict[str, Any] = {
            "modo": (
                "APLICAR"
                if args.apply
                else "SIMULACION"
            ),
            "archivo_fuente": str(data_path),
            "registros_fuente": len(datos),
            "registros_validos": len(validos),
            "registros_omitidos": len(omitidos),
            "duplicados_en_archivo": len(
                duplicados_archivo
            ),
            "curriculums_actuales": (
                total_curriculums_actuales
            ),
            "experiencias_actuales": (
                total_experiencias_actuales
            ),
            "curriculums_a_insertar": sum(
                1
                for item in validos
                if item["accion"] == "insertar"
            ),
            "curriculums_a_reemplazar": sum(
                1
                for item in validos
                if item["accion"] == "reemplazar"
            ),
            "experiencias_a_cargar": sum(
                len(item["experiencias"])
                for item in validos
            ),
            "replace_existing": (
                args.replace_existing
            ),
            "replace_all": args.replace_all,
            "skills": (
                "No se modifican. Se mantienen "
                "skills y persona_skills."
            ),
            "omitidos": omitidos,
            "duplicados_archivo": (
                duplicados_archivo
            ),
            "registros_preparados": [
                {
                    "persona_id": item["persona_id"],
                    "nombre_persona": (
                        item["nombre_persona"]
                    ),
                    "accion": item["accion"],
                    "experiencias": len(
                        item["experiencias"]
                    ),
                    "archivo_origen": (
                        item["curriculum"][
                            "archivo_origen"
                        ]
                    ),
                }
                for item in validos
            ],
        }

        if len(validos) != 73:
            reporte["advertencia"] = (
                "La carga válida no contiene "
                "exactamente 73 currículums."
            )

        backup_path: Path | None = None

        if args.apply:
            if args.replace_all:
                if len(validos) != 73:
                    raise ValueError(
                        "Se canceló --replace-all porque "
                        f"solo hay {len(validos)} registros "
                        "válidos; se esperaban 73."
                    )

                if omitidos or duplicados_archivo:
                    raise ValueError(
                        "Se canceló --replace-all porque "
                        "existen registros omitidos o "
                        "duplicados en el archivo."
                    )

                backup_path = crear_backup_base_datos(db)

                db.query(
                    models.CurriculumExperiencia
                ).delete(
                    synchronize_session=False
                )

                db.query(
                    models.Curriculum
                ).delete(
                    synchronize_session=False
                )

                db.flush()

                existentes = {}

            for item in validos:
                persona_id = item["persona_id"]
                curriculum_data = item["curriculum"]

                existente = existentes.get(persona_id)

                if existente:
                    db.query(
                        models.CurriculumExperiencia
                    ).filter(
                        models.CurriculumExperiencia
                        .curriculum_id
                        == existente.id
                    ).delete(
                        synchronize_session=False
                    )

                    for campo, valor in (
                        curriculum_data.items()
                    ):
                        setattr(
                            existente,
                            campo,
                            valor,
                        )

                    curriculum = existente
                    db.flush()

                else:
                    curriculum = models.Curriculum(
                        persona_id=persona_id,
                        **curriculum_data,
                    )

                    db.add(curriculum)
                    db.flush()

                for experiencia in item["experiencias"]:
                    db.add(
                        models.CurriculumExperiencia(
                            curriculum_id=curriculum.id,
                            **experiencia,
                        )
                    )

            db.commit()

            reporte["resultado"] = (
                "Importación aplicada correctamente."
            )

            if backup_path:
                reporte["backup_base_datos"] = str(
                    backup_path
                )

        else:
            db.rollback()

            reporte["resultado"] = (
                "Simulación completada. "
                "No se modificó la base de datos."
            )

        REPORT_PATH.write_text(
            json.dumps(
                reporte,
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

        resumen = {
            "modo": reporte["modo"],
            "archivo_fuente": (
                reporte["archivo_fuente"]
            ),
            "registros_fuente": (
                reporte["registros_fuente"]
            ),
            "registros_validos": (
                reporte["registros_validos"]
            ),
            "registros_omitidos": (
                reporte["registros_omitidos"]
            ),
            "duplicados_en_archivo": (
                reporte["duplicados_en_archivo"]
            ),
            "curriculums_actuales": (
                reporte["curriculums_actuales"]
            ),
            "experiencias_actuales": (
                reporte["experiencias_actuales"]
            ),
            "curriculums_a_insertar": (
                reporte["curriculums_a_insertar"]
            ),
            "curriculums_a_reemplazar": (
                reporte["curriculums_a_reemplazar"]
            ),
            "experiencias_a_cargar": (
                reporte["experiencias_a_cargar"]
            ),
            "replace_all": reporte["replace_all"],
            "resultado": reporte["resultado"],
            "reporte": str(REPORT_PATH),
        }

        if reporte.get("backup_base_datos"):
            resumen["backup_base_datos"] = (
                reporte["backup_base_datos"]
            )

        print(
            json.dumps(
                resumen,
                ensure_ascii=False,
                indent=2,
            )
        )

        return 0

    except Exception as exc:
        db.rollback()

        print(
            "ERROR: la importación fue revertida: "
            f"{exc}",
            file=sys.stderr,
        )

        return 1

    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())