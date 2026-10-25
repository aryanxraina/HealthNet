"""Server-side storage for wearable connections.

Refresh tokens are encrypted with Fernet (AES-128-CBC + HMAC-SHA256) using TOKEN_ENCRYPTION_KEY before
they touch disk, so a copy of the database alone can't be used to read anyone's health data. Access
tokens only live in memory. OAuth sign-in attempts ("states") are single-use and expire after 10 minutes.

The database is a local SQLite file (WEARABLES_DB, default wearables.sqlite3 next to this package),
which suits one API server. Running several servers needs a shared database instead.
"""
import os
import sqlite3
import threading
import time
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken

STATE_SECONDS = 600
DEFAULT_DB = Path(__file__).resolve().parent.parent / "wearables.sqlite3"

SCHEMA = """
CREATE TABLE IF NOT EXISTS connections (
    uid TEXT NOT NULL,
    provider TEXT NOT NULL,
    refresh_token BLOB NOT NULL,
    scopes TEXT NOT NULL,
    connected_at REAL NOT NULL,
    last_sync_at REAL,
    PRIMARY KEY (uid, provider)
);
CREATE TABLE IF NOT EXISTS oauth_states (
    state TEXT PRIMARY KEY,
    uid TEXT NOT NULL,
    provider TEXT NOT NULL,
    verifier TEXT NOT NULL,
    created_at REAL NOT NULL
);
"""


class TokenStore:
    def __init__(self, path, key):
        self.path = str(path)
        self.fernet = Fernet(key)
        self.lock = threading.Lock()
        with self._connect() as db:
            db.executescript(SCHEMA)

    def _connect(self):
        return sqlite3.connect(self.path)

    # OAuth sign-in attempts

    def add_state(self, state, uid, provider, verifier):
        with self.lock, self._connect() as db:
            db.execute("DELETE FROM oauth_states WHERE created_at < ?", (time.time() - STATE_SECONDS,))
            db.execute("INSERT INTO oauth_states VALUES (?, ?, ?, ?, ?)", (state, uid, provider, verifier, time.time()))

    def take_state(self, state, provider):
        """(uid, verifier) for a live state, which is used up; None if unknown, expired or for another provider."""
        with self.lock, self._connect() as db:
            row = db.execute("SELECT uid, provider, verifier, created_at FROM oauth_states WHERE state = ?", (state,)).fetchone()
            db.execute("DELETE FROM oauth_states WHERE state = ?", (state,))
        if not row or row[1] != provider or time.time() - row[3] > STATE_SECONDS:
            return None
        return row[0], row[2]

    # Connections

    def save(self, uid, provider, refresh_token, scopes):
        with self.lock, self._connect() as db:
            db.execute(
                "INSERT OR REPLACE INTO connections VALUES (?, ?, ?, ?, ?, NULL)",
                (uid, provider, self.fernet.encrypt(refresh_token.encode()), " ".join(sorted(scopes)), time.time()),
            )

    def get(self, uid, provider):
        """{refresh_token, scopes, connected_at, last_sync_at} or None."""
        with self._connect() as db:
            row = db.execute(
                "SELECT refresh_token, scopes, connected_at, last_sync_at FROM connections WHERE uid = ? AND provider = ?",
                (uid, provider),
            ).fetchone()
        if not row:
            return None
        try:
            token = self.fernet.decrypt(row[0]).decode()
        except InvalidToken:
            # Encrypted with a different key: the connection can't be used any more
            return None
        return {"refresh_token": token, "scopes": set(row[1].split()), "connected_at": row[2], "last_sync_at": row[3]}

    def mark_synced(self, uid, provider):
        with self.lock, self._connect() as db:
            db.execute("UPDATE connections SET last_sync_at = ? WHERE uid = ? AND provider = ?", (time.time(), uid, provider))

    def delete(self, uid, provider):
        with self.lock, self._connect() as db:
            db.execute("DELETE FROM connections WHERE uid = ? AND provider = ?", (uid, provider))


_stores = {}


def get_store():
    """The store for the current settings, or None when TOKEN_ENCRYPTION_KEY isn't set or isn't valid."""
    key = os.getenv("TOKEN_ENCRYPTION_KEY", "").strip()
    path = os.getenv("WEARABLES_DB", "").strip() or DEFAULT_DB
    if not key:
        return None
    cache_key = (key, str(path))
    if cache_key not in _stores:
        try:
            _stores[cache_key] = TokenStore(path, key)
        except ValueError:
            return None
    return _stores[cache_key]
