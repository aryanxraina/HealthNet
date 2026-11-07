import sys
import types

import pytest
from fastapi.testclient import TestClient

import assistant_api
from assistant.prompt import score_summary, system_prompt
from assistant.safety import emergency_in
from auth import current_user
from main import app

SCORES = [
    {"id": "whoCvd", "title": "Heart attack & stroke risk (WHO)", "status": "ok", "value": 7.5, "unit": "%", "category": "5–10%"},
    {"id": "findrisc", "title": "Type 2 diabetes risk (FINDRISC)", "status": "ok", "value": 11, "unit": "points", "category": "Slightly raised"},
    {"id": "prevent", "title": "Heart disease risk (AHA PREVENT)", "status": "needs_input", "missing": ["total cholesterol", "HDL cholesterol"]},
]


class FakeAnthropic(types.ModuleType):
    class _Error(Exception):
        def __init__(self, message="error"):
            super().__init__(message)
            self.message = message

    AuthenticationError = type("AuthenticationError", (_Error,), {})
    PermissionDeniedError = type("PermissionDeniedError", (_Error,), {})
    RateLimitError = type("RateLimitError", (_Error,), {})
    BadRequestError = type("BadRequestError", (_Error,), {})
    APIStatusError = type("APIStatusError", (_Error,), {})
    APIConnectionError = type("APIConnectionError", (_Error,), {})

    def __init__(self, text="Your heart risk is in the 5–10% band.", stop_reason="end_turn", raises=None):
        super().__init__("anthropic")
        self.requests = []
        module = self

        class Messages:
            def create(self, **kwargs):
                module.requests.append(kwargs)
                if raises:
                    raise getattr(module, raises)()
                content = [types.SimpleNamespace(type="thinking", thinking="..."), types.SimpleNamespace(type="text", text=text)]
                return types.SimpleNamespace(stop_reason=stop_reason, content=content)

        class Client:
            beta = types.SimpleNamespace(messages=Messages())

        self.Anthropic = Client


@pytest.fixture
def client():
    assistant_api._recent.clear()
    app.dependency_overrides[current_user] = lambda: "test-uid"
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def claude(monkeypatch):
    monkeypatch.setenv("ASSISTANT_PROVIDER", "claude")
    monkeypatch.delenv("ASSISTANT_MODEL", raising=False)

    def install(**kwargs):
        fake = FakeAnthropic(**kwargs)
        monkeypatch.setitem(sys.modules, "anthropic", fake)
        return fake

    return install


def ask(client, text, scores=SCORES, history=()):
    return client.post("/assistant/chat", json={"messages": [*history, {"role": "user", "content": text}], "scores": scores})


def test_status_follows_the_enhanced_reading_provider(client, monkeypatch):
    monkeypatch.delenv("ASSISTANT_PROVIDER", raising=False)
    monkeypatch.delenv("EXTRACTION_PROVIDER", raising=False)
    assert client.get("/assistant/status").json()["available"] is False
    monkeypatch.setenv("EXTRACTION_PROVIDER", "gemini")
    status = client.get("/assistant/status").json()
    assert status == {"available": True, "provider": "gemini", "providerName": "Gemini (Google)", "model": "gemini-flash-latest"}


def test_not_set_up(client, monkeypatch):
    monkeypatch.setenv("ASSISTANT_PROVIDER", "none")
    response = ask(client, "What does my score mean?")
    assert response.status_code == 503 and response.json()["detail"]["code"] == "notConfigured"


def test_chat_sends_the_conversation_with_a_score_summary(client, claude):
    fake = claude()
    history = [{"role": "user", "content": "Hi"}, {"role": "assistant", "content": "Hello! Ask me about your results."}]
    response = ask(client, "What does my heart score mean?", history=history)

    assert response.status_code == 200
    assert response.json() == {"reply": "Your heart risk is in the 5–10% band.", "safety": None, "providerName": "Claude (Anthropic)"}
    request = fake.requests[0]
    assert request["model"] == "claude-opus-5-5"
    assert request["thinking"] == {"type": "adaptive"}
    assert [m["role"] for m in request["messages"]] == ["user", "assistant", "user"]
    assert "Heart attack & stroke risk (WHO): 7.5%" in request["system"]
    assert "needs total cholesterol, HDL cholesterol" in request["system"]
    assert "never tell the person to start, stop or change a medicine" in request["system"]


def test_emergencies_are_answered_without_a_model(client, claude):
    fake = claude()
    for text, code in [
        ("I have crushing chest pain right now", "heart"),
        ("I want to kill myself", "selfHarm"),
        ("my face is drooping and I have slurred speech", "stroke"),
        ("I can't breathe", "breathing"),
    ]:
        assert ask(client, text).json() == {"reply": None, "safety": code}
    assert fake.requests == []


def test_safety_patterns_leave_ordinary_questions_alone():
    for text in ["How can I lower my stroke risk?", "What is a heart attack risk score?", "Does breathing exercise help?", "Is my cholesterol high?"]:
        assert emergency_in(text) is None, text


@pytest.mark.parametrize("raises, status, code", [
    ("AuthenticationError", 503, "notConfigured"),
    ("RateLimitError", 429, "rateLimited"),
    ("APIConnectionError", 502, "unavailable"),
])
def test_provider_errors_are_mapped(client, claude, raises, status, code):
    claude(raises=raises)
    response = ask(client, "Explain my FINDRISC score")
    assert response.status_code == status and response.json()["detail"]["code"] == code


def test_refusals_are_reported(client, claude):
    claude(stop_reason="refusal")
    response = ask(client, "Explain my FINDRISC score")
    assert response.status_code == 422 and response.json()["detail"]["code"] == "refused"


def test_messages_are_limited(client, claude):
    claude()
    assert ask(client, "x" * 1001).status_code == 422
    last_from_assistant = client.post("/assistant/chat", json={"messages": [{"role": "assistant", "content": "hi"}], "scores": []})
    assert last_from_assistant.status_code == 422
    assert client.post("/assistant/chat", json={"messages": [], "scores": []}).status_code == 422


def test_hourly_limit_per_person(client, claude, monkeypatch):
    claude()
    monkeypatch.setattr(assistant_api, "HOURLY_LIMIT", 2)
    assert ask(client, "one").status_code == 200
    assert ask(client, "two").status_code == 200
    response = ask(client, "three")
    assert response.status_code == 429 and response.json()["detail"]["code"] == "rateLimited"


def test_summary_never_includes_more_than_the_score_fields():
    text = score_summary([{**SCORES[0], "title": "Heart\nrisk   (WHO)"}])
    assert text == "- Heart risk (WHO): 7.5% (5–10%)"
    assert "No scores yet" in system_prompt([])


def test_sign_in_is_required(monkeypatch):
    monkeypatch.setenv("FIREBASE_PROJECT_ID", "demo-project")
    plain = TestClient(app)
    assert plain.get("/assistant/status").status_code == 401
    assert plain.post("/assistant/chat", json={"messages": [{"role": "user", "content": "hi"}]}).status_code == 401
