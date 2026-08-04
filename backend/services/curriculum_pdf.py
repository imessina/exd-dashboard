"""Generación de currículums PDF para Dashboard DX."""

from __future__ import annotations

import io
import re
import unicodedata
from typing import Any
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


AZUL_OSCURO = colors.HexColor("#101A2E")
AZUL = colors.HexColor("#127CBA")
AZUL_CLARO = colors.HexColor("#EAF6FD")
GRIS = colors.HexColor("#64748B")
GRIS_CLARO = colors.HexColor("#E2E8F0")
NEGRO = colors.HexColor("#0F172A")


def _texto(valor: Any, defecto: str = "") -> str:
    if valor is None:
        return defecto

    texto = str(valor)

    # Algunos textos importados desde DOCX/PDF llegan con tildes y eñes
    # descompuestas, por ejemplo: "i" + acento combinante. Las fuentes
    # estándar de ReportLab pueden mostrar esos signos combinantes como
    # cuadrados negros. NFC los convierte en caracteres completos: í, ñ, á.
    texto = unicodedata.normalize("NFC", texto)

    reemplazos = {
        "\u2013": "-",
        "\u2014": "-",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u00a0": " ",
        "\u2022": "-",
    }
    for original, nuevo in reemplazos.items():
        texto = texto.replace(original, nuevo)

    return re.sub(r"\s+", " ", texto).strip()


def _lista_unica(valores: Any) -> list[str]:
    if not isinstance(valores, list):
        return []

    resultado: list[str] = []
    vistos: set[str] = set()

    for valor in valores:
        limpio = _texto(valor)
        clave = unicodedata.normalize("NFKD", limpio).encode(
            "ascii", "ignore"
        ).decode("ascii").lower()

        if limpio and clave not in vistos:
            vistos.add(clave)
            resultado.append(limpio)

    return resultado


def nombre_archivo_pdf(nombre: str) -> str:
    limpio = unicodedata.normalize("NFKD", _texto(nombre)).encode(
        "ascii", "ignore"
    ).decode("ascii")
    limpio = re.sub(r"[^A-Za-z0-9]+", "_", limpio).strip("_")
    return f"CV_{limpio or 'persona'}.pdf"


def _cabecera_pie(canvas, doc):
    canvas.saveState()

    ancho, alto = A4
    canvas.setFillColor(AZUL_OSCURO)
    canvas.rect(0, alto - 31 * mm, ancho, 31 * mm, fill=1, stroke=0)

    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 16)
    canvas.drawString(18 * mm, alto - 16 * mm, "NTT DATA")

    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#B8C5D8"))
    canvas.drawRightString(
        ancho - 18 * mm,
        alto - 16 * mm,
        "Dashboard DX - Currículum profesional",
    )

    canvas.setStrokeColor(GRIS_CLARO)
    canvas.line(18 * mm, 14 * mm, ancho - 18 * mm, 14 * mm)

    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(GRIS)
    canvas.drawString(18 * mm, 9 * mm, "NTT DATA - Uso interno")
    canvas.drawRightString(
        ancho - 18 * mm,
        9 * mm,
        f"Página {doc.page}",
    )

    canvas.restoreState()


def _estilos():
    estilos_base = getSampleStyleSheet()

    return {
        "nombre": ParagraphStyle(
            "Nombre",
            parent=estilos_base["Title"],
            fontName="Helvetica-Bold",
            fontSize=20,
            leading=23,
            textColor=NEGRO,
            spaceAfter=4,
        ),
        "rol": ParagraphStyle(
            "Rol",
            parent=estilos_base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=13,
            textColor=AZUL,
            spaceAfter=2,
        ),
        "meta": ParagraphStyle(
            "Meta",
            parent=estilos_base["Normal"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=11,
            textColor=GRIS,
        ),
        "seccion": ParagraphStyle(
            "Seccion",
            parent=estilos_base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=12,
            textColor=AZUL_OSCURO,
            spaceBefore=7,
            spaceAfter=5,
            borderPadding=(0, 0, 3, 0),
        ),
        "cuerpo": ParagraphStyle(
            "Cuerpo",
            parent=estilos_base["BodyText"],
            fontName="Helvetica",
            fontSize=8.7,
            leading=12.5,
            textColor=colors.HexColor("#334155"),
            alignment=TA_LEFT,
            spaceAfter=4,
        ),
        "experiencia_titulo": ParagraphStyle(
            "ExperienciaTitulo",
            parent=estilos_base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=12,
            textColor=NEGRO,
            spaceAfter=2,
        ),
        "experiencia_meta": ParagraphStyle(
            "ExperienciaMeta",
            parent=estilos_base["BodyText"],
            fontName="Helvetica",
            fontSize=7.8,
            leading=10,
            textColor=AZUL,
            spaceAfter=3,
        ),
        "tag": ParagraphStyle(
            "Tag",
            parent=estilos_base["BodyText"],
            fontName="Helvetica",
            fontSize=7.7,
            leading=10,
            textColor=colors.HexColor("#334155"),
        ),
        "vacio": ParagraphStyle(
            "Vacio",
            parent=estilos_base["BodyText"],
            fontName="Helvetica-Oblique",
            fontSize=8,
            leading=11,
            textColor=colors.HexColor("#94A3B8"),
        ),
    }


def _parrafo(texto: str, estilo) -> Paragraph:
    return Paragraph(escape(_texto(texto)), estilo)


def _seccion_lista(titulo: str, valores: Any, estilos: dict) -> list:
    items = _lista_unica(valores)
    contenido = [Paragraph(escape(titulo.upper()), estilos["seccion"])]

    if not items:
        contenido.append(Paragraph("Sin información registrada.", estilos["vacio"]))
        return contenido

    filas = []
    fila = []
    for item in items:
        celda = Paragraph(escape(item), estilos["tag"])
        fila.append(celda)
        if len(fila) == 2:
            filas.append(fila)
            fila = []

    if fila:
        fila.append("")
        filas.append(fila)

    tabla = Table(filas, colWidths=[82 * mm, 82 * mm], hAlign="LEFT")
    tabla.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
                ("BOX", (0, 0), (-1, -1), 0.4, GRIS_CLARO),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, GRIS_CLARO),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    contenido.append(tabla)
    return contenido


