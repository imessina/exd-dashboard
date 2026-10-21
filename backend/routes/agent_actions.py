"""Recibe confirmaciones del navegador autenticado; nunca del modelo ni de una API key compartida."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, ConfigDict, StrictBool
from sqlalchemy.orm import Session

from auth import require_editor_or_higher
from database import get_db
from services.agent_actions import resolve_action

router = APIRouter(prefix="/ai/actions", tags=["ai"])


class ActionDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")
    session_id: str = Field(min_length=1, max_length=200)
    confirm: StrictBool


@router.post("/{action_id}/decision")
def decide_action(action_id: str, data: ActionDecision, user: dict = Depends(require_editor_or_higher), db: Session = Depends(get_db)):
    """El cliente solo envía la decisión; el contenido aprobado se obtiene de la base de datos."""
    return resolve_action(db, action_id, user, data.session_id, data.confirm)
