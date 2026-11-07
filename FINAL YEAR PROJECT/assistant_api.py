"""The "Explain my results" assistant (cloud part). The app answers its suggested questions on the
device; free-text questions come here, only after the person agrees to send them.

GET  /assistant/status   whether a provider is set up
POST /assistant/chat     { messages: [{ role: user|assistant, content }], scores: [score summary] }
                         -> { reply, safety: null } or { reply: null, safety: <emergency code> }

What is sent to the provider: the conversation and a summary of the person's scores. Nothing is stored
or logged here, the same rule as the other endpoints.
"""
import time
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from assistant import providers
from assistant.prompt import system_prompt
from assistant.safety import emergency_in
from auth import current_user
from extraction.providers import ExtractionError

router = APIRouter(prefix="/assistant", tags=["assistant"])

MAX_TURNS = 12
MAX_MESSAGE = 1000
# Per person, to keep costs predictable
HOURLY_LIMIT = 30

ERROR_STATUS = {
    "notConfigured": status.HTTP_503_SERVICE_UNAVAILABLE,
    "rateLimited": status.HTTP_429_TOO_MANY_REQUESTS,
    "refused": status.HTTP_422_UNPROCESSABLE_CONTENT,
    "unavailable": status.HTTP_502_BAD_GATEWAY,
    "failed": status.HTTP_502_BAD_GATEWAY,
}

_recent = {}  # uid -> [timestamps]


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=MAX_MESSAGE * 4)


class Score(BaseModel):
    id: str = Field(max_length=40)
    title: Optional[str] = Field(None, max_length=120)
    status: Literal["ok", "needs_input", "not_applicable"]
    value: Optional[float] = None
    unit: Optional[str] = Field(None, max_length=20)
    category: Optional[str] = Field(None, max_length=60)
    detail: Optional[str] = Field(None, max_length=200)
    missing: Optional[list[str]] = Field(None, max_length=12)
    reason: Optional[str] = Field(None, max_length=200)


class Chat(BaseModel):
    messages: list[Message] = Field(min_length=1, max_length=MAX_TURNS * 2)
    scores: list[Score] = Field(default_factory=list, max_length=20)


def _allow(uid):
    now = time.monotonic()
    recent = [t for t in _recent.get(uid, []) if now - t < 3600]
    if len(recent) >= HOURLY_LIMIT:
        _recent[uid] = recent
        return False
    _recent[uid] = recent + [now]
    return True


@router.get("/status")
def assistant_status(uid: str = Depends(current_user)):
    provider = providers.configured_provider()
    return {
        "available": provider is not None,
        "provider": provider,
        "providerName": providers.NAMES.get(provider) if provider else None,
        "model": providers.model_for(provider) if provider else None,
    }


@router.post("/chat")
def chat(body: Chat, uid: str = Depends(current_user)):
    messages = [m.model_dump() for m in body.messages][-MAX_TURNS * 2:]
    if messages[-1]["role"] != "user" or len(messages[-1]["content"]) > MAX_MESSAGE:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, {"code": "invalid"})
    # Emergencies are answered without a model, in the app's own words
    emergency = emergency_in(messages[-1]["content"])
    if emergency:
        return {"reply": None, "safety": emergency}
    if providers.configured_provider() is None:
        raise HTTPException(ERROR_STATUS["notConfigured"], {"code": "notConfigured"})
    if not _allow(uid):
        raise HTTPException(ERROR_STATUS["rateLimited"], {"code": "rateLimited"})
    try:
        provider, text = providers.reply(system_prompt([s.model_dump() for s in body.scores]), messages)
    except ExtractionError as error:
        raise HTTPException(ERROR_STATUS.get(error.code, status.HTTP_502_BAD_GATEWAY), {"code": error.code})
    return {"reply": text, "safety": None, "providerName": providers.NAMES[provider]}
