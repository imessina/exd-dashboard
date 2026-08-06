from __future__ import annotations

import json
import zipfile
from pathlib import Path
from tempfile import TemporaryDirectory

from generar_carga_curriculums import extract_texts, normalize_unicode


BASE_DIR = Path(__file__).resolve().parent

ZIP_PATH = (
    BASE_DIR
    / "data"
    / "curriculums_raw"
    / "CVs.zip"
)

REPORT_PATH = (
    BASE_DIR
    / "reporte_extraccion_curriculums.json"
)

OUTPUT_DIR = (
    BASE_DIR
    / "data"
    / "revision_advertencias_curriculums"
)

SUMMARY_PATH = (
    OUTPUT_DIR
    / "resumen_revision.json"
)


def main() -> None:
    if not ZIP_PATH.exists():
        raise FileNotFoundError(
            f"No se encontró el ZIP: {ZIP_PATH}"
        )

    if not REPORT_PATH.exists():
        raise FileNotFoundError(
            f"No se encontró el reporte: {REPORT_PATH}"
        )

    reporte = json.loads(
        REPORT_PATH.read_text(encoding="utf-8")
    )

    detalle = reporte.get("detalle", [])

    problematicos = [
        item
        for item in detalle
        if item.get("advertencias")
    ]

    if not problematicos:
        print("No existen currículums con advertencias.")
        return

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    resultados: list[dict] = []
    errores: list[dict] = []

    with zipfile.ZipFile(ZIP_PATH) as archivo_zip:
        indice_zip = {
            Path(nombre).name: nombre
            for nombre in archivo_zip.namelist()
            if nombre.lower().endswith(".pptx")
        }

        with TemporaryDirectory() as directorio_temporal:
            temporal_base = Path(directorio_temporal)

            total = len(problematicos)

            for numero, item in enumerate(
                problematicos,
                start=1,
            ):
                archivo = item.get("archivo")
                persona_nombre = item.get(
                    "persona_nombre",
                    "Sin nombre",
                )

                print(
                    f"[{numero}/{total}] "
                    f"Inspeccionando {persona_nombre}"
                )

                nombre_interno = indice_zip.get(archivo)

                if not nombre_interno:
                    errores.append({
                        "persona_nombre": persona_nombre,
                        "archivo": archivo,
                        "error": "No se encontró dentro del ZIP.",
                    })
                    continue

                ruta_temporal = temporal_base / archivo

                try:
                    ruta_temporal.write_bytes(
                        archivo_zip.read(nombre_interno)
                    )

                    bloques, metodo = extract_texts(
                        ruta_temporal
                    )

                except Exception as exc:
                    errores.append({
                        "persona_nombre": persona_nombre,
                        "archivo": archivo,
                        "error": str(exc),
                    })
                    continue

                diapositivas = []

                for indice, bloque in enumerate(
                    bloques,
                    start=1,
                ):
                    diapositivas.append({
                        "diapositiva_o_bloque": indice,
                        "texto": normalize_unicode(bloque),
                    })

                resultado = {
                    "persona_id": item.get("persona_id"),
                    "persona_nombre": persona_nombre,
                    "archivo": archivo,
                    "advertencias": item.get(
                        "advertencias",
                        [],
                    ),
                    "metodo_lectura": metodo,
                    "cantidad_bloques": len(bloques),
                    "diapositivas": diapositivas,
                }

                resultados.append(resultado)

                nombre_salida = (
                    f"{item.get('persona_id', numero)}"
                    f"_revision.json"
                )

                ruta_salida = OUTPUT_DIR / nombre_salida

                ruta_salida.write_text(
                    json.dumps(
                        resultado,
                        ensure_ascii=False,
                        indent=2,
                    ),
                    encoding="utf-8",
                )

                print(f"  Generado: {ruta_salida.name}")

    resumen = {
        "curriculums_con_advertencias": len(
            problematicos
        ),
        "curriculums_inspeccionados": len(
            resultados
        ),
        "errores": len(errores),
        "resultados": resultados,
        "detalle_errores": errores,
    }

    SUMMARY_PATH.write_text(
        json.dumps(
            resumen,
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print()
    print("INSPECCIÓN FINALIZADA")
    print(
        "CV con advertencias: "
        f"{len(problematicos)}"
    )
    print(
        "CV inspeccionados: "
        f"{len(resultados)}"
    )
    print(f"Errores: {len(errores)}")
    print(f"Carpeta: {OUTPUT_DIR}")
    print(f"Resumen: {SUMMARY_PATH}")


if __name__ == "__main__":
    main()