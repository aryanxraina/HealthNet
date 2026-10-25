"""Wearable sync: connect a Google Health account, then fetch daily steps, resting heart rate and sleep.

Setup (all free): create an OAuth client of type "Web application" in Google Cloud, enable the Google
Health API, add the redirect URI below, then set
  GOOGLE_HEALTH_CLIENT_ID, GOOGLE_HEALTH_CLIENT_SECRET
  GOOGLE_HEALTH_REDIRECT_URI   default http://localhost:8000/wearables/google/callback
  TOKEN_ENCRYPTION_KEY         a Fernet key: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
  FRONTEND_URL                 where to send people back to, default the first ALLOWED_ORIGINS entry

Flow: the app asks /connect for Google's sign-in address and sends the user there. Google returns to
/callback, which saves the encrypted refresh token and redirects back to the app's Settings page. /sync
returns daily summaries, which the app stores in the user's own Firestore documents. Health readings
are never stored here, only the tokens.
"""
import base64
import hashlib
import os
import secrets
import time
from datetime import date, datetime, timedelta, timezone
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse

from auth import current_user
from wearables import google_health
from wearables.google_health import WearableError
from wearables.store import get_store

router = APIRouter(prefix="/wearables", tags=["wearables"])

GOOGLE = "google"
DEFAULT_REDIRECT = "http://localhost:8000/wearables/google/callback"
MAX_DAYS = 90  # Google's roll-up limit for steps

ERROR_STATUS = {
    "notConfigured": status.HTTP_503_SERVICE_UNAVAILABLE,
    "notConnected": status.HTTP_409_CONFLICT,
    "reconnect": status.HTTP_409_CONFLICT,
    "forbidden": status.HTTP_403_FORBIDDEN,
    "rateLimited": status.HTTP_429_TOO_MANY_REQUESTS,
    "unavailable": status.HTTP_502_BAD_GATEWAY,
}

# Access tokens last an hour; they're kept in memory only
_access_tokens = {}


def _error(code):
    return HTTPException(ERROR_STATUS[code], {"code": code})


def _google_config():
    client_id = os.getenv("GOOGLE_HEALTH_CLIENT_ID", "").strip()
    client_secret = os.getenv("GOOGLE_HEALTH_CLIENT_SECRET", "").strip()
    store = get_store()
    if not (client_id and client_secret and store):
        return None
    redirect_uri = os.getenv("GOOGLE_HEALTH_REDIRECT_URI", "").strip() or DEFAULT_REDIRECT
    return {"client_id": client_id, "client_secret": client_secret, "redirect_uri": redirect_uri, "store": store}


def _require_config():
    config = _google_config()
    if not config:
        raise _error("notConfigured")
    return config


def _frontend_url():
    configured = os.getenv("FRONTEND_URL", "").strip()
    if configured:
        return configured.rstrip("/")
    origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
    return (origins[0] if origins else "http://localhost:3000").rstrip("/")


def _back_to_app(result):
    return RedirectResponse(f"{_frontend_url()}/settings?{urlencode({'device': GOOGLE, 'result': result})}#devices", status_code=303)


def _iso(timestamp):
    return datetime.fromtimestamp(timestamp, timezone.utc).isoformat() if timestamp else None


@router.get("/status")
def wearables_status(uid: str = Depends(current_user)):
    config = _google_config()
    connection = config["store"].get(uid, GOOGLE) if config else None
    return {
        "providers": [{
            "id": GOOGLE,
            "available": config is not None,
            "connected": connection is not None,
            "connectedAt": _iso(connection["connected_at"]) if connection else None,
            "lastSyncAt": _iso(connection["last_sync_at"]) if connection else None,
        }]
    }


@router.post("/google/connect")
def connect_google(uid: str = Depends(current_user)):
    config = _require_config()
    state = secrets.token_urlsafe(32)
    # PKCE: the code Google returns is useless without this verifier, which never leaves the server
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    config["store"].add_state(state, uid, GOOGLE, verifier)
    return {"url": google_health.authorization_url(config["client_id"], config["redirect_uri"], state, challenge)}


@router.get("/google/callback", include_in_schema=False)
def google_callback(state: str = "", code: str = "", error: str = ""):
    # Google sends the browser here, so there is no sign-in token: the single-use state links it to the user
    config = _google_config()
    if not config:
        return _back_to_app("failed")
    taken = config["store"].take_state(state, GOOGLE) if state else None
    if not taken:
        return _back_to_app("expired")
    uid, verifier = taken
    if error or not code:
        return _back_to_app("denied")
    try:
        tokens = google_health.exchange_code(config["client_id"], config["client_secret"], config["redirect_uri"], code, verifier)
    except WearableError:
        return _back_to_app("failed")
    if not tokens["scopes"] & set(google_health.SCOPES):
        google_health.revoke(tokens["refresh_token"])
        return _back_to_app("denied")
    config["store"].save(uid, GOOGLE, tokens["refresh_token"], tokens["scopes"])
    _access_tokens[uid] = (tokens["access_token"], time.monotonic() + tokens["expires_in"] - 60)
    return _back_to_app("connected")


def _access_token(config, uid, refresh_token):
    cached = _access_tokens.get(uid)
    if cached and time.monotonic() < cached[1]:
        return cached[0]
    token, expires_in = google_health.refresh_access(config["client_id"], config["client_secret"], refresh_token)
    _access_tokens[uid] = (token, time.monotonic() + expires_in - 60)
    return token


@router.post("/google/sync")
def sync_google(
    end: date = Query(..., description="The last day to fetch, in the user's own time zone"),
    days: int = Query(30, ge=1, le=MAX_DAYS),
    uid: str = Depends(current_user),
):
    config = _require_config()
    today = datetime.now(timezone.utc).date()
    # Time zones put the user's "today" at most a day either side of UTC
    if not today - timedelta(days=2) <= end <= today + timedelta(days=1):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, {"code": "invalid"})
    connection = config["store"].get(uid, GOOGLE)
    if not connection:
        raise _error("notConnected")
    start = end - timedelta(days=days - 1)
    try:
        token = _access_token(config, uid, connection["refresh_token"])
        summaries = google_health.daily_summaries(token, connection["scopes"], start, end)
    except WearableError as failure:
        if failure.code == "reconnect":
            # The grant was revoked from the Google account: forget it so the app offers to reconnect
            _access_tokens.pop(uid, None)
            config["store"].delete(uid, GOOGLE)
        raise _error(failure.code)
    config["store"].mark_synced(uid, GOOGLE)
    return {"provider": GOOGLE, "from": start.isoformat(), "to": end.isoformat(), "days": summaries}


@router.post("/google/disconnect")
def disconnect_google(uid: str = Depends(current_user)):
    config = _require_config()
    connection = config["store"].get(uid, GOOGLE)
    if connection:
        google_health.revoke(connection["refresh_token"])
        config["store"].delete(uid, GOOGLE)
    _access_tokens.pop(uid, None)
    return {"connected": False}
