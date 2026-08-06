from __future__ import annotations

import json
import re
import unicodedata
import zipfile
from collections import defaultdict
from datetime import datetime
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

from database import SessionLocal
from models import Persona


BASE_DIR = Path(__file__).resolve().parent

ZIP_PATH = BASE_DIR / "data" / "curriculums_raw" / "CVs.zip"
REPORT_PATH = BASE_DIR / "reporte_preparacion_curriculums.json"

CANTIDAD_PERSONAS_ESPERADA = 84


# Asociaciones verificadas entre nombres de archivos y personas del panel.
#
# Se utilizan solamente para nombres donde el archivo omite segundos
# nombres o contiene palabras adicionales que dificultan el cruce automático.
#
# La clave debe estar compactada:
# - minúsculas
# - sin tildes
# - sin espacios
# - sin símbolos
MAPEO_MANUAL_PERSONAS: dict[str, str] = {
    "aliriogonzalez": "emp-299232",
    "americonarea": "emp-291244",
    "carlosabarcacalderonleadengineer": "emp-222199",
    "carolinamunoz": "emp-293412",
    "claudiamartinezs": "emp-182058",
    "felipeneira": "emp-283858",
    "franciscogonzalezrodriguezexperienceoptimization": "emp-211200",
    "francoolavepalma": "emp-196916",
    "ivanlabramunoz": "emp-194759",
    "jaimecastillo": "emp-203157",
    "jaimevalderramadiazxreality": "emp-277833",
    "jesusgarciaromero": "emp-228142",
    "karenpereirarodriguezexperiencedesing": "emp-259091",
    "pablogodoy": "emp-173177",
    "pablojofrejara": "emp-284355",
    "rebeccatapia": "emp-295869",
    "valentinaherreraarayajuniordesigner": "emp-268534",
    "felipeneirajuniorengineering": "emp-283858",
    "nadiaquezada": "emp-166259",
}


def normalizar_texto(valor: str | None) -> str:
    """
    Normaliza un texto para poder compararlo.

    Ejemplo:
        "José Muñoz"
        -> "jose munoz"
    """
    if not valor:
        return ""

    texto = unicodedata.normalize("NFKD", valor)

    texto = "".join(
        caracter
        for caracter in texto
        if not unicodedata.combining(caracter)
    )

    texto = texto.lower()
    texto = re.sub(r"[^a-z0-9]+", " ", texto)

    return " ".join(texto.split())


def compactar_texto(valor: str | None) -> str:
    """
    Normaliza un texto y elimina todos los espacios.

    Ejemplo:
        "José Muñoz"
        -> "josemunoz"
    """
    return normalizar_texto(valor).replace(" ", "")


def extraer_fecha(nombre_archivo: str) -> datetime | None:
    """
    Intenta extraer una fecha desde el nombre del archivo.

    Formatos soportados:
        YYYYMMDD
        DDMMYYYY
        YYYY-MM-DD
        DD-MM-YYYY
        YYYY_MM_DD
        DD_MM_YYYY
        YYYY

    Si solamente se encuentra el año, se utiliza el 1 de enero
    únicamente para ordenar las versiones.
    """
    nombre = Path(nombre_archivo).stem

    patrones = [
        (
            r"(?<!\d)(20\d{2})(\d{2})(\d{2})(?!\d)",
            "ymd",
        ),
        (
            r"(?<!\d)(\d{2})(\d{2})(20\d{2})(?!\d)",
            "dmy",
        ),
        (
            r"(?<!\d)(20\d{2})[-_](\d{2})[-_](\d{2})(?!\d)",
            "ymd",
        ),
        (
            r"(?<!\d)(\d{2})[-_](\d{2})[-_](20\d{2})(?!\d)",
            "dmy",
        ),
    ]

    for patron, formato in patrones:
        coincidencia = re.search(patron, nombre)

        if not coincidencia:
            continue

        try:
            valor_1, valor_2, valor_3 = map(
                int,
                coincidencia.groups(),
            )

            if formato == "ymd":
                anio = valor_1
                mes = valor_2
                dia = valor_3
            else:
                dia = valor_1
                mes = valor_2
                anio = valor_3

            return datetime(anio, mes, dia)

        except ValueError:
            continue

    coincidencia_anio = re.search(
        r"(?<!\d)(20\d{2})(?!\d)",
        nombre,
    )

    if coincidencia_anio:
        anio = int(coincidencia_anio.group(1))
        return datetime(anio, 1, 1)

    return None


