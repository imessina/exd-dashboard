from __future__ import annotations

import json
import re
import shutil
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Any


BASE_DIR = Path(__file__).resolve().parent

INPUT_PATH = (
    BASE_DIR
    / "data"
    / "curriculums_carga_actualizada.json"
)

OUTPUT_PATH = (
    BASE_DIR
    / "data"
    / "curriculums_carga_limpia.json"
)

REPORT_PATH = (
    BASE_DIR
    / "reporte_limpieza_curriculums.json"
)

BACKUP_DIR = BASE_DIR / "backups"


# Fragmentos que sabemos que no corresponden a experiencias.
TITULOS_BASURA = {
    "relevante",
    "como",
    "seleccionadas",
    "seleccionada",
    "descriptions",
    "description",
}


# Inicios que normalmente representan continuación de una experiencia
# anterior, no una nueva experiencia independiente.
INICIOS_CONTINUACION = (
    "mis tareas",
    "mis funciones",
    "funciones",
    "responsabilidades",
    "principales funciones",
    "principales tareas",
    "logros",
    "entre mis funciones",
    "dentro de las principales funciones",
    "proyecto iadvisors",
    "implementacion de piloto",
    "implementación de piloto",
    "reporte de proyecto",
    "continuacion de proyecto",
    "continuación de proyecto",
    "creacion de identidad",
    "creación de identidad",
    "lidere el desarrollo",
    "lideré el desarrollo",
    "gestione proyectos",
    "gestioné proyectos",
    "participe en la investigacion",
    "participé en la investigación",
    "realizacion de variadas demos",
    "realización de variadas demos",
)


def normalizar_texto(texto: Any) -> str:
    if texto is None:
        return ""

    texto = str(texto)
    texto = unicodedata.normalize("NFC", texto)
    texto = texto.replace("\x0b", "\n")
    texto = texto.replace("\r\n", "\n")
    texto = texto.replace("\r", "\n")

    lineas = [
        re.sub(r"[ \t]+", " ", linea).strip()
        for linea in texto.splitlines()
    ]

    lineas_limpias: list[str] = []
    linea_anterior_vacia = False

    for linea in lineas:
        if not linea:
            if linea_anterior_vacia:
                continue

            linea_anterior_vacia = True
            lineas_limpias.append("")
            continue

        linea_anterior_vacia = False
        lineas_limpias.append(linea)

    return "\n".join(lineas_limpias).strip()


def normalizar_comparacion(texto: Any) -> str:
    texto = normalizar_texto(texto)

    if not texto:
        return ""

    texto = unicodedata.normalize("NFKD", texto)

    texto = "".join(
        caracter
        for caracter in texto
        if not unicodedata.combining(caracter)
    )

    texto = texto.lower()
    texto = re.sub(r"[^a-z0-9]+", " ", texto)

    return " ".join(texto.split())


def texto_experiencia(experiencia: dict[str, Any]) -> str:
    partes = [
        normalizar_texto(experiencia.get("titulo")),
        normalizar_texto(experiencia.get("descripcion")),
    ]

    return "\n".join(
        parte
        for parte in partes
        if parte
    ).strip()


def tiene_metadatos_experiencia(
    experiencia: dict[str, Any],
) -> bool:
    campos = (
        "cliente",
        "proyecto",
        "rol",
        "periodo",
    )

    return any(
        normalizar_texto(experiencia.get(campo))
        for campo in campos
    )


def es_titulo_basura(titulo: str) -> bool:
    return normalizar_comparacion(titulo) in TITULOS_BASURA


def parece_continuacion(
    experiencia: dict[str, Any],
) -> bool:
    """
    Determina si un registro parece ser texto desprendido de la
    experiencia anterior.

    La regla es conservadora:
    - no debe tener cliente, proyecto, rol ni periodo;
    - puede tener un título largo o un comienzo genérico;
    - debe existir una experiencia anterior para poder unirlo.
    """
    if tiene_metadatos_experiencia(experiencia):
        return False

    titulo = normalizar_texto(
        experiencia.get("titulo")
    )

    descripcion = normalizar_texto(
        experiencia.get("descripcion")
    )

    titulo_normalizado = normalizar_comparacion(titulo)

    if not titulo and descripcion:
        return True

    if any(
        titulo_normalizado.startswith(
            normalizar_comparacion(inicio)
        )
        for inicio in INICIOS_CONTINUACION
    ):
        return True

    # Una oración extensa sin metadatos suele ser una descripción
    # separada por el orden interno del PowerPoint.
    if len(titulo) >= 100:
        return True

    # Una frase completa con descripción adjunta también suele ser
    # continuación de una experiencia anterior.
    if (
        descripcion
        and len(titulo) >= 40
        and (
            titulo.endswith(".")
            or titulo.endswith(":")
        )
    ):
        return True

    return False


