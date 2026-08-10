from collections import OrderedDict
from typing import Any

from strands import Agent
from strands.agent.conversation_manager.null_conversation_manager import (
    NullConversationManager,
)
from bedrock_agentcore.runtime import BedrockAgentCoreApp

from model.load import load_model

from tools.personas import (
    listar_personas,
    obtener_persona,
    obtener_capacidades_persona,
    buscar_personas_por_capacidad,
)


app = BedrockAgentCoreApp()
log = app.logger


DEFAULT_SYSTEM_PROMPT = """
Eres TalentIA, un asistente interno de inteligencia artificial para apoyar la gestión
de talento del equipo DX de NTT DATA.

Tu objetivo es ayudar a analizar personas, capacidades, experiencia, currículums,
estructura de talento, brechas de capacidades y necesidades de equipos.

Reglas de funcionamiento:

- Responde en español por defecto.
- Sé claro, profesional y directo.
- No inventes personas, cargos, capacidades, experiencias, certificaciones,
  asignaciones, proyectos ni datos internos.
- Si no tienes información suficiente para responder una consulta sobre datos internos,
  indícalo claramente.
- Cuando existan herramientas conectadas a los sistemas internos, utilízalas para
  obtener información real antes de responder.
- Distingue siempre entre datos obtenidos de herramientas y recomendaciones o análisis
  generados por ti.
- Explica de forma comprensible por qué recomiendas una persona, equipo o capacidad.
- No ejecutes cambios operativos ni modificaciones de datos sin una confirmación
  explícita del usuario.
- No afirmes tener acceso a Internet, sistemas internos, personas, currículums,
  bases de datos u otras fuentes si esas herramientas no están actualmente disponibles.

Tienes acceso de solo lectura a información real de personas y capacidades
del Dashboard DX mediante herramientas.

Cuando el usuario pregunte por personas, cargos, niveles, oferta de valor
o capacidades registradas, utiliza las herramientas antes de responder.

Reglas específicas para capacidades:

- Para preguntas globales sobre una capacidad, utiliza siempre
  buscar_personas_por_capacidad.
- Esto incluye consultas como:
  "¿Quién tiene AWS?",
  "¿Quién tiene AWS nivel 3 o más?",
  "Personas con React nivel 4",
  "¿Quién sabe Python?".
- Si el usuario indica un nivel mínimo, pásalo a la herramienta.
- Si no indica nivel mínimo, utiliza nivel 1.
- No uses la memoria de conversaciones anteriores para determinar la lista completa
  de personas que poseen una capacidad.
- No afirmes que una búsqueda por capacidad es completa si no utilizaste
  buscar_personas_por_capacidad.
- El resultado de buscar_personas_por_capacidad representa la búsqueda actual
  sobre toda la fuente de capacidades registrada en Dashboard DX.
- Si la herramienta informa un total, respeta ese total y no omitas personas salvo
  que el usuario haya pedido una cantidad limitada.
- Si una capacidad no existe exactamente y la herramienta devuelve sugerencias,
  informa las sugerencias al usuario en lugar de inventar una coincidencia.
- Para conocer todas las capacidades de una persona concreta, utiliza
  obtener_capacidades_persona.

No inventes resultados si una herramienta no devuelve datos.

Por ahora no tienes acceso completo a currículums, asignaciones,
proyectos ni oportunidades, salvo que posteriormente se incorporen
herramientas específicas para esas fuentes.

Formato de respuesta para el chat:

- Las respuestas se mostrarán dentro de una ventana de chat estrecha.
- Prefiere listas verticales y bloques breves.
- Evita tablas Markdown siempre que sea posible.
- No uses tablas cuando haya más de 3 columnas.

- Para mostrar personas, usa preferentemente este formato:

  **1. Nombre Apellido**
  - Cargo: ...
  - Nivel: ...
  - Oferta: ...

- Cuando una consulta sea sobre una capacidad, incluye también el nivel
  de dicha capacidad cuando esté disponible.

- Si el usuario solicita varias personas, presenta cada persona en un bloque separado.
- Usa títulos breves solo cuando aporten claridad.
- Evita introducciones largas antes de entregar el resultado.
- Evita repetir información innecesariamente.
- No agregues observaciones generales si el usuario solo pidió una lista.
- No termines todas las respuestas preguntando "¿En qué más puedo ayudarte?".
- Prioriza respuestas compactas, escaneables y fáciles de leer.
- Despues de terminar de responder,agrega preguntas de seguimiento o sugerencias de temas relacionados.
- No respondas nada que no esté relacionado con el dashboard DX, personas, capacidades, experiencia, currículums, estructura de talento, brechas de capacidades y necesidades de equipos.
"""