def obtener_identidad(nombre_archivo: str) -> str:
    """
    Extrae la identidad probable de la persona desde el nombre
    del archivo PPTX.

    Ejemplo:
        IgnacioMessina_DigitalExperience_20260701.pptx
        -> ignaciomessina
    """
    nombre = Path(nombre_archivo).stem

    # Eliminar fechas completas.
    nombre = re.sub(
        r"(?<!\d)20\d{6}(?!\d)",
        " ",
        nombre,
    )

    nombre = re.sub(
        r"(?<!\d)\d{8}(?!\d)",
        " ",
        nombre,
    )

    nombre = re.sub(
        r"(?<!\d)\d{2}[-_]\d{2}[-_]20\d{2}(?!\d)",
        " ",
        nombre,
    )

    nombre = re.sub(
        r"(?<!\d)20\d{2}[-_]\d{2}[-_]\d{2}(?!\d)",
        " ",
        nombre,
    )

    # Eliminar años sueltos.
    nombre = re.sub(
        r"(?<!\d)20\d{2}(?!\d)",
        " ",
        nombre,
    )

    identidad = normalizar_texto(nombre)

    # Palabras que no corresponden al nombre de la persona.
    terminos_ruido = [
        "digital experience",
        "digitalexperience",
        "experience design",
        "experiencedesign",
        "experience desing",
        "experiencedesing",
        "experience optimization",
        "experienceoptimization",
        "junior engineering",
        "juniorengineering",
        "junior designer",
        "juniordesigner",
        "lead engineer",
        "leadengineer",
        "cro analyst",
        "croanalyst",
        "x reality",
        "xreality",
        "curriculum vitae",
        "curriculum",
        "resume",
        "new template",
        "template",
        "plantilla",
        "consultant",
        "consultor",
        "senior",
        "junior",
        "cai",
        "dx",
        "cv",
    ]

    terminos_ruido.sort(
        key=lambda termino: len(normalizar_texto(termino)),
        reverse=True,
    )

    for termino in terminos_ruido:
        termino_normalizado = normalizar_texto(termino)

        identidad = re.sub(
            rf"\b{re.escape(termino_normalizado)}\b",
            " ",
            identidad,
        )

    return " ".join(identidad.split())


def es_plantilla(nombre_archivo: str) -> bool:
    """
    Identifica archivos que son plantillas y no currículums.
    """
    nombre = normalizar_texto(nombre_archivo)

    palabras_plantilla = [
        "new template",
        "template",
        "plantilla",
    ]

    return any(
        palabra in nombre
        for palabra in palabras_plantilla
    )


