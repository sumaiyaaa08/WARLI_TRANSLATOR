"""Pydantic v2 schemas for the accounts API (signup/login/progress).

Demo-grade auth for classroom use: salted pbkdf2 password hashes + opaque
bearer tokens stored server-side in data/users.json (gitignored). NOT
production auth — no email verification, no rate limiting, no JWT rotation.
Good enough for SIH classroom tracking; swap in a real user DB later.
"""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


# ── Signup / login ────────────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=20, pattern=r"^[A-Za-z0-9_.\-]+$")
    password: str = Field(..., min_length=4, max_length=128)
    display_name: Optional[str] = Field(None, max_length=40)


class LoginRequest(BaseModel):
    username: str
    password: str = Field(..., min_length=1, max_length=128)


class UserPublic(BaseModel):
    username: str
    display_name: str


class AuthResponse(BaseModel):
    token: str
    user: UserPublic


# ── Progress sync ─────────────────────────────────────────────────────────────

class ProgressPayload(BaseModel):
    xp: int = 0
    streak: int = 0
    hearts: int = 5
    completed_lessons: List[str] = Field(default_factory=list)
    uiLang: str = "hi"
    lastPlayedDate: Optional[str] = None
    updated_at: Optional[str] = None  # ISO timestamp; server stamps if absent


class MeResponse(BaseModel):
    user: UserPublic
    progress: ProgressPayload


# ── Teacher view ──────────────────────────────────────────────────────────────

class StudentProgress(BaseModel):
    username: str
    display_name: str
    xp: int = 0
    lessons_done: int = 0
    streak: int = 0
    last_seen: Optional[str] = None


class StudentsResponse(BaseModel):
    count: int
    students: List[StudentProgress] = Field(default_factory=list)
