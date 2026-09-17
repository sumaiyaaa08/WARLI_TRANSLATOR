"""Accounts service — demo-grade username/password auth + progress store.

Storage: a single JSON file (settings.users_path, gitignored). Shape:
    {"users": {name: {display_name, salt, pw_hash, created_at}},
     "tokens": {token: {username, expires}},
     "progress": {name: {xp, streak, hearts, completed_lessons, uiLang,
                         lastPlayedDate, updated_at}}}

- Passwords: pbkdf2_hmac/sha256, 210k iterations, per-user 16-byte salt.
- Tokens: opaque 32-byte urlsafe strings, 30-day expiry, checked on each call.
- File writes are atomic-ish (write temp + replace) and guarded by a lock.

Ephemeral-disk warning: on free-tier hosts without a persistent disk this file
vanishes on redeploy/restart. Mount a disk at the data dir for real classes.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import secrets
import tempfile
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from ..config import settings

logger = logging.getLogger("warli.auth")

_HASH_ITERATIONS = 210_000
_TOKEN_DAYS = 30

_lock = threading.Lock()


# ── Errors ────────────────────────────────────────────────────────────────────

class AuthError(Exception):
    """Carries an HTTP status code for the route layer."""

    def __init__(self, status: int, detail: str):
        super().__init__(detail)
        self.status = status
        self.detail = detail


# ── File I/O ──────────────────────────────────────────────────────────────────

def _blank_store() -> dict:
    return {"users": {}, "tokens": {}, "progress": {}}


def _load() -> dict:
    path: Path = settings.users_path
    if not path.exists():
        return _blank_store()
    try:
        with path.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
        if not isinstance(data, dict):
            return _blank_store()
        data.setdefault("users", {})
        data.setdefault("tokens", {})
        data.setdefault("progress", {})
        return data
    except (json.JSONDecodeError, OSError) as exc:
        logger.error("Failed to load users file %s: %s", path, exc)
        return _blank_store()


def _save(data: dict) -> None:
    path: Path = settings.users_path
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=".users-", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
        os.replace(tmp, path)
    except OSError as exc:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise AuthError(500, f"Could not save accounts data: {exc}")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Passwords / tokens ────────────────────────────────────────────────────────

def _hash(password: str, salt_hex: str) -> str:
    dk = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"),
        bytes.fromhex(salt_hex), _HASH_ITERATIONS,
    )
    return dk.hex()


def _new_token() -> tuple[str, str]:
    token = secrets.token_urlsafe(32)
    expires = (datetime.now(timezone.utc) + timedelta(days=_TOKEN_DAYS)).isoformat()
    return token, expires


def _prune_tokens(data: dict) -> None:
    now = datetime.now(timezone.utc)
    dead = []
    for tok, rec in data.get("tokens", {}).items():
        try:
            if datetime.fromisoformat(rec.get("expires", "")) < now:
                dead.append(tok)
        except (ValueError, TypeError):
            dead.append(tok)
    for tok in dead:
        del data["tokens"][tok]


# ── Public API ────────────────────────────────────────────────────────────────

def signup(username: str, password: str, display_name: Optional[str] = None) -> tuple[str, dict]:
    """Create an account. Returns (token, public_user). Raises AuthError."""
    username = (username or "").strip()
    with _lock:
        data = _load()
        _prune_tokens(data)
        if username in data["users"]:
            raise AuthError(400, "That username is taken — try another.")
        salt = secrets.token_hex(16)
        data["users"][username] = {
            "display_name": (display_name or "").strip() or username,
            "salt": salt,
            "pw_hash": _hash(password, salt),
            "created_at": _now_iso(),
        }
        data["progress"].setdefault(username, {
            "xp": 0, "streak": 0, "hearts": 5, "completed_lessons": [],
            "uiLang": "hi", "lastPlayedDate": None, "updated_at": _now_iso(),
        })
        token, expires = _new_token()
        data["tokens"][token] = {"username": username, "expires": expires}
        _save(data)
        return token, {"username": username,
                       "display_name": data["users"][username]["display_name"]}


def login(username: str, password: str) -> tuple[str, dict]:
    """Check credentials. Returns (token, public_user). Raises AuthError."""
    username = (username or "").strip()
    with _lock:
        data = _load()
        _prune_tokens(data)
        rec = data["users"].get(username)
        if rec is None or _hash(password, rec["salt"]) != rec.get("pw_hash"):
            raise AuthError(401, "Wrong username or password.")
        token, expires = _new_token()
        data["tokens"][token] = {"username": username, "expires": expires}
        _save(data)
        return token, {"username": username, "display_name": rec["display_name"]}


def authenticate(token: str) -> str:
    """Validate a bearer token. Returns the username. Raises AuthError(401)."""
    if not token:
        raise AuthError(401, "Login required.")
    with _lock:
        data = _load()
        rec = data["tokens"].get(token)
        if rec is None:
            raise AuthError(401, "Session expired — please log in again.")
        try:
            valid = datetime.fromisoformat(rec["expires"]) > datetime.now(timezone.utc)
        except (ValueError, TypeError):
            valid = False
        if not valid:
            del data["tokens"][token]
            _save(data)
            raise AuthError(401, "Session expired — please log in again.")
        return rec["username"]


def logout(token: str) -> None:
    with _lock:
        data = _load()
        if token in data.get("tokens", {}):
            del data["tokens"][token]
            _save(data)


def get_progress(username: str) -> dict:
    with _lock:
        data = _load()
        return dict(data["progress"].get(username, {
            "xp": 0, "streak": 0, "hearts": 5, "completed_lessons": [],
            "uiLang": "hi", "lastPlayedDate": None, "updated_at": None,
        }))


def save_progress(username: str, payload: dict) -> dict:
    """Upsert progress. Returns the stored record."""
    allowed_langs = {"en", "hi", "mr"}
    with _lock:
        data = _load()
        if username not in data["users"]:
            raise AuthError(404, "Account not found.")
        completed = payload.get("completed_lessons") or []
        record = {
            "xp": max(0, int(payload.get("xp", 0))),
            "streak": max(0, int(payload.get("streak", 0))),
            "hearts": min(5, max(0, int(payload.get("hearts", 5)))),
            "completed_lessons": [str(x) for x in completed if str(x).strip()],
            "uiLang": payload.get("uiLang") if payload.get("uiLang") in allowed_langs else "hi",
            "lastPlayedDate": payload.get("lastPlayedDate"),
            "updated_at": payload.get("updated_at") or _now_iso(),
        }
        data["progress"][username] = record
        _save(data)
        return dict(record)


def list_students() -> list[dict]:
    """Public roster for the teacher dashboard (no hashes/tokens, ever)."""
    with _lock:
        data = _load()
        out = []
        for username, rec in data["users"].items():
            prog = data["progress"].get(username, {})
            out.append({
                "username": username,
                "display_name": rec.get("display_name", username),
                "xp": int(prog.get("xp", 0)),
                "lessons_done": len(prog.get("completed_lessons", [])),
                "streak": int(prog.get("streak", 0)),
                "last_seen": prog.get("updated_at"),
            })
        out.sort(key=lambda s: s["xp"], reverse=True)
        return out
