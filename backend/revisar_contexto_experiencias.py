from __future__ import annotations

import json
from pathlib import Path
from typing import Any


BASE_DIR = Path(__file__).resolve().parent

DATA_PATH = (
    BASE_DIR
    / "data"
    / "curriculums_carga_actualizada.json"
)

VALIDATION_PATH = (
    BASE_DIR
    / "reporte_validacion_experiencias.json"
)

OUTPUT_PATH = (
    BASE_DIR
    / "reporte_contexto_experiencias_sospechosas.json"
)


def compact_experience(
    experience: dict[str, Any] | None,
) -> dict[str, Any] | None:
    if experience is None:
        return None

    return {
        "titulo": experience.get("titulo"),
        "cliente": experience.get("cliente"),
        "proyecto": experience.get("proyecto"),
        "rol": experience.get("rol"),
        "periodo": experience.get("periodo"),
        "descripcion": experience.get("descripcion"),
    }


def main() -> None:
    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"No se encontró: {DATA_PATH}"
        )

    if not VALIDATION_PATH.exists():
        raise FileNotFoundError(
            f"No se encontró: {VALIDATION_PATH}"
        )

    curriculums = json.loads(
        DATA_PATH.read_text(encoding="utf-8")
    )

    validation = json.loads(
        VALIDATION_PATH.read_text(encoding="utf-8")
    )

    curriculums_by_id = {
        record.get("persona_id"): record
        for record in curriculums
    }

    results: list[dict[str, Any]] = []

    for item in validation.get("detalle", []):
        suspicious = item.get(
            "experiencias_sospechosas",
            [],
        )

        if not suspicious:
            continue

        persona_id = item.get("persona_id")
        curriculum = curriculums_by_id.get(persona_id)

        if not curriculum:
            continue

        experiences = curriculum.get(
            "experiencias",
            [],
        )

        cases: list[dict[str, Any]] = []

        for suspicious_item in suspicious:
            index_one_based = suspicious_item.get("indice")
            index = index_one_based - 1

            previous_experience = (
                experiences[index - 1]
                if index > 0
                else None
            )

            current_experience = (
                experiences[index]
                if 0 <= index < len(experiences)
                else None
            )

            next_experience = (
                experiences[index + 1]
                if index + 1 < len(experiences)
                else None
            )

            cases.append({
                "indice": index_one_based,
                "razones": suspicious_item.get(
                    "razones",
                    [],
                ),
                "anterior": compact_experience(
                    previous_experience
                ),
                "actual": compact_experience(
                    current_experience
                ),
                "siguiente": compact_experience(
                    next_experience
                ),
            })

        results.append({
            "persona_id": persona_id,
            "persona_nombre": item.get(
                "persona_nombre"
            ),
            "archivo": item.get("archivo"),
            "cantidad_experiencias": len(
                experiences
            ),
            "casos": cases,
        })

    report = {
        "personas_con_casos": len(results),
        "casos_sospechosos": sum(
            len(item["casos"])
            for item in results
        ),
        "detalle": results,
    }

    OUTPUT_PATH.write_text(
        json.dumps(
            report,
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print("REVISIÓN DE CONTEXTO FINALIZADA")
    print(
        "Personas con casos:",
        report["personas_con_casos"],
    )
    print(
        "Casos sospechosos:",
        report["casos_sospechosos"],
    )
    print("Reporte:", OUTPUT_PATH)

    for person in results:
        print()
        print("=" * 80)
        print(person["persona_nombre"])
        print(
            "Experiencias totales:",
            person["cantidad_experiencias"],
        )

        for case in person["casos"]:
            print()
            print(
                "--- CASO",
                case["indice"],
                "---",
            )
            print(
                "Razones:",
                case["razones"],
            )

            print()
            print("ANTERIOR:")
            print(
                json.dumps(
                    case["anterior"],
                    ensure_ascii=False,
                    indent=2,
                )
            )

            print()
            print("ACTUAL:")
            print(
                json.dumps(
                    case["actual"],
                    ensure_ascii=False,
                    indent=2,
                )
            )

            print()
            print("SIGUIENTE:")
            print(
                json.dumps(
                    case["siguiente"],
                    ensure_ascii=False,
                    indent=2,
                )
            )


if __name__ == "__main__":
    main()