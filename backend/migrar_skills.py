from __future__ import annotations

import json
import sys
from pathlib import Path

from database import SessionLocal
import models

PLAN_FILE = Path(__file__).with_name("skills_migracion_plan_final.json")

EXPECTED_TOTAL_PERSONAS = 85
EXPECTED_LISTED_PERSONAS = 22
EXPECTED_CATEGORIES = 19
EXPECTED_SKILLS = 344
EXPECTED_ASSIGNMENTS = 769


def main() -> int:
    print("=" * 78)
    print("MIGRACIÓN REAL - CATÁLOGO DE SKILLS / DASHBOARD DX")
    print("=" * 78)

    if not PLAN_FILE.exists():
        print(f"[ERROR] No existe el archivo de plan: {PLAN_FILE}")
        return 1

    plan = json.loads(PLAN_FILE.read_text(encoding="utf-8"))
    summary = plan["summary"]

    expected_plan = {
        "personas": EXPECTED_LISTED_PERSONAS,
        "categorias": EXPECTED_CATEGORIES,
        "skills_canonicas": EXPECTED_SKILLS,
        "asignaciones": EXPECTED_ASSIGNMENTS,
        "conflictos_nivel": 0,
    }

    print("\n[VALIDACIÓN PREVIA DEL PLAN]")
    for key, expected in expected_plan.items():
        actual = summary.get(key)
        status = "OK" if actual == expected else "ERROR"
        print(f"{key:20} esperado={expected:<4} actual={actual:<4} [{status}]")
        if actual != expected:
            print("\n[ERROR] El plan no coincide con los valores aprobados.")
            return 2

    db = SessionLocal()

    try:
        print("\n[VALIDACIÓN PREVIA DE BD]")

        total_personas = db.query(models.Persona).count()
        total_skills_actuales = db.query(models.Skill).count()
        total_asignaciones_actuales = db.query(models.PersonaSkill).count()

        print(f"Personas actuales     : {total_personas}")
        print(f"Skills actuales       : {total_skills_actuales}")
        print(f"Asignaciones actuales : {total_asignaciones_actuales}")

        if total_personas != EXPECTED_TOTAL_PERSONAS:
            print(
                f"\n[ERROR] Se esperaban {EXPECTED_TOTAL_PERSONAS} personas "
                f"y la BD tiene {total_personas}. Se cancela."
            )
            return 3

        listed_ids = {
            item["id"]
            for item in plan["person_map"].values()
        }

        existing_person_ids = {
            persona_id
            for (persona_id,) in db.query(models.Persona.id).all()
        }

        missing_people = sorted(listed_ids - existing_person_ids)

        if missing_people:
            print("\n[ERROR] Faltan personas del Excel en la BD:")
            for persona_id in missing_people:
                print(f" - {persona_id}")
            return 4

        print(f"Personas del Excel encontradas: {len(listed_ids)}/22 [OK]")

        skills = plan["skills"]
        assignments = plan["assignments"]

        skill_ids = {skill["id"] for skill in skills}

        invalid_assignments = [
            item
            for item in assignments
            if item["persona_id"] not in listed_ids
            or item["skill_id"] not in skill_ids
            or not isinstance(item["nivel"], int)
            or not 1 <= item["nivel"] <= 5
        ]

        if invalid_assignments:
            print("\n[ERROR] Hay asignaciones inválidas en el plan.")
            for item in invalid_assignments[:20]:
                print(" -", item)
            return 5

        print("\n[INICIO TRANSACCIÓN]")
        print("1) Eliminando asignaciones persona-skill actuales...")

        db.query(models.PersonaSkill).delete(
            synchronize_session=False
        )

        print("2) Eliminando catálogo de skills actual...")

        db.query(models.Skill).delete(
            synchronize_session=False
        )

        print(f"3) Creando {EXPECTED_SKILLS} skills nuevas...")

        for skill in skills:
            db.add(
                models.Skill(
                    id=skill["id"],
                    nombre=skill["nombre"],
                    categoria=skill["categoria"],
                )
            )

        db.flush()

        skills_creadas = db.query(models.Skill).count()

        if skills_creadas != EXPECTED_SKILLS:
            raise RuntimeError(
                f"Se esperaban {EXPECTED_SKILLS} skills después del insert "
                f"y existen {skills_creadas}."
            )

        print(f"   Skills creadas: {skills_creadas} [OK]")

        print(f"4) Creando {EXPECTED_ASSIGNMENTS} asignaciones...")

        for item in assignments:
            db.add(
                models.PersonaSkill(
                    persona_id=item["persona_id"],
                    skill_id=item["skill_id"],
                    nivel=item["nivel"],
                )
            )

        db.flush()

        asignaciones_creadas = db.query(models.PersonaSkill).count()

        if asignaciones_creadas != EXPECTED_ASSIGNMENTS:
            raise RuntimeError(
                f"Se esperaban {EXPECTED_ASSIGNMENTS} asignaciones "
                f"y existen {asignaciones_creadas}."
            )

        print(f"   Asignaciones creadas: {asignaciones_creadas} [OK]")

        categorias_creadas = {
            categoria
            for (categoria,) in db.query(models.Skill.categoria)
            .filter(models.Skill.categoria.isnot(None))
            .distinct()
            .all()
            if categoria
        }

        if len(categorias_creadas) != EXPECTED_CATEGORIES:
            raise RuntimeError(
                f"Se esperaban {EXPECTED_CATEGORIES} categorías "
                f"y existen {len(categorias_creadas)}."
            )

        total_personas_final = db.query(models.Persona).count()

        if total_personas_final != EXPECTED_TOTAL_PERSONAS:
            raise RuntimeError(
                f"El total de personas cambió inesperadamente: "
                f"{total_personas_final}"
            )

        print("\n[VALIDACIÓN FINAL ANTES DE COMMIT]")
        print(f"Personas      : {total_personas_final} [OK]")
        print(f"Categorías    : {len(categorias_creadas)} [OK]")
        print(f"Skills        : {skills_creadas} [OK]")
        print(f"Asignaciones  : {asignaciones_creadas} [OK]")

        print("\n5) Ejecutando COMMIT...")
        db.commit()

        print("\n" + "=" * 78)
        print("MIGRACIÓN COMPLETADA CORRECTAMENTE")
        print("=" * 78)
        print(f"Personas conservadas : {EXPECTED_TOTAL_PERSONAS}")
        print(f"Categorías nuevas    : {EXPECTED_CATEGORIES}")
        print(f"Skills nuevas        : {EXPECTED_SKILLS}")
        print(f"Asignaciones nuevas  : {EXPECTED_ASSIGNMENTS}")
        print("=" * 78)

        return 0

    except Exception as exc:
        print("\n[ERROR] Falló la migración.")
        print(f"Detalle: {exc}")
        print("Ejecutando ROLLBACK...")

        db.rollback()

        print("ROLLBACK completado. No se guardaron cambios parciales.")
        raise

    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
