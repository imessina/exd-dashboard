from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from typing import Any


BASE_DIR = Path(__file__).resolve().parent

DATA_PATH = (
    BASE_DIR
    / "data"
    / "curriculums_carga_actualizada.json"
)

OUTPUT_PATH = (
    BASE_DIR
    / "reporte_validacion_experiencias.json"
)


TECHNICAL_WORDS = {
    "herramientas",
    "tecnologias",
    "tecnologías",
    "colaborativas",
    "clientes",
    "estudios",
    "posgrados",
    "certificaciones",
    "idiomas",
    "areas",
    "áreas",
    "especializacion",
    "especialización",
    "html",
    "css",
    "javascript",
    "python",
    "java",
    "figma",
    "jira",
    "github",
    "aws",
    "azure",
    "gcp",
    "sql",
}


def normalize(text: str | None) -> str:
    if not text:
        return ""

    text = unicodedata.normalize("NFKD", str(text))
    text = "".join(
        char
        for char in text
        if not unicodedata.combining(char)
    )

    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)

    return " ".join(text.split())


def experience_text(experience: dict[str, Any]) -> str:
    fields = (
        "titulo",
        "cliente",
        "proyecto",
        "rol",
        "periodo",
        "descripcion",
    )

    return " | ".join(
        str(experience.get(field) or "")
        for field in fields
    )


def suspicious_reasons(
    experience: dict[str, Any],
) -> list[str]:
    reasons: list[str] = []

    title = str(experience.get("titulo") or "").strip()
    description = str(
        experience.get("descripcion") or ""
    ).strip()

    normalized_title = normalize(title)
    title_words = set(normalized_title.split())

    if not title:
        reasons.append("Título vacío.")

    if len(title) < 5:
        reasons.append("Título demasiado corto.")

    if (
        title_words
        and title_words.issubset(TECHNICAL_WORDS)
    ):
        reasons.append(
            "El título parece una herramienta "
            "o encabezado técnico."
        )

    if normalized_title in {
        "experiencia",
        "experiencias",
        "experiencia seleccionadas",
        "experiencias seleccionadas",
        "otras experiencias",
        "experiencia profesional",
    }:
        reasons.append(
            "El título corresponde a un encabezado."
        )

    if "nombre xxxx" in normalized_title:
        reasons.append(
            "Contiene texto de plantilla."
        )

    if "cargo xxxxx" in normalized_title:
        reasons.append(
            "Contiene texto de plantilla."
        )

    if len(title) > 250:
        reasons.append(
            "Título excesivamente largo."
        )

    if (
        not experience.get("periodo")
        and not experience.get("cliente")
        and not experience.get("rol")
        and not description
    ):
        reasons.append(
            "No tiene período, cliente, rol "
            "ni descripción."
        )

    return reasons


def duplicate_key(
    experience: dict[str, Any],
) -> str:
    important_fields = (
        experience.get("titulo"),
        experience.get("cliente"),
        experience.get("proyecto"),
        experience.get("rol"),
        experience.get("periodo"),
    )

    return normalize(
        " | ".join(
            str(value or "")
            for value in important_fields
        )
    )


def main() -> None:
    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"No se encontró el archivo: {DATA_PATH}"
        )

    records = json.loads(
        DATA_PATH.read_text(encoding="utf-8")
    )

    details: list[dict[str, Any]] = []

    total_experiences = 0
    total_suspicious = 0
    total_duplicates = 0
    people_without_experiences = 0

    for record in records:
        experiences = record.get("experiencias", [])
        total_experiences += len(experiences)

        if not experiences:
            people_without_experiences += 1

        suspicious: list[dict[str, Any]] = []
        duplicates: list[dict[str, Any]] = []

        seen: dict[str, int] = {}

        for index, experience in enumerate(
            experiences,
            start=1,
        ):
            reasons = suspicious_reasons(experience)

            if reasons:
                suspicious.append({
                    "indice": index,
                    "titulo": experience.get("titulo"),
                    "razones": reasons,
                    "experiencia": experience,
                })

            key = duplicate_key(experience)

            if key:
                if key in seen:
                    duplicates.append({
                        "indice_original": seen[key],
                        "indice_duplicado": index,
                        "titulo": experience.get("titulo"),
                    })
                else:
                    seen[key] = index

        total_suspicious += len(suspicious)
        total_duplicates += len(duplicates)

        details.append({
            "persona_id": record.get("persona_id"),
            "persona_nombre": record.get(
                "nombre_persona"
            ),
            "archivo": record.get(
                "curriculum",
                {},
            ).get("archivo_origen"),
            "cantidad_experiencias": len(
                experiences
            ),
            "experiencias_sospechosas": suspicious,
            "duplicados_exactos": duplicates,
        })

    report = {
        "curriculums": len(records),
        "total_experiencias": total_experiences,
        "personas_sin_experiencias": (
            people_without_experiences
        ),
        "experiencias_sospechosas": (
            total_suspicious
        ),
        "duplicados_exactos": total_duplicates,
        "detalle": details,
    }

    OUTPUT_PATH.write_text(
        json.dumps(
            report,
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print("VALIDACIÓN FINALIZADA")
    print(f"CV revisados: {report['curriculums']}")
    print(
        "Total experiencias: "
        f"{report['total_experiencias']}"
    )
    print(
        "Personas sin experiencias: "
        f"{report['personas_sin_experiencias']}"
    )
    print(
        "Experiencias sospechosas: "
        f"{report['experiencias_sospechosas']}"
    )
    print(
        "Duplicados exactos: "
        f"{report['duplicados_exactos']}"
    )
    print(f"Reporte: {OUTPUT_PATH}")

    print()
    print("PERSONAS CON CASOS SOSPECHOSOS")

    for item in details:
        suspicious_count = len(
            item["experiencias_sospechosas"]
        )
        duplicate_count = len(
            item["duplicados_exactos"]
        )

        if suspicious_count or duplicate_count:
            print(
                f"{item['persona_nombre']} | "
                f"Experiencias: "
                f"{item['cantidad_experiencias']} | "
                f"Sospechosas: {suspicious_count} | "
                f"Duplicadas: {duplicate_count}"
            )


if __name__ == "__main__":
    main()