def generar_curriculum_pdf(curriculum: dict[str, Any]) -> bytes:
    buffer = io.BytesIO()
    estilos = _estilos()

    doc = BaseDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=38 * mm,
        bottomMargin=20 * mm,
        title=f"Currículum - {_texto(curriculum.get('persona', {}).get('nombre'))}",
        author="NTT DATA Dashboard DX",
    )

    frame = Frame(
        doc.leftMargin,
        doc.bottomMargin,
        doc.width,
        doc.height,
        id="contenido",
    )
    doc.addPageTemplates(
        [PageTemplate(id="curriculum", frames=[frame], onPage=_cabecera_pie)]
    )

    persona = curriculum.get("persona") or {}
    nombre = _texto(persona.get("nombre"), "Sin nombre")
    rol = _texto(persona.get("rol"), "Sin rol registrado")
    numero = _texto(persona.get("numero_empleado"), "-")
    area = _texto(persona.get("area"))
    anos = persona.get("anos_experiencia")

    historia = [
        Paragraph(escape(nombre), estilos["nombre"]),
        Paragraph(escape(rol), estilos["rol"]),
    ]

    metadatos = [f"N° empleado: {numero}"]
    if area:
        metadatos.append(f"Área: {area}")
    if anos is not None:
        metadatos.append(f"Experiencia: {anos} años")

    historia.extend(
        [
            Paragraph(escape(" | ".join(metadatos)), estilos["meta"]),
            Spacer(1, 6 * mm),
            Paragraph("RESUMEN PROFESIONAL", estilos["seccion"]),
        ]
    )

    resumen = _texto(curriculum.get("resumen_profesional"))
    historia.append(
        Paragraph(
            escape(resumen or "Sin información registrada."),
            estilos["cuerpo"] if resumen else estilos["vacio"],
        )
    )

    historia.extend(
        _seccion_lista(
            "Áreas de especialización",
            curriculum.get("areas_especializacion"),
            estilos,
        )
    )

    experiencias = curriculum.get("experiencias") or []
    experiencias = sorted(
        experiencias,
        key=lambda item: item.get("orden", 99),
    )[:3]

    historia.append(Paragraph("EXPERIENCIAS SELECCIONADAS", estilos["seccion"]))

    if not experiencias:
        historia.append(
            Paragraph("Sin experiencias registradas.", estilos["vacio"])
        )
    else:
        for experiencia in experiencias:
            titulo = _texto(
                experiencia.get("titulo"),
                "Experiencia sin título",
            )

            meta = [
                _texto(experiencia.get("cliente")),
                _texto(experiencia.get("proyecto")),
                _texto(experiencia.get("rol")),
                _texto(experiencia.get("periodo")),
            ]
            meta = [valor for valor in meta if valor]

            bloque = [
                Paragraph(escape(titulo), estilos["experiencia_titulo"]),
            ]
            if meta:
                bloque.append(
                    Paragraph(escape(" | ".join(meta)), estilos["experiencia_meta"])
                )

            descripcion = _texto(experiencia.get("descripcion"))
            if descripcion:
                bloque.append(Paragraph(escape(descripcion), estilos["cuerpo"]))

            tabla_experiencia = Table(
                [[bloque]],
                colWidths=[doc.width],
                hAlign="LEFT",
            )
            tabla_experiencia.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
                        ("BOX", (0, 0), (-1, -1), 0.5, GRIS_CLARO),
                        ("LEFTPADDING", (0, 0), (-1, -1), 8),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                        ("TOPPADDING", (0, 0), (-1, -1), 7),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                    ]
                )
            )
            historia.extend([KeepTogether(tabla_experiencia), Spacer(1, 3 * mm)])

    skills = curriculum.get("skills") or []
    skills_texto = []
    for skill in skills:
        nombre_skill = _texto(skill.get("nombre"))
        if not nombre_skill:
            continue
        nivel = skill.get("nivel")
        skills_texto.append(
            f"{nombre_skill} - Nivel {nivel}"
            if nivel is not None
            else nombre_skill
        )

    historia.extend(_seccion_lista("Skills", skills_texto, estilos))
    historia.extend(
        _seccion_lista(
            "Herramientas y tecnologías",
            curriculum.get("herramientas_tecnologias"),
            estilos,
        )
    )
    historia.extend(
        _seccion_lista(
            "Clientes asesorados",
            curriculum.get("clientes_asesorados"),
            estilos,
        )
    )
    historia.extend(
        _seccion_lista(
            "Estudios y posgrados",
            curriculum.get("estudios_posgrados"),
            estilos,
        )
    )
    historia.extend(
        _seccion_lista("Idiomas", curriculum.get("idiomas"), estilos)
    )
    historia.extend(
        _seccion_lista(
            "Certificaciones",
            curriculum.get("certificaciones"),
            estilos,
        )
    )

    doc.build(historia)
    return buffer.getvalue()
