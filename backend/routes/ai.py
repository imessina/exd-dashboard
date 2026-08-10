import json
import logging
import os
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field


logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/ai", tags=["ai"])


AGENTCORE_URL = os.getenv(
    "AGENTCORE_URL",
    "http://localhost:8080/invocations",
)


class AiChatRequest(BaseModel):
    message: str = Field(min_length=1)


class AiChatResponse(BaseModel):
    response: str


def _extract_text(value: Any) -> list[str]:
    """
    Busca fragmentos de texto dentro de la estructura de eventos
    que devuelve AgentCore / Strands.
    """
    result: list[str] = []

    if isinstance(value, dict):
        # Evento típico de Bedrock:
        # {
        #   "event": {
        #       "contentBlockDelta": {
        #           "delta": {"text": "..."}
        #       }
        #   }
        # }
        content_block_delta = value.get("contentBlockDelta")

        if isinstance(content_block_delta, dict):
            delta = content_block_delta.get("delta")

            if isinstance(delta, dict):
                text = delta.get("text")

                if isinstance(text, str):
                    result.append(text)

        # Respuesta simple JSON.
        direct_response = value.get("response")

        if isinstance(direct_response, str):
            result.append(direct_response)

        # Algunos payloads pueden traer text directamente.
        direct_text = value.get("text")

        if isinstance(direct_text, str):
            result.append(direct_text)

        for key, child in value.items():
            if key in {
                "contentBlockDelta",
                "response",
                "text",
            }:
                continue

            result.extend(_extract_text(child))

    elif isinstance(value, list):
        for item in value:
            result.extend(_extract_text(item))

    return result


def _parse_json_response(response: httpx.Response) -> str:
    try:
        payload = response.json()
    except ValueError as exc:
        raise RuntimeError(
            "AgentCore respondió con JSON inválido."
        ) from exc

    fragments = _extract_text(payload)

    return "".join(fragments).strip()


def _parse_sse_response(response: httpx.Response) -> str:
    fragments: list[str] = []

    for raw_line in response.text.splitlines():
        line = raw_line.strip()

        if not line or not line.startswith("data:"):
            continue

        data = line[5:].strip()

        if not data or data == "[DONE]":
            continue

        try:
            payload = json.loads(data)
        except json.JSONDecodeError:
            # Si AgentCore entrega texto plano en una línea SSE,
            # lo conservamos.
            fragments.append(data)
            continue

        fragments.extend(_extract_text(payload))

    return "".join(fragments).strip()


@router.post(
    "/chat",
    response_model=AiChatResponse,
)
async def chat_with_dx_talent_ai(
    data: AiChatRequest,
):
    message = data.message.strip()

    if not message:
        raise HTTPException(
            status_code=400,
            detail="El mensaje no puede estar vacío.",
        )

    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(120.0)
        ) as client:
            response = await client.post(
                AGENTCORE_URL,
                json={
                    "prompt": message,
                },
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
            )

        response.raise_for_status()

    except httpx.ConnectError as exc:
        logger.exception(
            "No fue posible conectar con AgentCore en %s",
            AGENTCORE_URL,
        )

        raise HTTPException(
            status_code=503,
            detail=(
                "DX Talent AI no está disponible. "
                "Verifica que AgentCore esté iniciado."
            ),
        ) from exc

    except httpx.TimeoutException as exc:
        logger.exception(
            "Timeout esperando respuesta de AgentCore"
        )

        raise HTTPException(
            status_code=504,
            detail="DX Talent AI demoró demasiado en responder.",
        ) from exc

    except httpx.HTTPStatusError as exc:
        logger.exception(
            "AgentCore respondió con HTTP %s",
            exc.response.status_code,
        )

        raise HTTPException(
            status_code=502,
            detail="DX Talent AI respondió con un error.",
        ) from exc

    except httpx.RequestError as exc:
        logger.exception(
            "Error comunicándose con AgentCore"
        )

        raise HTTPException(
            status_code=503,
            detail="No fue posible comunicarse con DX Talent AI.",
        ) from exc

    content_type = response.headers.get(
        "content-type",
        "",
    ).lower()

    try:
        if "text/event-stream" in content_type:
            text = _parse_sse_response(response)
        elif "application/json" in content_type:
            text = _parse_json_response(response)
        else:
            # Fallback útil para el runtime local.
            raw = response.text.strip()

            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                text = raw
            else:
                text = "".join(
                    _extract_text(payload)
                ).strip()

    except RuntimeError as exc:
        logger.exception(
            "No fue posible interpretar la respuesta de AgentCore"
        )

        raise HTTPException(
            status_code=502,
            detail="La respuesta de DX Talent AI no pudo ser interpretada.",
        ) from exc

    if not text:
        logger.error(
            "AgentCore respondió sin texto. Content-Type=%s Body=%r",
            content_type,
            response.text[:1000],
        )

        raise HTTPException(
            status_code=502,
            detail="DX Talent AI respondió sin contenido.",
        )

    return {
        "response": text,
    }