import asyncio
import json
import logging
import os
from typing import Any, AsyncGenerator

import boto3
import httpx
from botocore.exceptions import BotoCoreError, ClientError
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

load_dotenv()

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/ai", tags=["ai"])


AGENTCORE_MODE = os.getenv(
    "AGENTCORE_MODE",
    "local",
).strip().lower()

AGENTCORE_URL = os.getenv(
    "AGENTCORE_URL",
    "http://localhost:8080/invocations",
)

AGENTCORE_RUNTIME_ARN = os.getenv(
    "AGENTCORE_RUNTIME_ARN",
    "",
).strip()

AGENTCORE_QUALIFIER = os.getenv(
    "AGENTCORE_QUALIFIER",
    "DEFAULT",
).strip()

AWS_REGION = os.getenv(
    "AWS_REGION",
    "us-east-1",
).strip()


class AiChatRequest(BaseModel):
    message: str = Field(min_length=1)
    session_id: str = Field(min_length=1)


def _extract_text(value: Any) -> list[str]:
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
    return (
        "data: "
        + json.dumps(
            payload,
            ensure_ascii=False,
        )
        + "\n\n"
    )


def _extract_text_from_raw_json(raw: bytes) -> str:
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


def _invoke_agentcore_aws_sync(
    message: str,
    session_id: str,
) -> tuple[str, list[str]]:
    if not AGENTCORE_RUNTIME_ARN:
        raise RuntimeError(
            "AGENTCORE_RUNTIME_ARN no está configurado."
        )

    client = boto3.client(
        "bedrock-agentcore",
        region_name=AWS_REGION,
    )

    payload = json.dumps(
        {
            "prompt": message,
        },
        ensure_ascii=False,
    ).encode("utf-8")

    logger.info(
    "Invocando AgentCore runtime=%s region=%s",
    AGENTCORE_RUNTIME_ARN,
    AWS_REGION,
)


    response = client.invoke_agent_runtime(
        agentRuntimeArn=AGENTCORE_RUNTIME_ARN,
        runtimeSessionId=session_id,
        qualifier=AGENTCORE_QUALIFIER,
        contentType="application/json",
        accept="text/event-stream",
        payload=payload,
    )

    status_code = response.get("statusCode", 200)

    if status_code >= 400:
        raise RuntimeError(
            f"AgentCore AWS respondió con HTTP {status_code}."
        )

    content_type = response.get(
        "contentType",
        "",
    ).lower()

    body = response.get("response")

    if body is None:
        return content_type, []

    lines: list[str] = []

    for raw_line in body.iter_lines(chunk_size=10):
        if not raw_line:
            continue

        line = raw_line.decode("utf-8").strip()

        if not line:
            continue

        lines.append(line)

    return content_type, lines


async def _stream_agentcore_aws(
    message: str,
    session_id: str,
) -> AsyncGenerator[str, None]:
    try:
        content_type, lines = await asyncio.to_thread(
            _invoke_agentcore_aws_sync,
            message,
            session_id,
        )

        sent_text = False

        if "text/event-stream" in content_type:
            for line in lines:
                if not line.startswith("data:"):
                    continue

                data = line[5:].strip()

                if not data or data == "[DONE]":
                    continue

                try:
                    payload = json.loads(data)
                    fragments = _extract_text(payload)
                except json.JSONDecodeError:
                    fragments = [data]

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

        else:
            raw_text = "\n".join(lines).strip()

            if raw_text:
                try:
                    payload = json.loads(raw_text)
                    fragments = _extract_text(payload)
                except json.JSONDecodeError:
                    fragments = [raw_text]

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

        if not sent_text:
            yield _encode_sse(
                {
                    "type": "error",
                    "detail": "TalentIA respondió sin contenido.",
                }
            )
            return

        yield _encode_sse(
            {
                "type": "done",
            }
        )

    except (BotoCoreError, ClientError) as exc:
        logger.exception(
            "Error invocando AgentCore AWS: %s",
        exc,
        )

        yield _encode_sse(
            {
                "type": "error",
                "detail": (
                    "No fue posible comunicarse con "
                    "TalentIA en AWS."
                ),
            }
        )

    except Exception:
        logger.exception(
            "Error inesperado invocando AgentCore AWS"
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


async def _stream_agentcore_local(
    message: str,
) -> AsyncGenerator[str, None]:
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
                    "TalentIA no está disponible."
                ),
            }
        )

    except httpx.TimeoutException:
        yield _encode_sse(
            {
                "type": "error",
                "detail": (
                    "TalentIA demoró demasiado en responder."
                ),
            }
        )

    except httpx.HTTPStatusError:
        yield _encode_sse(
            {
                "type": "error",
                "detail": (
                    "TalentIA respondió con un error."
                ),
            }
        )

    except Exception:
        logger.exception(
            "Error inesperado procesando TalentIA local"
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


async def _stream_agentcore(
    message: str,
    session_id: str,
) -> AsyncGenerator[str, None]:
    if AGENTCORE_MODE == "aws":
        async for event in _stream_agentcore_aws(
            message,
            session_id,
        ):
            yield event
        return

    async for event in _stream_agentcore_local(message):
        yield event


@router.post("/chat")
async def chat_with_talentia(
    data: AiChatRequest,
):
    message = data.message.strip()
    session_id = data.session_id.strip()

    if not message:
        raise HTTPException(
            status_code=400,
            detail="El mensaje no puede estar vacío.",
        )

    if not session_id:
        raise HTTPException(
            status_code=400,
            detail="El session_id no puede estar vacío.",
        )

    return StreamingResponse(
        _stream_agentcore(
            message,
            session_id,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )