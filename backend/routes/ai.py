import json
import logging
import os
from typing import Any, AsyncGenerator

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field


logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/ai", tags=["ai"])


AGENTCORE_URL = os.getenv(
    "AGENTCORE_URL",
    "http://localhost:8080/invocations",
)


class AiChatRequest(BaseModel):
    message: str = Field(min_length=1)


def _extract_text(value: Any) -> list[str]:
    """
    Extrae únicamente fragmentos de texto útiles desde eventos
    de AgentCore / Strands.
    """
    result: list[str] = []

    if isinstance(value, dict):
        content_block_delta = value.get("contentBlockDelta")

        if isinstance(content_block_delta, dict):
            delta = content_block_delta.get("delta")

            if isinstance(delta, dict):
                text = delta.get("text")

                if isinstance(text, str):
                    result.append(text)

        direct_response = value.get("response")

        if isinstance(direct_response, str):
            result.append(direct_response)

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


def _encode_sse(payload: dict) -> str:
    """
    Convierte un payload Python a un evento SSE.
    """
    return (
        "data: "
        + json.dumps(
            payload,
            ensure_ascii=False,
        )
        + "\n\n"
    )


def _extract_text_from_raw_json(raw: bytes) -> str:
    """
    Fallback para runtimes que respondan JSON completo
    en lugar de SSE.
    """
    if not raw:
        return ""

    try:
        payload = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise RuntimeError(
            "AgentCore respondió con JSON inválido."
        ) from exc

    return "".join(
        _extract_text(payload)
    ).strip()


async def _stream_agentcore(
    message: str,
) -> AsyncGenerator[str, None]:
    """
    Consume AgentCore mediante streaming y retransmite
    solamente los fragmentos de texto necesarios al frontend.
    """

    timeout = httpx.Timeout(
        connect=10.0,
        read=120.0,
        write=30.0,
        pool=10.0,
    )

    sent_text = False

    try:
        async with httpx.AsyncClient(
            timeout=timeout,
        ) as client:
            async with client.stream(
                "POST",
                AGENTCORE_URL,
                json={
                    "prompt": message,
                },
                headers={
                    "Content-Type": "application/json",
                    "Accept": "text/event-stream",
                },
            ) as response:
                response.raise_for_status()

                content_type = response.headers.get(
                    "content-type",
                    "",
                ).lower()

                # ---------------------------------------------------------
                # AgentCore SSE
                # ---------------------------------------------------------
                if "text/event-stream" in content_type:
                    async for raw_line in response.aiter_lines():
                        line = raw_line.strip()

                        if not line:
                            continue

                        if not line.startswith("data:"):
                            continue

                        data = line[5:].strip()

                        if not data or data == "[DONE]":
                            continue

                        try:
                            payload = json.loads(data)
                        except json.JSONDecodeError:
                            logger.warning(
                                "Evento SSE no JSON recibido desde AgentCore: %r",
                                data[:500],
                            )
                            continue

                        fragments = _extract_text(payload)

                        for fragment in fragments:
                            if not fragment:
                                continue

                            sent_text = True

                            yield _encode_sse(
                                {
                                    "type": "delta",
                                    "text": fragment,
                                }
                            )

                # ---------------------------------------------------------
                # Fallback JSON
                # ---------------------------------------------------------
                else:
                    raw = await response.aread()

                    text = _extract_text_from_raw_json(
                        raw
                    )

                    if text:
                        sent_text = True

                        yield _encode_sse(
                            {
                                "type": "delta",
                                "text": text,
                            }
                        )

        if not sent_text:
            logger.error(
                "AgentCore terminó sin entregar texto."
            )

            yield _encode_sse(
                {
                    "type": "error",
                    "detail": (
                        "TalentIA respondió sin contenido."
                    ),
                }
            )

            return

        yield _encode_sse(
            {
                "type": "done",
            }
        )

    except httpx.ConnectError:
        logger.exception(
            "No fue posible conectar con AgentCore en %s",
            AGENTCORE_URL,
        )

        yield _encode_sse(
            {
                "type": "error",
                "detail": (
                    "TalentIA no está disponible. "
                    "Verifica que AgentCore esté iniciado."
                ),
            }
        )

    except httpx.TimeoutException:
        logger.exception(
            "Timeout esperando respuesta de AgentCore"
        )

        yield _encode_sse(
            {
                "type": "error",
                "detail": (
                    "TalentIA demoró demasiado en responder."
                ),
            }
        )

    except httpx.HTTPStatusError as exc:
        logger.exception(
            "AgentCore respondió con HTTP %s",
            exc.response.status_code,
        )

        yield _encode_sse(
            {
                "type": "error",
                "detail": (
                    "TalentIA respondió con un error."
                ),
            }
        )

    except httpx.RequestError:
        logger.exception(
            "Error comunicándose con AgentCore"
        )

        yield _encode_sse(
            {
                "type": "error",
                "detail": (
                    "No fue posible comunicarse con TalentIA."
                ),
            }
        )

    except RuntimeError:
        logger.exception(
            "No fue posible interpretar la respuesta de AgentCore"
        )

        yield _encode_sse(
            {
                "type": "error",
                "detail": (
                    "La respuesta de TalentIA "
                    "no pudo ser interpretada."
                ),
            }
        )

    except Exception:
        logger.exception(
            "Error inesperado procesando el stream de TalentIA"
        )

        yield _encode_sse(
            {
                "type": "error",
                "detail": (
                    "Ocurrió un error inesperado "
                    "al consultar TalentIA."
                ),
            }
        )


@router.post("/chat")
async def chat_with_talentia(
    data: AiChatRequest,
):
    message = data.message.strip()

    if not message:
        raise HTTPException(
            status_code=400,
            detail="El mensaje no puede estar vacío.",
        )

    return StreamingResponse(
        _stream_agentcore(message),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )