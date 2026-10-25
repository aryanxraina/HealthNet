"""Google Health API (the replacement for the Fitbit Web API): OAuth and daily summaries.

Docs: https://developers.google.com/health - data comes from Fitbit trackers, Pixel Watch and other
sources the user has linked to their Google account. Only read-only scopes are requested.

Daily summaries come back as { date: 'YYYY-MM-DD', steps, restingHeartRate, sleepMinutes }, with None
for anything not recorded that day. Sleep counts towards the day the user woke up.
"""
from datetime import date, timedelta
from urllib.parse import urlencode

import requests

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
REVOKE_URL = "https://oauth2.googleapis.com/revoke"
DATA_URL = "https://health.googleapis.com/v4/users/me/dataTypes/{type}/dataPoints"
TIMEOUT_SECONDS = 15
MAX_PAGES = 20

SCOPE_PREFIX = "https://www.googleapis.com/auth/googlehealth."
STEPS_SCOPE = SCOPE_PREFIX + "activity_and_fitness.readonly"
HEART_SCOPE = SCOPE_PREFIX + "health_metrics_and_measurements.readonly"
SLEEP_SCOPE = SCOPE_PREFIX + "sleep.readonly"
SCOPES = (STEPS_SCOPE, HEART_SCOPE, SLEEP_SCOPE)


class WearableError(Exception):
    """code: reconnect | forbidden | rateLimited | unavailable"""

    def __init__(self, code):
        super().__init__(code)
        self.code = code


def authorization_url(client_id, redirect_uri, state, code_challenge):
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
        # Offline access returns a refresh token, so syncing works after the hour-long access token expires.
        # Asking for consent again makes Google send a fresh refresh token on every reconnect.
        "access_type": "offline",
        "prompt": "consent",
    }
    return f"{AUTH_URL}?{urlencode(params)}"


def _token_request(data):
    try:
        response = requests.post(TOKEN_URL, data=data, timeout=TIMEOUT_SECONDS)
    except requests.RequestException:
        raise WearableError("unavailable")
    body = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
    if response.status_code == 400 and body.get("error") == "invalid_grant":
        # Revoked by the user, expired, or the code was already used
        raise WearableError("reconnect")
    if response.status_code >= 400:
        raise WearableError("unavailable")
    return body


def exchange_code(client_id, client_secret, redirect_uri, code, code_verifier):
    """{access_token, expires_in, refresh_token, scopes} for the code Google returned."""
    body = _token_request({
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
        "code_verifier": code_verifier,
    })
    if not body.get("refresh_token"):
        raise WearableError("unavailable")
    return {
        "access_token": body["access_token"],
        "expires_in": int(body.get("expires_in", 3600)),
        "refresh_token": body["refresh_token"],
        "scopes": set(body.get("scope", "").split()),
    }


def refresh_access(client_id, client_secret, refresh_token):
    """(access_token, expires_in) from a stored refresh token."""
    body = _token_request({
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    })
    return body["access_token"], int(body.get("expires_in", 3600))


def revoke(token):
    """Best effort: ends Google's grant so the app no longer appears in the user's Google account."""
    try:
        requests.post(REVOKE_URL, data={"token": token}, timeout=TIMEOUT_SECONDS)
    except requests.RequestException:
        pass


def _call(method, url, access_token, **kwargs):
    try:
        response = requests.request(
            method, url, headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
            timeout=TIMEOUT_SECONDS, **kwargs,
        )
    except requests.RequestException:
        raise WearableError("unavailable")
    if response.status_code == 401:
        raise WearableError("reconnect")
    if response.status_code == 403:
        # A scope wasn't granted, or the app isn't approved for this account yet
        raise WearableError("forbidden")
    if response.status_code == 429:
        raise WearableError("rateLimited")
    if response.status_code >= 400:
        raise WearableError("unavailable")
    return response.json()


