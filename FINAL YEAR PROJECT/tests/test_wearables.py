import base64
import hashlib
import sqlite3
from datetime import date, datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

import pytest
import requests
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient

import wearables_api
from auth import current_user
from main import app
from wearables import google_health, store

TODAY = datetime.now(timezone.utc).date()


class FakeResponse:
    def __init__(self, status_code=200, body=None):
        self.status_code = status_code
        self._body = body if body is not None else {}
        self.headers = {"content-type": "application/json; charset=utf-8"}

    def json(self):
        return self._body


def civil(day):
    return {"date": {"year": day.year, "month": day.month, "day": day.day}, "time": {}}


@pytest.fixture
def configured(monkeypatch, tmp_path):
    monkeypatch.setenv("GOOGLE_HEALTH_CLIENT_ID", "client-123")
    monkeypatch.setenv("GOOGLE_HEALTH_CLIENT_SECRET", "secret-456")
    monkeypatch.setenv("TOKEN_ENCRYPTION_KEY", Fernet.generate_key().decode())
    monkeypatch.setenv("WEARABLES_DB", str(tmp_path / "wearables.sqlite3"))
    monkeypatch.setenv("FRONTEND_URL", "http://localhost:3000/")
    store._stores.clear()
    wearables_api._access_tokens.clear()
    yield tmp_path / "wearables.sqlite3"
    store._stores.clear()
    wearables_api._access_tokens.clear()


@pytest.fixture
def google(monkeypatch):
    """Fake Google token, revoke and data endpoints. Tests fill `replies` keyed by URL fragment."""
    calls, replies = [], {}

    def respond(method, url, **kwargs):
        calls.append((method, url, kwargs))
        for key, reply in replies.items():
            if key in url:
                reply = reply(kwargs) if callable(reply) else reply
                if isinstance(reply, Exception):
                    raise reply
                return reply
        raise AssertionError(f"unexpected {method} {url}")

    monkeypatch.setattr(google_health.requests, "post", lambda url, **kw: respond("POST", url, **kw))
    monkeypatch.setattr(google_health.requests, "request", lambda method, url, **kw: respond(method, url, **kw))
    return calls, replies


@pytest.fixture
def client():
    app.dependency_overrides[current_user] = lambda: "test-uid"
    yield TestClient(app, follow_redirects=False)
    app.dependency_overrides.clear()


TOKENS = {
    "access_token": "access-1", "expires_in": 3599, "refresh_token": "refresh-secret-1",
    "scope": " ".join(google_health.SCOPES), "token_type": "Bearer",
}


def connect(client, google, tokens=TOKENS):
    """Run the whole sign-in: /connect, then Google's redirect back to /callback."""
    _, replies = google
    replies["oauth2.googleapis.com/token"] = FakeResponse(body=tokens)
    url = client.post("/wearables/google/connect").json()["url"]
    state = parse_qs(urlparse(url).query)["state"][0]
    return url, client.get("/wearables/google/callback", params={"state": state, "code": "auth-code"})


def test_status_when_not_set_up(client, monkeypatch):
    monkeypatch.delenv("GOOGLE_HEALTH_CLIENT_ID", raising=False)
    monkeypatch.delenv("TOKEN_ENCRYPTION_KEY", raising=False)
    store._stores.clear()
    assert client.get("/wearables/status").json() == {
        "providers": [{"id": "google", "available": False, "connected": False, "connectedAt": None, "lastSyncAt": None}]
    }
    response = client.post("/wearables/google/connect")
    assert response.status_code == 503 and response.json()["detail"]["code"] == "notConfigured"


def test_invalid_encryption_key_counts_as_not_set_up(client, configured, monkeypatch):
    monkeypatch.setenv("TOKEN_ENCRYPTION_KEY", "not-a-fernet-key")
    store._stores.clear()
    assert client.get("/wearables/status").json()["providers"][0]["available"] is False


def test_connect_builds_google_sign_in_with_pkce(client, configured):
    url = client.post("/wearables/google/connect").json()["url"]
    query = parse_qs(urlparse(url).query)
    assert url.startswith("https://accounts.google.com/o/oauth2/v2/auth?")
    assert query["client_id"] == ["client-123"]
    assert query["redirect_uri"] == ["http://localhost:8000/wearables/google/callback"]
    assert set(query["scope"][0].split()) == set(google_health.SCOPES)
    assert all(scope.endswith(".readonly") for scope in google_health.SCOPES)
    assert query["access_type"] == ["offline"] and query["code_challenge_method"] == ["S256"]
    assert len(query["state"][0]) >= 32