tools = [
    listar_personas,
    obtener_persona,
    obtener_capacidades_persona,
    buscar_personas_por_capacidad,
]


def _make_conversation_manager():
    return NullConversationManager()


def agent_factory():
    cache = OrderedDict()

    def get_or_create_agent(session_id):
        if session_id in cache:
            cache.move_to_end(session_id)
            return cache[session_id]

        if len(cache) >= 128:
            cache.popitem(last=False)

        cache[session_id] = Agent(
            model=load_model(),
            system_prompt=DEFAULT_SYSTEM_PROMPT,
            tools=tools,
            conversation_manager=_make_conversation_manager(),
            callback_handler=None,
            hooks=[],
        )

        return cache[session_id]

    return get_or_create_agent


get_or_create_agent = agent_factory()


def strip_trailing_tool_use(messages: Any) -> list[dict]:
    """Remove trailing toolUse blocks from incoming conversation messages."""

    if not isinstance(messages, list):
        raise ValueError("messages must be a list")

    messages = list(messages)

    while messages:
        last = messages[-1]

        if not isinstance(last, dict):
            raise ValueError("each message must be an object")

        original_content = last.get("content", [])

        if not isinstance(original_content, list) or not all(
            isinstance(block, dict)
            for block in original_content
        ):
            raise ValueError(
                "each message content value must be a list of content blocks"
            )

        content = [
            block
            for block in original_content
            if "toolUse" not in block
        ]

        if len(content) == len(original_content):
            break

        if content:
            messages[-1] = {
                **last,
                "content": content,
            }
            break

        messages.pop()

    return messages


def _extract_prompt(payload: dict):
    """Accept harness messages, tool results, or a plain prompt string."""

    if not isinstance(payload, dict):
        raise ValueError("payload must be a JSON object")

    if "messages" in payload:
        return strip_trailing_tool_use(
            payload["messages"]
        )

    if "tool_results" in payload:
        tool_results = payload["tool_results"]

        if not isinstance(tool_results, list) or not all(
            isinstance(tool_result, dict)
            and isinstance(tool_result.get("toolUseId"), str)
            for tool_result in tool_results
        ):
            raise ValueError(
                "tool_results must contain objects with a toolUseId string"
            )

        return [
            {
                "role": "user",
                "content": [
                    {
                        "toolResult": {
                            "toolUseId": tool_result["toolUseId"],
                            "status": tool_result.get(
                                "status",
                                "success",
                            ),
                            "content": tool_result.get(
                                "content",
                                [],
                            ),
                        }
                    }
                    for tool_result in tool_results
                ],
            }
        ]

    prompt = payload.get("prompt", "")

    if not isinstance(prompt, str):
        raise ValueError("prompt must be a string")

    return prompt


@app.entrypoint
async def invoke(payload, context):
    log.info("Invoking TalentIA")

    session_id = getattr(
        context,
        "session_id",
        "default-session",
    )

    agent = get_or_create_agent(session_id)

    prompt = _extract_prompt(payload)

    async for event in agent.stream_async(prompt):
        if not isinstance(event, dict) or "event" not in event:
            continue

        content_block_start = event["event"].get(
            "contentBlockStart"
        )

        if (
            content_block_start is not None
            and not content_block_start.get("start")
        ):
            continue

        yield event


if __name__ == "__main__":
    app.run()