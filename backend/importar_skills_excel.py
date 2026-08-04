"""Importa evaluaciones de skills desde data/skills_evaluaciones.json.

Uso recomendado:

    python importar_skills_excel.py
    python importar_skills_excel.py --apply

La primera ejecución es una simulación. No modifica la base de datos.
La segunda aplica únicamente coincidencias únicas y válidas.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path
from typing import Any

from sqlalchemy.dialects.postgresql import insert

from database import SessionLocal
import models


BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data" / "skills_evaluaciones.json"
REPORT_PATH = BASE_DIR / "reporte_importacion_skills.json"


def normalizar(valor: str | None) -> str:
    """Normaliza texto para comparar nombres y skills."""
    texto = unicodedata.normalize("NFKD", str(valor or ""))
    texto = "".join(
        caracter for caracter in texto
        if not unicodedata.combining(caracter)
    )
    texto = texto.casefold()
    texto = re.sub(r"[^a-z0-9]+", " ", texto)
    return " ".join(texto.split())


def tokens(valor: str | None) -> set[str]:
    return set(normalizar(valor).split())


def buscar_persona(
    nombre_excel: str,
    personas: list[models.Persona],
) -> tuple[models.Persona | None, list[models.Persona]]:
    """Busca una persona por todos los tokens del nombre abreviado.

    Ejemplo:
      Ignacio Messina
    coincide con:
      Ignacio Alonso Messina Luna

    Solo acepta la coincidencia cuando el resultado es único.
    """
    buscados = tokens(nombre_excel)
    candidatos = [
        persona
        for persona in personas
        if buscados and buscados.issubset(tokens(persona.nombre))
    ]

    if len(candidatos) == 1:
        return candidatos[0], candidatos

    # Segunda estrategia segura: primer token + último token.
    partes = normalizar(nombre_excel).split()
    if len(partes) >= 2:
        primero = partes[0]
        ultimo = partes[-1]
        candidatos = [
            persona
            for persona in personas
            if primero in tokens(persona.nombre)
            and ultimo in tokens(persona.nombre)
        ]

    if len(candidatos) == 1:
        return candidatos[0], candidatos

    return None, candidatos


def buscar_skill(
    nombre_excel: str,
    skills: list[models.Skill],
) -> tuple[models.Skill | None, list[models.Skill]]:
    objetivo = normalizar(nombre_excel)
    candidatos = [
        skill
        for skill in skills
        if normalizar(skill.nombre) == objetivo
    ]

    if len(candidatos) == 1:
        return candidatos[0], candidatos

    return None, candidatos


def cargar_datos() -> dict[str, Any]:
    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"No se encontró el archivo de datos: {DATA_PATH}"
        )

    return json.loads(DATA_PATH.read_text(encoding="utf-8"))


def sincronizar_habilidades_historicas(db, persona_ids: set[str]) -> None:
    """Mantiene personas.habilidades sincronizado por compatibilidad."""
    for persona_id in persona_ids:
        nombres = (
            db.query(models.Skill.nombre)
            .join(
                models.PersonaSkill,
                models.PersonaSkill.skill_id == models.Skill.id,
            )
            .filter(models.PersonaSkill.persona_id == persona_id)
            .order_by(models.Skill.nombre)
            .all()
        )

        persona = (
            db.query(models.Persona)
            .filter(models.Persona.id == persona_id)
            .one()
        )
        persona.habilidades = [nombre for (nombre,) in nombres]


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Importa evaluaciones de skills con niveles 1–5."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Aplica los cambios. Sin esta opción solo simula.",
    )
    args = parser.parse_args()

    payload = cargar_datos()
    evaluaciones = payload["evaluaciones"]

    db = SessionLocal()

    try:
        personas = db.query(models.Persona).all()
        skills = db.query(models.Skill).all()

        mapa_personas: dict[str, models.Persona] = {}
        mapa_skills: dict[str, models.Skill] = {}

        personas_no_encontradas = []
        personas_ambiguas = []
        skills_no_encontradas = []
        skills_ambiguas = []

        for nombre_excel in sorted({
            item["persona_excel"] for item in evaluaciones
        }):
            persona, candidatos = buscar_persona(nombre_excel, personas)

            if persona:
                mapa_personas[nombre_excel] = persona
            elif candidatos:
                personas_ambiguas.append({
                    "nombre_excel": nombre_excel,
                    "candidatos": [
                        {
                            "id": candidato.id,
                            "nombre": candidato.nombre,
                            "numero_empleado": candidato.numero_empleado,
                        }
                        for candidato in candidatos
                    ],
                })
            else:
                personas_no_encontradas.append(nombre_excel)

        for nombre_skill in sorted({
            item["skill"] for item in evaluaciones
        }):
            skill, candidatos = buscar_skill(nombre_skill, skills)

            if skill:
                mapa_skills[nombre_skill] = skill
            elif candidatos:
                skills_ambiguas.append({
                    "skill_excel": nombre_skill,
                    "candidatos": [
                        {
                            "id": candidato.id,
                            "nombre": candidato.nombre,
                        }
                        for candidato in candidatos
                    ],
                })
            else:
                skills_no_encontradas.append(nombre_skill)

        filas_validas = []
        filas_omitidas = []

        for item in evaluaciones:
            persona = mapa_personas.get(item["persona_excel"])
            skill = mapa_skills.get(item["skill"])

            if not persona or not skill:
                filas_omitidas.append(item)
                continue

            filas_validas.append({
                "persona_id": persona.id,
                "persona_nombre": persona.nombre,
                "numero_empleado": persona.numero_empleado,
                "skill_id": skill.id,
                "skill_nombre": skill.nombre,
                "nivel": item["nivel"],
            })

        reporte = {
            "modo": "APLICAR" if args.apply else "SIMULACION",
            "fuente": payload.get("fuente"),
            "total_excel": len(evaluaciones),
            "personas_excel": len({
                item["persona_excel"] for item in evaluaciones
            }),
            "skills_excel": len({
                item["skill"] for item in evaluaciones
            }),
            "personas_coincidentes": len(mapa_personas),
            "skills_coincidentes": len(mapa_skills),
            "filas_validas": len(filas_validas),
            "filas_omitidas": len(filas_omitidas),
            "personas_no_encontradas": personas_no_encontradas,
            "personas_ambiguas": personas_ambiguas,
            "skills_no_encontradas": skills_no_encontradas,
            "skills_ambiguas": skills_ambiguas,
            "coincidencias_personas": [
                {
                    "nombre_excel": nombre_excel,
                    "persona_id": persona.id,
                    "nombre_dashboard": persona.nombre,
                    "numero_empleado": persona.numero_empleado,
                }
                for nombre_excel, persona in sorted(mapa_personas.items())
            ],
        }

        if args.apply:
            if (
                personas_no_encontradas
                or personas_ambiguas
                or skills_no_encontradas
                or skills_ambiguas
            ):
                reporte["aplicado"] = False
                reporte["motivo"] = (
                    "No se aplicó porque existen personas o skills "
                    "sin coincidencia única. Revisa el reporte."
                )
                REPORT_PATH.write_text(
                    json.dumps(reporte, ensure_ascii=False, indent=2),
                    encoding="utf-8",
                )
                print(json.dumps(reporte, ensure_ascii=False, indent=2))
                return 2

            persona_ids_actualizados: set[str] = set()

            for fila in filas_validas:
                sentencia = insert(models.PersonaSkill).values(
                    persona_id=fila["persona_id"],
                    skill_id=fila["skill_id"],
                    nivel=fila["nivel"],
                )

                sentencia = sentencia.on_conflict_do_update(
                    constraint="persona_skills_persona_skill_unique",
                    set_={
                        "nivel": sentencia.excluded.nivel,
                    },
                )

                db.execute(sentencia)
                persona_ids_actualizados.add(fila["persona_id"])

            db.flush()
            sincronizar_habilidades_historicas(
                db,
                persona_ids_actualizados,
            )
            db.commit()

            reporte["aplicado"] = True
            reporte["registros_insertados_o_actualizados"] = len(
                filas_validas
            )
        else:
            reporte["aplicado"] = False
            reporte["mensaje"] = (
                "Simulación completada. Revisa el reporte y ejecuta "
                "nuevamente con --apply."
            )

        REPORT_PATH.write_text(
            json.dumps(reporte, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        print(json.dumps(reporte, ensure_ascii=False, indent=2))
        print(f"\nReporte guardado en: {REPORT_PATH}")

        return 0

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
