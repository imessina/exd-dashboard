"""Importa la carga inicial de currículums a Supabase/PostgreSQL.

Uso:

    python importar_curriculums.py
    python importar_curriculums.py --apply

La ejecución sin parámetros es una simulación y no modifica la base de datos.

Comportamiento seguro:
- Verifica que cada persona exista.
- No modifica personas, skills ni persona_skills.
- Inserta como máximo tres experiencias.
- No sobrescribe currículums existentes, salvo que se use además
  --replace-existing.
- Toda la carga se ejecuta dentro de una transacción.
- Genera reporte_importacion_curriculums.json.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from database import SessionLocal
import models


BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data" / "curriculums_carga_inicial.json"
REPORT_PATH = BASE_DIR / "reporte_importacion_curriculums.json"


def cargar_datos() -> list[dict[str, Any]]:
    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"No se encontró el archivo de carga: {DATA_PATH}"
        )

    contenido = json.loads(DATA_PATH.read_text(encoding="utf-8"))

    if not isinstance(contenido, list):
        raise ValueError("El archivo de carga debe contener una lista.")

    return contenido


def lista_segura(valor: Any) -> list[Any]:
    return valor if isinstance(valor, list) else []


def texto_opcional(valor: Any) -> str | None:
    if valor is None:
        return None

    texto = str(valor).strip()
    return texto or None


def preparar_experiencias(
    experiencias_origen: Any,
) -> list[dict[str, Any]]:
    experiencias = []

    for orden, item in enumerate(lista_segura(experiencias_origen)[:3], 1):
        if not isinstance(item, dict):
            continue

        experiencias.append({
            "titulo": texto_opcional(item.get("titulo")),
            "cliente": texto_opcional(item.get("cliente")),
            "proyecto": texto_opcional(item.get("proyecto")),
            "rol": texto_opcional(item.get("rol")),
            "descripcion": texto_opcional(item.get("descripcion")),
            "periodo": texto_opcional(item.get("periodo")),
            "orden": orden,
        })

    return experiencias


def preparar_curriculum(item: dict[str, Any]) -> dict[str, Any]:
    curriculum = item.get("curriculum")

    if not isinstance(curriculum, dict):
        raise ValueError("El registro no contiene un objeto curriculum válido.")

    return {
        "resumen_profesional": texto_opcional(
            curriculum.get("resumen_profesional")
        ),
        "areas_especializacion": lista_segura(
            curriculum.get("areas_especializacion")
        ),
        "herramientas_tecnologias": lista_segura(
            curriculum.get("herramientas_tecnologias")
        ),
        "clientes_asesorados": lista_segura(
            curriculum.get("clientes_asesorados")
        ),
        "estudios_posgrados": lista_segura(
            curriculum.get("estudios_posgrados")
        ),
        "idiomas": lista_segura(curriculum.get("idiomas")),
        "certificaciones": lista_segura(
            curriculum.get("certificaciones")
        ),
        "archivo_origen": texto_opcional(
            curriculum.get("archivo_origen")
        ),
        "requiere_revision": True,
        "activo": True,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Importa la carga inicial de currículums."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Aplica la importación. Sin esta opción solo simula.",
    )
    parser.add_argument(
        "--replace-existing",
        action="store_true",
        help=(
            "Permite reemplazar currículums ya existentes. "
            "Solo tiene efecto junto con --apply."
        ),
    )
    args = parser.parse_args()

    try:
        datos = cargar_datos()
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    db = SessionLocal()

    try:
        ids_personas = {
            persona_id
            for (persona_id,) in db.query(models.Persona.id).all()
        }

        existentes = {
            curriculum.persona_id: curriculum
            for curriculum in db.query(models.Curriculum).all()
        }

        vistos: set[str] = set()
        validos = []
        omitidos = []
        duplicados_archivo = []

        for indice, item in enumerate(datos, 1):
            if not isinstance(item, dict):
                omitidos.append({
                    "indice": indice,
                    "motivo": "Registro inválido: no es un objeto.",
                })
                continue

            persona_id = texto_opcional(item.get("persona_id"))
            nombre = texto_opcional(item.get("nombre_persona"))

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
                    "motivo": "persona_id repetido en el archivo de carga.",
                })
                continue

            vistos.add(persona_id)

            if persona_id not in ids_personas:
                omitidos.append({
                    "persona_id": persona_id,
                    "nombre_persona": nombre,
                    "motivo": "La persona no existe en public.personas.",
                })
                continue

            try:
                curriculum_data = preparar_curriculum(item)
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
            accion = "reemplazar" if existe else "insertar"

            if existe and not args.replace_existing:
                omitidos.append({
                    "persona_id": persona_id,
                    "nombre_persona": nombre,
                    "motivo": (
                        "Ya existe un currículum. "
                        "Se omitió para evitar sobrescribirlo."
                    ),
                })
                continue

            validos.append({
                "persona_id": persona_id,
                "nombre_persona": nombre,
                "accion": accion,
                "curriculum": curriculum_data,
                "experiencias": experiencias,
            })

        reporte = {
            "modo": "APLICAR" if args.apply else "SIMULACION",
            "archivo_fuente": str(DATA_PATH),
            "registros_fuente": len(datos),
            "registros_validos": len(validos),
            "registros_omitidos": len(omitidos),
            "duplicados_en_archivo": len(duplicados_archivo),
            "curriculums_a_insertar": sum(
                1 for item in validos if item["accion"] == "insertar"
            ),
            "curriculums_a_reemplazar": sum(
                1 for item in validos if item["accion"] == "reemplazar"
            ),
            "experiencias_a_cargar": sum(
                len(item["experiencias"]) for item in validos
            ),
            "replace_existing": args.replace_existing,
            "skills": (
                "No se modifican. Se mantienen en persona_skills y skills."
            ),
            "omitidos": omitidos,
            "duplicados_archivo": duplicados_archivo,
            "registros_preparados": [
                {
                    "persona_id": item["persona_id"],
                    "nombre_persona": item["nombre_persona"],
                    "accion": item["accion"],
                    "experiencias": len(item["experiencias"]),
                    "archivo_origen": item["curriculum"]["archivo_origen"],
                }
                for item in validos
            ],
        }

        if args.apply:
            for item in validos:
                persona_id = item["persona_id"]
                curriculum_data = item["curriculum"]

                existente = existentes.get(persona_id)

                if existente:
                    db.query(models.CurriculumExperiencia).filter(
                        models.CurriculumExperiencia.curriculum_id
                        == existente.id
                    ).delete(synchronize_session=False)

                    for campo, valor in curriculum_data.items():
                        setattr(existente, campo, valor)

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
            reporte["resultado"] = "Importación aplicada correctamente."
        else:
            db.rollback()
            reporte["resultado"] = (
                "Simulación completada. No se modificó la base de datos."
            )

        REPORT_PATH.write_text(
            json.dumps(reporte, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        print(json.dumps({
            "modo": reporte["modo"],
            "registros_fuente": reporte["registros_fuente"],
            "registros_validos": reporte["registros_validos"],
            "registros_omitidos": reporte["registros_omitidos"],
            "curriculums_a_insertar": reporte[
                "curriculums_a_insertar"
            ],
            "curriculums_a_reemplazar": reporte[
                "curriculums_a_reemplazar"
            ],
            "experiencias_a_cargar": reporte[
                "experiencias_a_cargar"
            ],
            "resultado": reporte["resultado"],
            "reporte": str(REPORT_PATH),
        }, ensure_ascii=False, indent=2))

        return 0

    except Exception as exc:
        db.rollback()
        print(
            f"ERROR: la importación fue revertida: {exc}",
            file=sys.stderr,
        )
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
