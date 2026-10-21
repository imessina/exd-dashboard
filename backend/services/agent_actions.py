"""Valida propuestas del agente y ejecuta únicamente acciones confirmadas, una vez y por su propietario."""
from datetime import datetime, timedelta, timezone
from hashlib import sha256
import json
from uuid import uuid4

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import Column, String, JSON, DateTime, select, update
from sqlalchemy.exc import IntegrityError

import models
import schemas
from database import Base, SessionLocal


class AgentAction(Base):
    """Registro persistente: la propuesta y el resultado comparten transacción con la escritura."""
    __tablename__ = "agent_actions"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id = Column(String(128), nullable=False, index=True)
    session_id = Column(String(64), nullable=False)
    operation = Column(String(40), nullable=False)
    payload = Column(JSON, nullable=False)
    target_id = Column(String, nullable=True)
    status = Column(String(20), nullable=False, default="pending")
    expires_at = Column(DateTime(timezone=True), nullable=False)
    result = Column(JSON, nullable=True)


class Proposal(BaseModel):
    model_config = ConfigDict(extra="forbid")
    operation: str
    payload: dict
    target_id: str | None = Field(default=None, max_length=200)


ACTION_SCHEMAS = {
    "crear_persona": schemas.PersonaCreate,
    "crear_proyecto": schemas.ProyectoCreate,
    "crear_oportunidad": schemas.OportunidadCreate,
    "actualizar_proyecto": schemas.ProyectoUpdate,
}


def scoped_session(user_id: str, session_id: str) -> str:
    """Usa el mismo identificador aislado para conversar y confirmar acciones."""
    return sha256(json.dumps([str(user_id), session_id.strip()]).encode("utf-8")).hexdigest()


def validate_proposal(value: dict):
    """Rechaza operaciones, campos y destinos no permitidos antes de mostrarlos al usuario."""
    proposal = Proposal.model_validate(value)
    schema = ACTION_SCHEMAS.get(proposal.operation)
    if schema is None or set(proposal.payload) - set(schema.model_fields):
        raise ValueError("Operación o campos no admitidos")
    if proposal.operation == "actualizar_proyecto":
        if not proposal.target_id or not proposal.payload:
            raise ValueError("Falta el proyecto o los cambios")
    elif proposal.target_id is not None:
        raise ValueError("El alta no admite un destino existente")
    validated = schema.model_validate(proposal.payload)
    proposal.payload = validated.model_dump(mode="json", exclude_unset=True)
    return proposal


def prepare_action(value: dict, user: dict, session_id: str):
    """Persiste exclusivamente una propuesta; no modifica entidades de negocio."""
    if user["rol"] not in {"editor", "admin", "superadmin"}:
        return {"type": "delta", "text": "\nNo tienes permisos para guardar estos cambios."}
    try:
        proposal = validate_proposal(value)
    except (ValidationError, ValueError):
        return {"type": "delta", "text": "\nLa propuesta contiene datos inválidos. Solicita corregirlos antes de confirmar."}
    with SessionLocal() as db:
        action = AgentAction(
            user_id=str(user["auth_user_id"]), session_id=session_id,
            operation=proposal.operation, payload=proposal.payload, target_id=proposal.target_id,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
        )
        db.add(action)
        db.commit()
        return {"type": "action", "action": {
            "id": action.id, "operation": action.operation, "payload": action.payload,
            "target_id": action.target_id, "status": action.status,
        }}


def _apply_action(db, action):
    """Aplica datos ya validados sin commit: el registro y la confirmación son atómicos."""
    schema = ACTION_SCHEMAS[action.operation]
    data = schema.model_validate(action.payload)
    if action.operation == "actualizar_proyecto":
        entity = db.execute(select(models.Proyecto).where(models.Proyecto.id == action.target_id).with_for_update()).scalar_one_or_none()
        if entity is None:
            raise HTTPException(404, "El proyecto ya no existe")
        fields = data.model_dump(exclude_unset=True)
        milestone = fields.get("next_milestone")
        if milestone and milestone.strip() != (entity.next_milestone or "").strip():
            db.add(models.HitoLog(proyecto_id=entity.id, descripcion=milestone.strip(), tipo="hito", estado="pendiente"))
        for name, value in fields.items():
            setattr(entity, name, value)
    else:
        entity_class = {
            "crear_persona": models.Persona,
            "crear_proyecto": models.Proyecto,
            "crear_oportunidad": models.Oportunidad,
        }[action.operation]
        entity = entity_class(**data.model_dump())
        db.add(entity)
    db.flush()
    return {"status": "executed", "id": str(entity.id), "operation": action.operation}


def resolve_action(db, action_id: str, user: dict, session_id: str, confirm: bool):
    """Revalida propietario, sesión, caducidad y estado. Un reintento nunca duplica la escritura."""
    if user["rol"] not in {"editor", "admin", "superadmin"}:
        raise HTTPException(403, "No tienes permisos para realizar esta acción")
    owner_id = str(user["auth_user_id"])
    scope = scoped_session(owner_id, session_id)
    action = db.execute(select(AgentAction).where(
        AgentAction.id == action_id, AgentAction.user_id == owner_id,
        AgentAction.session_id == scope,
    ).with_for_update()).scalar_one_or_none()
    if action is None:
        raise HTTPException(404, "Propuesta no encontrada")
    if action.status == "executed":
        return action.result
    if action.status != "pending":
        raise HTTPException(409, "Esta propuesta ya fue cancelada")
    now = datetime.now(timezone.utc)
    if action.expires_at.replace(tzinfo=timezone.utc) <= now:
        raise HTTPException(410, "La propuesta venció. Solicita una nueva.")
    # La actualización condicional también impide dobles clics con motores sin FOR UPDATE.
    claimed = db.execute(update(AgentAction).where(
        AgentAction.id == action.id, AgentAction.status == "pending",
    ).values(status="executing" if confirm else "cancelled"))
    if claimed.rowcount != 1:
        db.rollback()
        raise HTTPException(409, "La propuesta ya fue procesada")
    try:
        result = _apply_action(db, action) if confirm else {"status": "cancelled"}
        action.status = "executed" if confirm else "cancelled"
        action.result = result
        db.commit()
        return result
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "El registro ya existe o los datos entran en conflicto. Solicita una nueva propuesta.") from None
    except Exception:
        db.rollback()
        raise