def _pages(method, url, access_token, key, **kwargs):
    """Every item under `key`, following nextPageToken."""
    items, token = [], None
    for _ in range(MAX_PAGES):
        if token:
            if method == "GET":
                kwargs["params"] = {**kwargs.get("params", {}), "pageToken": token}
            else:
                kwargs["json"] = {**kwargs.get("json", {}), "pageToken": token}
        body = _call(method, url, access_token, **kwargs)
        items.extend(body.get(key, []))
        token = body.get("nextPageToken")
        if not token:
            break
    return items


def _civil(day, days_after=0):
    day = day + timedelta(days=days_after)
    return {"date": {"year": day.year, "month": day.month, "day": day.day}, "time": {"hours": 0, "minutes": 0, "seconds": 0, "nanos": 0}}


def _date_key(value):
    """'YYYY-MM-DD' from a Google Date object, or None."""
    try:
        return date(int(value["year"]), int(value["month"]), int(value["day"])).isoformat()
    except (KeyError, TypeError, ValueError):
        return None


def daily_steps(access_token, start, end):
    """{date: steps} for start..end inclusive. Daily roll-ups follow the user's own time zone."""
    points = _pages(
        "POST", DATA_URL.format(type="steps") + ":dailyRollUp", access_token, "rollupDataPoints",
        json={"range": {"start": _civil(start), "end": _civil(end, 1)}, "windowSizeDays": 1},
    )
    totals = {}
    for point in points:
        day = _date_key(point.get("civilStartTime", {}).get("date"))
        count = point.get("steps", {}).get("countSum")
        if day and count is not None:
            totals[day] = int(count)
    return totals


def resting_heart_rate(access_token, start, end):
    """{date: beats per minute}."""
    points = _pages(
        "GET", DATA_URL.format(type="daily-resting-heart-rate"), access_token, "dataPoints",
        params={
            "filter": f'daily_resting_heart_rate.date >= "{start.isoformat()}" AND daily_resting_heart_rate.date <= "{end.isoformat()}"',
            "pageSize": 1000,
        },
    )
    rates = {}
    for point in points:
        value = point.get("dailyRestingHeartRate", {})
        day = _date_key(value.get("date"))
        if day and value.get("beatsPerMinute") is not None:
            rates[day] = int(value["beatsPerMinute"])
    return rates


def sleep_minutes(access_token, start, end):
    """{date woken up: minutes asleep}, adding naps and split nights together."""
    points = _pages(
        "GET", DATA_URL.format(type="sleep"), access_token, "dataPoints",
        params={
            "filter": (
                f'sleep.interval.civil_end_time >= "{start.isoformat()}T00:00:00" AND '
                f'sleep.interval.civil_end_time < "{(end + timedelta(days=1)).isoformat()}T00:00:00"'
            ),
            "pageSize": 25,
        },
    )
    totals = {}
    for point in points:
        session = point.get("sleep", {})
        day = _date_key(session.get("interval", {}).get("civilEndTime", {}).get("date"))
        minutes = session.get("summary", {}).get("minutesAsleep")
        if day and minutes is not None:
            totals[day] = totals.get(day, 0) + int(minutes)
    return totals


def daily_summaries(access_token, scopes, start, end):
    """Summaries for each day with at least one reading. Metrics whose scope wasn't granted are skipped."""
    steps = daily_steps(access_token, start, end) if STEPS_SCOPE in scopes else {}
    hearts = resting_heart_rate(access_token, start, end) if HEART_SCOPE in scopes else {}
    sleeps = sleep_minutes(access_token, start, end) if SLEEP_SCOPE in scopes else {}
    days = sorted(set(steps) | set(hearts) | set(sleeps))
    return [
        {"date": day, "steps": steps.get(day), "restingHeartRate": hearts.get(day), "sleepMinutes": sleeps.get(day)}
        for day in days
        if start.isoformat() <= day <= end.isoformat()
    ]
