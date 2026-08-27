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
    print("DRY RUN FINAL V2 - MIGRACIÓN CATÁLOGO DE SKILLS / DASHBOARD DX")
    print("NO MODIFICA LA BASE DE DATOS")
    print("=" * 78)

    if not PLAN_FILE.exists():
        print(f"[ERROR] No existe el archivo de plan: {PLAN_FILE}")
        return 1

    plan = json.loads(PLAN_FILE.read_text(encoding="utf-8"))
    summary = plan["summary"]

    print("\n[VALIDACIÓN DEL PLAN]")
    expected_plan = {
        "personas": EXPECTED_LISTED_PERSONAS,
        "categorias": EXPECTED_CATEGORIES,
        "skills_canonicas": EXPECTED_SKILLS,
        "asignaciones": EXPECTED_ASSIGNMENTS,
        "conflictos_nivel": 0,
    }

    errors = []
    for key, expected in expected_plan.items():
        actual = summary.get(key)
        status = "OK" if actual == expected else "ERROR"
        print(f"{key:20} esperado={expected:<4} actual={actual:<4} [{status}]")
        if actual != expected:
            errors.append((key, expected, actual))

    if errors:
        print("\n[ERROR] El plan no coincide con los valores esperados.")
        return 2

    db = SessionLocal()
    try:
        total_personas = db.query(models.Persona).count()
        total_skills_actuales = db.query(models.Skill).count()
        total_asignaciones_actuales = db.query(models.PersonaSkill).count()

        categorias_actuales = sorted(
            {
                categoria
                for (categoria,) in db.query(models.Skill.categoria)
                .filter(models.Skill.categoria.isnot(None))
                .distinct()
                .all()
                if categoria
            },
            key=str.casefold,
        )

        print("\n[ESTADO ACTUAL DE LA BD]")
        print(f"Personas actuales           : {total_personas}")
        print(f"Categorías actuales         : {len(categorias_actuales)}")
        print(f"Skills actuales             : {total_skills_actuales}")
        print(f"Asignaciones actuales       : {total_asignaciones_actuales}")

        if total_personas != EXPECTED_TOTAL_PERSONAS:
            print(
                f"\n[ERROR] Se esperaban {EXPECTED_TOTAL_PERSONAS} personas "
                f"y la BD tiene {total_personas}. No continuar."
            )
            return 3

        person_map = plan["person_map"]
        listed_ids = {item["id"] for item in person_map.values()}
        personas_bd = {p.id: p for p in db.query(models.Persona).all()}

        missing = sorted(listed_ids - set(personas_bd))
        if missing:
            print("\n[ERROR] Faltan personas del Excel en la BD:")
            for person_id in missing:
                print(f" - {person_id}")
            return 4

        print(f"\n[PERSONAS DEL EXCEL] {len(listed_ids)}/22 encontradas [OK]")

        unlisted_ids = set(personas_bd) - listed_ids
        unlisted_assignments = (
            db.query(models.PersonaSkill)
            .filter(models.PersonaSkill.persona_id.in_(unlisted_ids))
            .count()
            if unlisted_ids
            else 0
        )

        unlisted_with_skills = (
            db.query(models.PersonaSkill.persona_id)
            .filter(models.PersonaSkill.persona_id.in_(unlisted_ids))
            .distinct()
            .count()
            if unlisted_ids
            else 0
        )

        print("\n[IMPACTO ESPERADO EN PERSONAS FUERA DEL EXCEL]")
        print(f"Personas fuera del Excel                    : {len(unlisted_ids)}")
        print(f"De ellas, personas con skills actuales      : {unlisted_with_skills}")
        print(f"Asignaciones actuales que podrán desaparecer: {unlisted_assignments}")
        print("Personas eliminadas                         : 0")
        print("Otros datos de personas modificados         : 0")

        skills = plan["skills"]
        assignments = plan["assignments"]
        categories = plan["categories"]

        skill_ids = [s["id"] for s in skills]
        skill_names = [s["nombre"] for s in skills]
        assignment_keys = [(a["persona_id"], a["skill_id"]) for a in assignments]

        duplicate_ids = {x for x in skill_ids if skill_ids.count(x) > 1}
        duplicate_names = {x for x in skill_names if skill_names.count(x) > 1}
        duplicate_assignments = {x for x in assignment_keys if assignment_keys.count(x) > 1}
        invalid_levels = [
            a for a in assignments
            if not isinstance(a.get("nivel"), int) or not 1 <= a["nivel"] <= 5
        ]
        unknown_people = {
            a["persona_id"] for a in assignments if a["persona_id"] not in listed_ids
        }
        unknown_skills = {
            a["skill_id"] for a in assignments if a["skill_id"] not in set(skill_ids)
        }

        print("\n[VALIDACIÓN CATÁLOGO NUEVO]")
        checks = [
            ("Categorías", len(categories), EXPECTED_CATEGORIES),
            ("Skills", len(skills), EXPECTED_SKILLS),
            ("Asignaciones", len(assignments), EXPECTED_ASSIGNMENTS),
            ("IDs de skill duplicados", len(duplicate_ids), 0),
            ("Nombres de skill duplicados", len(duplicate_names), 0),
            ("Asignaciones duplicadas", len(duplicate_assignments), 0),
            ("Niveles inválidos", len(invalid_levels), 0),
            ("Personas desconocidas", len(unknown_people), 0),
            ("Skills desconocidas", len(unknown_skills), 0),
        ]

        has_error = False
        for label, actual, expected in checks:
            status = "OK" if actual == expected else "ERROR"
            print(f"{label:28}: {actual:<4} [{status}]")
            if actual != expected:
                has_error = True

        if has_error:
            print("\n[ERROR] Existen inconsistencias. No ejecutar la migración real.")
            if duplicate_names:
                print("Nombres duplicados:", sorted(duplicate_names))
            return 5

        print("\n[CORRECCIONES CONFIRMADAS]")
        for rule in plan["rules"]["canonical_corrections"]:
            origin = " / ".join(rule["origen"])
            destination = " / ".join(rule["destino"])
            print(f" - {origin} -> {destination}")

        print("\n" + "=" * 78)
        print("DRY RUN FINAL V2 OK")
        print("NO SE MODIFICÓ LA BASE DE DATOS.")
        print("=" * 78)
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