def calcular_coincidencia(
    identidad_archivo: str,
    nombre_persona: str,
) -> dict[str, Any]:
    """
    Calcula la similitud entre la identidad obtenida desde el
    nombre del archivo y una persona existente en el panel.
    """
    identidad_normalizada = normalizar_texto(
        identidad_archivo
    )

    persona_normalizada = normalizar_texto(
        nombre_persona
    )

    identidad_compacta = compactar_texto(
        identidad_archivo
    )

    persona_compacta = compactar_texto(
        nombre_persona
    )

    if not identidad_compacta or not persona_compacta:
        return {
            "puntaje": 0.0,
            "tipo": "SIN_COINCIDENCIA",
        }

    if identidad_normalizada == persona_normalizada:
        return {
            "puntaje": 1.0,
            "tipo": "NOMBRE_EXACTO",
        }

    if identidad_compacta == persona_compacta:
        return {
            "puntaje": 1.0,
            "tipo": "NOMBRE_COMPACTO_EXACTO",
        }

    # Permite que el archivo omita segundos nombres.
    if (
        identidad_compacta in persona_compacta
        or persona_compacta in identidad_compacta
    ):
        proporcion = min(
            len(identidad_compacta),
            len(persona_compacta),
        ) / max(
            len(identidad_compacta),
            len(persona_compacta),
        )

        return {
            "puntaje": round(
                0.85 + proporcion * 0.1,
                4,
            ),
            "tipo": "NOMBRE_CONTENIDO",
        }

    tokens_archivo = set(
        identidad_normalizada.split()
    )

    tokens_persona = set(
        persona_normalizada.split()
    )

    if tokens_archivo and tokens_persona:
        interseccion = (
            tokens_archivo
            & tokens_persona
        )

        cobertura_persona = (
            len(interseccion)
            / len(tokens_persona)
        )

        cobertura_archivo = (
            len(interseccion)
            / len(tokens_archivo)
        )

        cobertura = min(
            cobertura_persona,
            cobertura_archivo,
        )
    else:
        cobertura = 0.0

    similitud = SequenceMatcher(
        None,
        identidad_compacta,
        persona_compacta,
    ).ratio()

    puntaje = max(
        cobertura,
        similitud,
    )

    return {
        "puntaje": round(puntaje, 4),
        "tipo": "COINCIDENCIA_APROXIMADA",
    }