def test_callback_saves_an_encrypted_token_and_returns_to_settings(client, configured, google):
    calls, _ = google
    url, response = connect(client, google)

    assert response.status_code == 303
    assert response.headers["location"] == "http://localhost:3000/settings?device=google&result=connected#devices"
    # The verifier sent with the code matches the challenge in the sign-in address
    sent = calls[-1][2]["data"]
    challenge = base64.urlsafe_b64encode(hashlib.sha256(sent["code_verifier"].encode()).digest()).rstrip(b"=").decode()
    assert parse_qs(urlparse(url).query)["code_challenge"] == [challenge]
    assert sent["code"] == "auth-code" and sent["client_secret"] == "secret-456"
    # The refresh token never reaches disk in readable form
    raw = sqlite3.connect(configured).execute("SELECT refresh_token FROM connections").fetchone()[0]
    assert b"refresh-secret-1" not in raw
    provider = client.get("/wearables/status").json()["providers"][0]
    assert provider["available"] and provider["connected"] and provider["connectedAt"] and provider["lastSyncAt"] is None


def test_callback_rejects_unknown_reused_and_denied_attempts(client, configured, google):
    _, replies = google
    replies["oauth2.googleapis.com/token"] = FakeResponse(body=TOKENS)
    assert "result=expired" in client.get("/wearables/google/callback", params={"state": "made-up", "code": "x"}).headers["location"]

    state = parse_qs(urlparse(client.post("/wearables/google/connect").json()["url"]).query)["state"][0]
    assert "result=denied" in client.get("/wearables/google/callback", params={"state": state, "error": "access_denied"}).headers["location"]
    # Each sign-in attempt works once
    assert "result=expired" in client.get("/wearables/google/callback", params={"state": state, "code": "x"}).headers["location"]
    assert client.get("/wearables/status").json()["providers"][0]["connected"] is False


def test_callback_when_no_health_scope_was_granted(client, configured, google):
    calls, replies = google
    replies["oauth2.googleapis.com/revoke"] = FakeResponse()
    _, response = connect(client, google, {**TOKENS, "scope": "openid"})
    assert "result=denied" in response.headers["location"]
    assert calls[-1][1] == google_health.REVOKE_URL
    assert client.get("/wearables/status").json()["providers"][0]["connected"] is False


def health_replies(replies, end):
    yesterday, two_days_ago = end - timedelta(days=1), end - timedelta(days=2)
    pages = {
        None: {"rollupDataPoints": [{"civilStartTime": civil(two_days_ago), "steps": {"countSum": "8123"}}], "nextPageToken": "p2"},
        "p2": {"rollupDataPoints": [{"civilStartTime": civil(end), "steps": {"countSum": "412"}}]},
    }
    replies["steps/dataPoints:dailyRollUp"] = lambda kwargs: FakeResponse(body=pages[kwargs["json"].get("pageToken")])
    replies["daily-resting-heart-rate/dataPoints"] = FakeResponse(body={"dataPoints": [
        {"dailyRestingHeartRate": {"date": civil(yesterday)["date"], "beatsPerMinute": "61"}},
    ]})
    replies["sleep/dataPoints"] = FakeResponse(body={"dataPoints": [
        # A night ending this morning, and an afternoon nap the same day
        {"sleep": {"interval": {"civilEndTime": civil(end)}, "summary": {"minutesAsleep": "412"}}},
        {"sleep": {"interval": {"civilEndTime": civil(end)}, "summary": {"minutesAsleep": "25"}}},
        {"sleep": {"interval": {"civilEndTime": civil(yesterday)}, "summary": {"minutesAsleep": "380"}}},
    ]})


def test_sync_merges_steps_heart_rate_and_sleep_by_day(client, configured, google):
    calls, replies = google
    connect(client, google)
    health_replies(replies, TODAY)

    body = client.post("/wearables/google/sync", params={"end": TODAY.isoformat(), "days": 7}).json()

    d = lambda n: (TODAY - timedelta(days=n)).isoformat()
    assert body["from"] == d(6) and body["to"] == d(0)
    assert body["days"] == [
        {"date": d(2), "steps": 8123, "restingHeartRate": None, "sleepMinutes": None},
        {"date": d(1), "steps": None, "restingHeartRate": 61, "sleepMinutes": 380},
        {"date": d(0), "steps": 412, "restingHeartRate": None, "sleepMinutes": 437},
    ]
    api_calls = [c for c in calls if "health.googleapis.com" in c[1]]
    # The access token from sign-in is reused; no refresh needed within the hour
    assert all(c[2]["headers"]["Authorization"] == "Bearer access-1" for c in api_calls)
    rollup = api_calls[0][2]["json"]
    start = TODAY - timedelta(days=6)
    assert rollup["windowSizeDays"] == 1
    assert rollup["range"]["start"]["date"] == {"year": start.year, "month": start.month, "day": start.day}
    assert rollup["range"]["end"]["date"] == civil(TODAY + timedelta(days=1))["date"]
    heart_filter = next(c for c in api_calls if "resting" in c[1])[2]["params"]["filter"]
    assert heart_filter == f'daily_resting_heart_rate.date >= "{d(6)}" AND daily_resting_heart_rate.date <= "{d(0)}"'
    assert client.get("/wearables/status").json()["providers"][0]["lastSyncAt"]