def anexar_descripcion(
    experiencia_destino: dict[str, Any],
    texto_nuevo: str,
) -> None:
    texto_nuevo = normalizar_texto(texto_nuevo)

    if not texto_nuevo:
        return

    descripcion_actual = normalizar_texto(
        experiencia_destino.get("descripcion")
    )

    if not descripcion_actual:
        experiencia_destino["descripcion"] = texto_nuevo
        return

    comparacion_actual = normalizar_comparacion(
        descripcion_actual
    )

    comparacion_nueva = normalizar_comparacion(
        texto_nuevo
    )

    if (
        comparacion_nueva
        and comparacion_nueva in comparacion_actual
    ):
        return

    experiencia_destino["descripcion"] = (
        f"{descripcion_actual}\n\n{texto_nuevo}"
    )


def limpiar_experiencia(
    experiencia: dict[str, Any],
) -> dict[str, Any]:
    experiencia_limpia = dict(experiencia)

    for campo in (
        "titulo",
        "cliente",
        "proyecto",
        "rol",
        "periodo",
        "descripcion",
    ):
        if campo in experiencia_limpia:
            valor = normalizar_texto(
                experiencia_limpia.get(campo)
            )

            experiencia_limpia[campo] = (
                valor if valor else None
            )

    return experiencia_limpia


def clave_experiencia(
    experiencia: dict[str, Any],
) -> str:
    campos = (
        "titulo",
        "cliente",
        "proyecto",
        "rol",
        "periodo",
        "descripcion",
    )

    return normalizar_comparacion(
        " | ".join(
            str(experiencia.get(campo) or "")
            for campo in campos
        )
    )


def eliminar_duplicados(
    experiencias: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], int]:
    resultado: list[dict[str, Any]] = []
    claves: set[str] = set()
    eliminados = 0

    for experiencia in experiencias:
        clave = clave_experiencia(experiencia)

        if clave and clave in claves:
            eliminados += 1
            continue

        if clave:
            claves.add(clave)

        resultado.append(experiencia)

    return resultado, eliminados


