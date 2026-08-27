from __future__ import annotations

import json
import sys
from pathlib import Path

from database import SessionLocal
import models

PLAN_FILE = Path(__file__).with_name("skills_migracion_plan_final.json")

EXPECTED_LISTED_PERSONAS = 22


def main() -> int:
    print("=" * 78)
    print("SINCRONIZACIÓN persona.habilidades DESDE persona_skills")
    print("=" * 78)

    if not PLAN_FILE.exists():
        print(f"[ERROR] No existe el archivo de plan: {PLAN_FILE}")
        return 1

    plan = json.loads(PLAN_FILE.read_text(encoding="utf-8"))
    person_map = plan["person_map"]
    listed_ids = {item["id"] for item in person_map.values()}

    if len(listed_ids) != EXPECTED_LISTED_PERSONAS:
        print(
            f"[ERROR] Se esperaban {EXPECTED_LISTED_PERSONAS} personas "
            f"y el plan contiene {len(listed_ids)}."
        )
        return 2

    db = SessionLocal()

    try:
        personas = (
            db.query(models.Persona)
            .filter(models.Persona.id.in_(listed_ids))
            .all()
        )

        if len(personas) != EXPECTED_LISTED_PERSONAS:
            encontrados = {p.id for p in personas}
            faltantes = sorted(listed_ids - encontrados)
            print(
                f"[ERROR] Solo se encontraron {len(personas)}/"
                f"{EXPECTED_LISTED_PERSONAS} personas."
            )
            if faltantes:
                print("Faltantes:")
                for persona_id in faltantes:
                    print(f" - {persona_id}")
            return 3

        print(f"\nPersonas a sincronizar: {len(personas)}")

        total_habilidades = 0

        for persona in personas:
            rows = (
                db.query(models.PersonaSkill, models.Skill)
                .join(
                    models.Skill,
                    models.Skill.id == models.PersonaSkill.skill_id,
                )
                .filter(models.PersonaSkill.persona_id == persona.id)
                .order_by(models.Skill.nombre.asc())
                .all()
            )

            nombres = [skill.nombre for _, skill in rows]

            persona.habilidades = nombres
            total_habilidades += len(nombres)

            print(
                f"[OK] {persona.id} | {persona.nombre} | "
                f"{len(nombres)} habilidades"
            )

        db.flush()

        print("\n[VALIDACIÓN ANTES DE COMMIT]")

        inconsistencias = []

        for persona in personas:
            expected_names = [
                nombre
                for (nombre,) in (
                    db.query(models.Skill.nombre)
                    .join(
                        models.PersonaSkill,
                        models.PersonaSkill.skill_id == models.Skill.id,
                    )
                    .filter(models.PersonaSkill.persona_id == persona.id)
                    .order_by(models.Skill.nombre.asc())
                    .all()
                )
            ]

            actual_names = list(persona.habilidades or [])

            if actual_names != expected_names:
                inconsistencias.append(persona.id)

        if inconsistencias:
            raise RuntimeError(
                "Persisten inconsistencias en persona.habilidades para: "
                + ", ".join(inconsistencias)
            )

        print(f"Personas validadas : {len(personas)} [OK]")
        print(f"Habilidades totales sincronizadas: {total_habilidades}")

        print("\nEjecutando COMMIT...")
        db.commit()

        print("\n" + "=" * 78)
        print("SINCRONIZACIÓN COMPLETADA CORRECTAMENTE")
        print("=" * 78)
        print("Solo se actualizó Persona.habilidades para las 22 personas del Excel.")
        print("No se modificaron otros campos.")
        print("=" * 78)

        return 0

    except Exception as exc:
        print("\n[ERROR] Falló la sincronización.")
        print(f"Detalle: {exc}")
        print("Ejecutando ROLLBACK...")
        db.rollback()
        print("ROLLBACK completado.")
        raise

    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