def test_sync_skips_metrics_the_user_did_not_allow(client, configured, google):
    calls, replies = google
    connect(client, google, {**TOKENS, "scope": google_health.STEPS_SCOPE})
    health_replies(replies, TODAY)
    days = client.post("/wearables/google/sync", params={"end": TODAY.isoformat()}).json()["days"]
    assert all(day["restingHeartRate"] is None and day["sleepMinutes"] is None for day in days)
    assert not any("sleep" in c[1] or "resting" in c[1] for c in calls)


def test_sync_refreshes_an_expired_access_token(client, configured, google):
    calls, replies = google
    connect(client, google)
    wearables_api._access_tokens.clear()  # as after an hour, or a server restart
    replies["oauth2.googleapis.com/token"] = FakeResponse(body={"access_token": "access-2", "expires_in": 3599})
    health_replies(replies, TODAY)
    assert client.post("/wearables/google/sync", params={"end": TODAY.isoformat()}).status_code == 200
    refresh = next(c for c in calls if c[1] == google_health.TOKEN_URL and c[2]["data"]["grant_type"] == "refresh_token")
    assert refresh[2]["data"]["refresh_token"] == "refresh-secret-1"
    assert calls[-1][2]["headers"]["Authorization"] == "Bearer access-2"


def test_revoked_access_asks_to_reconnect_and_forgets_the_token(client, configured, google):
    _, replies = google
    connect(client, google)
    wearables_api._access_tokens.clear()
    replies["oauth2.googleapis.com/token"] = FakeResponse(400, {"error": "invalid_grant"})
    response = client.post("/wearables/google/sync", params={"end": TODAY.isoformat()})
    assert response.status_code == 409 and response.json()["detail"]["code"] == "reconnect"
    assert client.get("/wearables/status").json()["providers"][0]["connected"] is False


@pytest.mark.parametrize("status_code, code", [(403, "forbidden"), (429, "rateLimited"), (500, "unavailable")])
def test_google_errors_are_reported(client, configured, google, status_code, code):
    _, replies = google
    connect(client, google)
    replies["health.googleapis.com"] = FakeResponse(status_code)
    response = client.post("/wearables/google/sync", params={"end": TODAY.isoformat()})
    assert response.json()["detail"]["code"] == code
    # Temporary problems keep the connection
    assert client.get("/wearables/status").json()["providers"][0]["connected"] is True


def test_network_failure_is_unavailable(client, configured, google):
    _, replies = google
    connect(client, google)
    replies["health.googleapis.com"] = requests.ConnectionError("offline")
    assert client.post("/wearables/google/sync", params={"end": TODAY.isoformat()}).status_code == 502


def test_sync_needs_a_connection_and_a_sensible_date(client, configured, google):
    response = client.post("/wearables/google/sync", params={"end": TODAY.isoformat()})
    assert response.status_code == 409 and response.json()["detail"]["code"] == "notConnected"
    assert client.post("/wearables/google/sync", params={"end": (TODAY - timedelta(days=10)).isoformat()}).status_code == 422
    assert client.post("/wearables/google/sync", params={"end": TODAY.isoformat(), "days": 91}).status_code == 422


def test_disconnect_revokes_and_deletes(client, configured, google):
    calls, replies = google
    connect(client, google)
    replies["oauth2.googleapis.com/revoke"] = FakeResponse()
    assert client.post("/wearables/google/disconnect").json() == {"connected": False}
    assert calls[-1][1] == google_health.REVOKE_URL and calls[-1][2]["data"] == {"token": "refresh-secret-1"}
    assert client.get("/wearables/status").json()["providers"][0]["connected"] is False
    assert sqlite3.connect(configured).execute("SELECT COUNT(*) FROM connections").fetchone()[0] == 0


def test_connections_belong_to_one_user(client, configured, google):
    connect(client, google)
    app.dependency_overrides[current_user] = lambda: "someone-else"
    assert client.get("/wearables/status").json()["providers"][0]["connected"] is False
    assert client.post("/wearables/google/sync", params={"end": TODAY.isoformat()}).json()["detail"]["code"] == "notConnected"


def test_routes_need_sign_in(configured, monkeypatch):
    monkeypatch.setenv("FIREBASE_PROJECT_ID", "demo-project")
    plain = TestClient(app)
    assert plain.get("/wearables/status").status_code == 401
    assert plain.post("/wearables/google/connect").status_code == 401
    assert plain.post("/wearables/google/sync", params={"end": date.today().isoformat()}).status_code == 401
    assert plain.post("/wearables/google/disconnect").status_code == 401