def limpiar_curriculum(
    registro: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    registro_limpio = dict(registro)

    curriculum = dict(
        registro_limpio.get("curriculum") or {}
    )

    # Todo lo importado quedará explícitamente pendiente
    # de revisión humana en el mantenedor.
    curriculum["requiere_revision"] = True

    for campo in (
        "resumen_profesional",
        "linkedin",
        "archivo_origen",
    ):
        if campo in curriculum:
            valor = normalizar_texto(
                curriculum.get(campo)
            )

            curriculum[campo] = (
                valor if valor else None
            )

    for campo_lista in (
        "areas_especializacion",
        "herramientas_tecnologias",
        "clientes_asesorados",
        "estudios_posgrados",
        "idiomas",
        "certificaciones",
    ):
        valores = curriculum.get(campo_lista) or []

        valores_limpios: list[str] = []
        valores_vistos: set[str] = set()

        for valor in valores:
            texto = normalizar_texto(valor)
            clave = normalizar_comparacion(texto)

            if not texto or not clave:
                continue

            if clave in valores_vistos:
                continue

            valores_vistos.add(clave)
            valores_limpios.append(texto)

        curriculum[campo_lista] = valores_limpios

    registro_limpio["curriculum"] = curriculum

    experiencias_originales = (
        registro_limpio.get("experiencias") or []
    )

    experiencias_limpias: list[dict[str, Any]] = []

    eliminadas_basura: list[str] = []
    unidas_anterior: list[str] = []

    for experiencia_original in experiencias_originales:
        experiencia = limpiar_experiencia(
            experiencia_original
        )

        titulo = normalizar_texto(
            experiencia.get("titulo")
        )

        descripcion = normalizar_texto(
            experiencia.get("descripcion")
        )

        if es_titulo_basura(titulo):
            eliminadas_basura.append(titulo)

            # En el caso de fragmentos como "como", su descripción
            # todavía puede ser útil para la siguiente experiencia,
            # pero no conocemos con certeza su relación. Para evitar
            # contaminación, el fragmento se elimina y el CV queda
            # marcado para revisión.
            continue

        if (
            experiencias_limpias
            and parece_continuacion(experiencia)
        ):
            contenido = texto_experiencia(experiencia)

            anexar_descripcion(
                experiencias_limpias[-1],
                contenido,
            )

            unidas_anterior.append(
                titulo or descripcion[:100]
            )

            continue

        # No conservamos registros completamente vacíos.
        if (
            not titulo
            and not descripcion
            and not tiene_metadatos_experiencia(
                experiencia
            )
        ):
            continue

        experiencias_limpias.append(experiencia)

    experiencias_limpias, duplicados_eliminados = (
        eliminar_duplicados(experiencias_limpias)
    )

    registro_limpio["experiencias"] = (
        experiencias_limpias
    )

    detalle = {
        "persona_id": registro_limpio.get(
            "persona_id"
        ),
        "nombre_persona": registro_limpio.get(
            "nombre_persona"
        ),
        "archivo": curriculum.get(
            "archivo_origen"
        ),
        "experiencias_antes": len(
            experiencias_originales
        ),
        "experiencias_despues": len(
            experiencias_limpias
        ),
        "fragmentos_basura_eliminados": (
            eliminadas_basura
        ),
        "fragmentos_unidos_a_anterior": (
            unidas_anterior
        ),
        "duplicados_eliminados": (
            duplicados_eliminados
        ),
    }

    return registro_limpio, detalle


def validar_resultado(
    registros: list[dict[str, Any]],
) -> None:
    if len(registros) != 73:
        raise ValueError(
            "Se esperaban 73 currículums, "
            f"pero se obtuvieron {len(registros)}."
        )

    persona_ids = [
        registro.get("persona_id")
        for registro in registros
    ]

    ids_vacios = [
        indice
        for indice, persona_id
        in enumerate(persona_ids, start=1)
        if not persona_id
    ]

    if ids_vacios:
        raise ValueError(
            "Existen registros sin persona_id "
            f"en posiciones: {ids_vacios}"
        )

    if len(set(persona_ids)) != len(persona_ids):
        repetidos = sorted({
            persona_id
            for persona_id in persona_ids
            if persona_ids.count(persona_id) > 1
        })

        raise ValueError(
            "Existen persona_id duplicados: "
            f"{repetidos}"
        )


def main() -> None:
    if not INPUT_PATH.exists():
        raise FileNotFoundError(
            f"No se encontró el archivo: {INPUT_PATH}"
        )

    BACKUP_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    marca_tiempo = datetime.now().strftime(
        "%Y%m%d_%H%M%S"
    )

    backup_path = (
        BACKUP_DIR
        / (
            "curriculums_carga_actualizada_"
            f"{marca_tiempo}.json"
        )
    )

    shutil.copy2(
        INPUT_PATH,
        backup_path,
    )

    datos = json.loads(
        INPUT_PATH.read_text(encoding="utf-8")
    )

    if not isinstance(datos, list):
        raise ValueError(
            "El archivo de entrada no contiene "
            "una lista de currículums."
        )

    registros_limpios: list[dict[str, Any]] = []
    detalle_limpieza: list[dict[str, Any]] = []

    for registro in datos:
        registro_limpio, detalle = (
            limpiar_curriculum(registro)
        )

        registros_limpios.append(
            registro_limpio
        )

        detalle_limpieza.append(
            detalle
        )

    validar_resultado(registros_limpios)

    total_antes = sum(
        item["experiencias_antes"]
        for item in detalle_limpieza
    )

    total_despues = sum(
        item["experiencias_despues"]
        for item in detalle_limpieza
    )

    total_basura = sum(
        len(item["fragmentos_basura_eliminados"])
        for item in detalle_limpieza
    )

    total_unidos = sum(
        len(item["fragmentos_unidos_a_anterior"])
        for item in detalle_limpieza
    )

    total_duplicados = sum(
        item["duplicados_eliminados"]
        for item in detalle_limpieza
    )

    sin_experiencias = [
        registro.get("nombre_persona")
        for registro in registros_limpios
        if not registro.get("experiencias")
    ]

    OUTPUT_PATH.write_text(
        json.dumps(
            registros_limpios,
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    reporte = {
        "curriculums_procesados": len(
            registros_limpios
        ),
        "experiencias_antes": total_antes,
        "experiencias_despues": total_despues,
        "fragmentos_basura_eliminados": (
            total_basura
        ),
        "fragmentos_unidos_a_anterior": (
            total_unidos
        ),
        "duplicados_eliminados": (
            total_duplicados
        ),
        "personas_sin_experiencias": (
            sin_experiencias
        ),
        "archivo_entrada": str(INPUT_PATH),
        "archivo_salida": str(OUTPUT_PATH),
        "backup": str(backup_path),
        "detalle": detalle_limpieza,
    }

    REPORT_PATH.write_text(
        json.dumps(
            reporte,
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print()
    print("LIMPIEZA FINALIZADA")
    print(
        "Currículums procesados:",
        reporte["curriculums_procesados"],
    )
    print(
        "Experiencias antes:",
        reporte["experiencias_antes"],
    )
    print(
        "Experiencias después:",
        reporte["experiencias_despues"],
    )
    print(
        "Fragmentos basura eliminados:",
        reporte["fragmentos_basura_eliminados"],
    )
    print(
        "Fragmentos unidos a experiencia anterior:",
        reporte[
            "fragmentos_unidos_a_anterior"
        ],
    )
    print(
        "Duplicados eliminados:",
        reporte["duplicados_eliminados"],
    )
    print(
        "Personas sin experiencias:",
        len(
            reporte["personas_sin_experiencias"]
        ),
    )
    print("Archivo limpio:", OUTPUT_PATH)
    print("Reporte:", REPORT_PATH)
    print("Backup:", backup_path)


if __name__ == "__main__":
    main()