def buscar_persona(
    identidad_archivo: str,
    personas_panel: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Busca una persona del panel para la identidad detectada.

    Primero revisa el mapeo manual confirmado.
    Luego utiliza coincidencia automática.
    """
    identidad_compacta = compactar_texto(
        identidad_archivo
    )

    persona_id_manual = MAPEO_MANUAL_PERSONAS.get(
        identidad_compacta
    )

    if persona_id_manual:
        persona_manual = next(
            (
                persona
                for persona in personas_panel
                if persona["id"] == persona_id_manual
            ),
            None,
        )

        if persona_manual:
            candidato_manual = {
                "persona_id": persona_manual["id"],
                "persona_nombre": persona_manual["nombre"],
                "puntaje": 1.0,
                "tipo_coincidencia": (
                    "MAPEO_MANUAL_CONFIRMADO"
                ),
            }

            return {
                "estado": "COINCIDENCIA_SEGURA",
                "mejor_candidato": candidato_manual,
                "candidatos": [candidato_manual],
            }

        return {
            "estado": "MAPEO_MANUAL_INVALIDO",
            "mejor_candidato": None,
            "candidatos": [],
        }

    candidatos: list[dict[str, Any]] = []

    for persona in personas_panel:
        resultado = calcular_coincidencia(
            identidad_archivo,
            persona["nombre"],
        )

        candidatos.append({
            "persona_id": persona["id"],
            "persona_nombre": persona["nombre"],
            "puntaje": resultado["puntaje"],
            "tipo_coincidencia": resultado["tipo"],
        })

    candidatos.sort(
        key=lambda candidato: candidato["puntaje"],
        reverse=True,
    )

    mejor = (
        candidatos[0]
        if candidatos
        else None
    )

    segundo = (
        candidatos[1]
        if len(candidatos) > 1
        else None
    )

    if not mejor or mejor["puntaje"] < 0.60:
        return {
            "estado": "FUERA_DEL_PANEL",
            "mejor_candidato": mejor,
            "candidatos": candidatos[:5],
        }

    diferencia_segundo = (
        mejor["puntaje"]
        - segundo["puntaje"]
        if segundo
        else mejor["puntaje"]
    )

    if mejor["puntaje"] == 1.0:
        estado = "COINCIDENCIA_SEGURA"

    elif (
        mejor["puntaje"] >= 0.90
        and diferencia_segundo >= 0.10
    ):
        estado = "COINCIDENCIA_SEGURA"

    elif (
        mejor["puntaje"] >= 0.80
        and diferencia_segundo >= 0.12
    ):
        estado = "COINCIDENCIA_PROBABLE"

    else:
        estado = "COINCIDENCIA_AMBIGUA"

    return {
        "estado": estado,
        "mejor_candidato": mejor,
        "candidatos": candidatos[:5],
    }


def seleccionar_mas_reciente(
    archivos: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Selecciona la versión más reciente de un CV.

    Prioridad:
        1. Archivo que tenga una fecha válida.
        2. Fecha más reciente.
        3. Nombre del archivo como criterio estable.
    """
    return max(
        archivos,
        key=lambda archivo: (
            archivo["fecha"] is not None,
            archivo["fecha"] or datetime.min,
            archivo["nombre"].lower(),
        ),
    )


def fecha_a_texto(
    fecha: datetime | None,
) -> str | None:
    """
    Convierte una fecha a formato ISO.
    """
    if not fecha:
        return None

    return fecha.date().isoformat()


def main() -> None:
    """
    Ejecuta la preparación y el cruce de los CV.

    Este proceso solamente lee:
        - personas desde Supabase;
        - archivos del ZIP.

    No modifica ni elimina datos de Supabase.
    """
    if not ZIP_PATH.exists():
        raise FileNotFoundError(
            "No se encontró el archivo ZIP: "
            f"{ZIP_PATH}"
        )

    db = SessionLocal()

    try:
        personas_db = (
            db.query(Persona)
            .order_by(Persona.nombre)
            .all()
        )

        personas_panel = [
            {
                "id": str(persona.id),
                "nombre": persona.nombre,
                "nombre_normalizado": normalizar_texto(
                    persona.nombre
                ),
                "nombre_compacto": compactar_texto(
                    persona.nombre
                ),
            }
            for persona in personas_db
        ]

        print(
            "Personas encontradas en el panel: "
            f"{len(personas_panel)}"
        )

        if (
            len(personas_panel)
            != CANTIDAD_PERSONAS_ESPERADA
        ):
            print(
                "ADVERTENCIA: se esperaban "
                f"{CANTIDAD_PERSONAS_ESPERADA} "
                "personas, pero la base devolvió "
                f"{len(personas_panel)}."
            )

        archivos_validos: list[
            dict[str, Any]
        ] = []

        plantillas: list[
            dict[str, Any]
        ] = []

        with zipfile.ZipFile(
            ZIP_PATH
        ) as archivo_zip:
            archivos_pptx = [
                nombre
                for nombre in archivo_zip.namelist()
                if nombre.lower().endswith(
                    ".pptx"
                )
            ]

            for nombre_zip in archivos_pptx:
                nombre_archivo = Path(
                    nombre_zip
                ).name

                if es_plantilla(
                    nombre_archivo
                ):
                    plantillas.append({
                        "archivo": nombre_archivo,
                        "motivo": (
                            "Archivo identificado "
                            "como plantilla."
                        ),
                    })
                    continue

                identidad = obtener_identidad(
                    nombre_archivo
                )

                resultado_cruce = buscar_persona(
                    identidad,
                    personas_panel,
                )

                archivos_validos.append({
                    "nombre": nombre_archivo,
                    "identidad_detectada": identidad,
                    "fecha": extraer_fecha(
                        nombre_archivo
                    ),
                    "estado_cruce": (
                        resultado_cruce[
                            "estado"
                        ]
                    ),
                    "mejor_candidato": (
                        resultado_cruce[
                            "mejor_candidato"
                        ]
                    ),
                    "candidatos": (
                        resultado_cruce[
                            "candidatos"
                        ]
                    ),
                })

        archivos_coincidentes = [
            archivo
            for archivo in archivos_validos
            if archivo["estado_cruce"] in {
                "COINCIDENCIA_SEGURA",
                "COINCIDENCIA_PROBABLE",
            }
        ]

        archivos_ambiguos = [
            archivo
            for archivo in archivos_validos
            if archivo["estado_cruce"]
            == "COINCIDENCIA_AMBIGUA"
        ]

        archivos_fuera_panel = [
            archivo
            for archivo in archivos_validos
            if archivo["estado_cruce"]
            == "FUERA_DEL_PANEL"
        ]

        mapeos_invalidos = [
            archivo
            for archivo in archivos_validos
            if archivo["estado_cruce"]
            == "MAPEO_MANUAL_INVALIDO"
        ]

        versiones_por_persona: dict[
            str,
            list[dict[str, Any]],
        ] = defaultdict(list)

        for archivo in archivos_coincidentes:
            mejor_candidato = archivo.get(
                "mejor_candidato"
            )

            if not mejor_candidato:
                continue

            persona_id = mejor_candidato[
                "persona_id"
            ]

            versiones_por_persona[
                persona_id
            ].append(archivo)

        seleccionados: list[
            dict[str, Any]
        ] = []

        duplicados_descartados: list[
            dict[str, Any]
        ] = []

        for persona in personas_panel:
            versiones = versiones_por_persona.get(
                persona["id"],
                [],
            )

            if not versiones:
                continue

            archivo_seleccionado = (
                seleccionar_mas_reciente(
                    versiones
                )
            )

            versiones_descartadas = [
                version
                for version in versiones
                if version["nombre"]
                != archivo_seleccionado[
                    "nombre"
                ]
            ]

            seleccionados.append({
                "persona_id": persona["id"],
                "persona_nombre": (
                    persona["nombre"]
                ),
                "archivo_seleccionado": (
                    archivo_seleccionado[
                        "nombre"
                    ]
                ),
                "identidad_detectada": (
                    archivo_seleccionado[
                        "identidad_detectada"
                    ]
                ),
                "fecha_seleccionada": (
                    fecha_a_texto(
                        archivo_seleccionado[
                            "fecha"
                        ]
                    )
                ),
                "estado_coincidencia": (
                    archivo_seleccionado[
                        "estado_cruce"
                    ]
                ),
                "tipo_coincidencia": (
                    archivo_seleccionado[
                        "mejor_candidato"
                    ]["tipo_coincidencia"]
                ),
                "puntaje_coincidencia": (
                    archivo_seleccionado[
                        "mejor_candidato"
                    ]["puntaje"]
                ),
                "versiones_descartadas": [
                    {
                        "archivo": (
                            version["nombre"]
                        ),
                        "fecha": fecha_a_texto(
                            version["fecha"]
                        ),
                    }
                    for version
                    in versiones_descartadas
                ],
            })

            for version in versiones_descartadas:
                duplicados_descartados.append({
                    "persona_id": (
                        persona["id"]
                    ),
                    "persona_nombre": (
                        persona["nombre"]
                    ),
                    "archivo_descartado": (
                        version["nombre"]
                    ),
                    "fecha_descartada": (
                        fecha_a_texto(
                            version["fecha"]
                        )
                    ),
                    "archivo_seleccionado": (
                        archivo_seleccionado[
                            "nombre"
                        ]
                    ),
                    "fecha_seleccionada": (
                        fecha_a_texto(
                            archivo_seleccionado[
                                "fecha"
                            ]
                        )
                    ),
                    "motivo": (
                        "Existe una versión "
                        "más reciente para "
                        "la misma persona."
                    ),
                })

        ids_con_cv = {
            seleccionado["persona_id"]
            for seleccionado in seleccionados
        }

        personas_sin_cv = [
            {
                "persona_id": persona["id"],
                "persona_nombre": (
                    persona["nombre"]
                ),
            }
            for persona in personas_panel
            if persona["id"]
            not in ids_con_cv
        ]

        reporte = {
            "fecha_generacion": (
                datetime.now().isoformat(
                    timespec="seconds"
                )
            ),
            "archivo_origen": str(
                ZIP_PATH
            ),
            "resumen": {
                "personas_esperadas_panel": (
                    CANTIDAD_PERSONAS_ESPERADA
                ),
                "personas_encontradas_panel": (
                    len(personas_panel)
                ),
                "cantidad_panel_correcta": (
                    len(personas_panel)
                    == CANTIDAD_PERSONAS_ESPERADA
                ),
                "pptx_encontrados": (
                    len(archivos_validos)
                    + len(plantillas)
                ),
                "plantillas_ignoradas": (
                    len(plantillas)
                ),
                "cv_coincidentes": (
                    len(
                        archivos_coincidentes
                    )
                ),
                "personas_con_cv_seleccionado": (
                    len(seleccionados)
                ),
                "duplicados_descartados": (
                    len(
                        duplicados_descartados
                    )
                ),
                "cv_fuera_del_panel": (
                    len(
                        archivos_fuera_panel
                    )
                ),
                "coincidencias_ambiguas": (
                    len(
                        archivos_ambiguos
                    )
                ),
                "mapeos_manual_invalidos": (
                    len(mapeos_invalidos)
                ),
                "personas_sin_cv": (
                    len(personas_sin_cv)
                ),
            },
            "seleccionados_para_importar": (
                seleccionados
            ),
            "duplicados_descartados": (
                duplicados_descartados
            ),
            "cv_fuera_del_panel": [
                {
                    "archivo": (
                        archivo["nombre"]
                    ),
                    "identidad_detectada": (
                        archivo[
                            "identidad_detectada"
                        ]
                    ),
                    "mejor_candidato": (
                        archivo[
                            "mejor_candidato"
                        ]
                    ),
                    "candidatos": (
                        archivo["candidatos"]
                    ),
                }
                for archivo
                in archivos_fuera_panel
            ],
            "coincidencias_ambiguas": [
                {
                    "archivo": (
                        archivo["nombre"]
                    ),
                    "identidad_detectada": (
                        archivo[
                            "identidad_detectada"
                        ]
                    ),
                    "mejor_candidato": (
                        archivo[
                            "mejor_candidato"
                        ]
                    ),
                    "candidatos": (
                        archivo["candidatos"]
                    ),
                }
                for archivo
                in archivos_ambiguos
            ],
            "mapeos_manual_invalidos": [
                {
                    "archivo": (
                        archivo["nombre"]
                    ),
                    "identidad_detectada": (
                        archivo[
                            "identidad_detectada"
                        ]
                    ),
                }
                for archivo
                in mapeos_invalidos
            ],
            "personas_sin_cv": (
                personas_sin_cv
            ),
            "plantillas_ignoradas": (
                plantillas
            ),
        }

        REPORT_PATH.write_text(
            json.dumps(
                reporte,
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

        resumen = reporte["resumen"]

        print()
        print(
            "PREPARACIÓN Y CRUCE "
            "FINALIZADOS"
        )

        print(
            "Personas esperadas en panel: "
            f"{resumen['personas_esperadas_panel']}"
        )

        print(
            "Personas encontradas en panel: "
            f"{resumen['personas_encontradas_panel']}"
        )

        print(
            "PPTX encontrados: "
            f"{resumen['pptx_encontrados']}"
        )

        print(
            "Plantillas ignoradas: "
            f"{resumen['plantillas_ignoradas']}"
        )

        print(
            "CV coincidentes: "
            f"{resumen['cv_coincidentes']}"
        )

        print(
            "Personas con CV seleccionado: "
            f"{resumen['personas_con_cv_seleccionado']}"
        )

        print(
            "Duplicados descartados: "
            f"{resumen['duplicados_descartados']}"
        )

        print(
            "CV fuera del panel: "
            f"{resumen['cv_fuera_del_panel']}"
        )

        print(
            "Coincidencias ambiguas: "
            f"{resumen['coincidencias_ambiguas']}"
        )

        print(
            "Mapeos manuales inválidos: "
            f"{resumen['mapeos_manual_invalidos']}"
        )

        print(
            "Personas del panel sin CV: "
            f"{resumen['personas_sin_cv']}"
        )

        print(
            "Reporte generado en: "
            f"{REPORT_PATH}"
        )

    finally:
        db.close()


if __name__ == "__main__":
    main()