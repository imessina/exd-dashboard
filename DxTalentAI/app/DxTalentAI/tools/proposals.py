"""Extrae propuestas estructuradas de resultados de herramientas, nunca del texto del modelo."""
import json


def action_proposals(event: dict, seen: set):
    """Cada toolUseId se emite una sola vez aunque el SDK repita el mensaje."""
    message = event.get("message", {})
    if not isinstance(message, dict):
        return
    for block in message.get("content", []):
        result = block.get("toolResult", {})
        tool_id = result.get("toolUseId")
        if not tool_id or tool_id in seen or result.get("status") == "error":
            continue
        for content in result.get("content", []):
            value = content.get("json")
            if value is None and isinstance(content.get("text"), str):
                try:
                    value = json.loads(content["text"])
                except ValueError:
                    continue
            if isinstance(value, dict) and isinstance(value.get("action_proposal"), dict):
                seen.add(tool_id)
                yield {"action_proposal": value["action_proposal"]}
                break
