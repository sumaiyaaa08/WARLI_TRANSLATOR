"""Accounts API route handlers (demo-grade auth for classroom tracking).

All endpoints live under the /auth sub-prefix (registered in main.py as
/api/auth/*). Bearer tokens come from the `Authorization: Bearer <token>`
header. The /students roster is intentionally open (demo) so the teacher
dashboard works with zero setup — it exposes only public progress fields.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Header, HTTPException
from fastapi import status as http_status

from ..models.auth_schemas import (
    AuthResponse,
    LoginRequest,
    MeResponse,
    ProgressPayload,
    SignupRequest,
    StudentsResponse,
    UserPublic,
)
from ..services import auth_service
from ..services.auth_service import AuthError

logger = logging.getLogger("warli.auth.routes")

auth_router = APIRouter(prefix="/auth")


def _bearer(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(http_status.HTTP_401_UNAUTHORIZED, "Login required.")
    return authorization.split(None, 1)[1].strip()


def _err(exc: AuthError) -> HTTPException:
    return HTTPException(exc.status, exc.detail)


# POST /api/auth/signup ───────────────────────────────────────────────────────

@auth_router.post(
    "/signup",
    response_model=AuthResponse,
    status_code=http_status.HTTP_201_CREATED,
    summary="Create a learner account and get a session token.",
)
def signup(req: SignupRequest) -> AuthResponse:
    try:
        token, user = auth_service.signup(req.username, req.password, req.display_name)
    except AuthError as exc:
        raise _err(exc)
    return AuthResponse(token=token, user=UserPublic(**user))


# POST /api/auth/login ────────────────────────────────────────────────────────

@auth_router.post(
    "/login",
    response_model=AuthResponse,
    summary="Log in and get a session token.",
)
def login(req: LoginRequest) -> AuthResponse:
    try:
        token, user = auth_service.login(req.username, req.password)
    except AuthError as exc:
        raise _err(exc)
    return AuthResponse(token=token, user=UserPublic(**user))


# POST /api/auth/logout ───────────────────────────────────────────────────────

@auth_router.post(
    "/logout",
    summary="Invalidate the current session token.",
)
def logout(authorization: str | None = Header(None)) -> dict:
    auth_service.logout(_bearer(authorization))
    return {"status": "logged_out"}


# GET /api/auth/me ────────────────────────────────────────────────────────────

@auth_router.get(
    "/me",
    response_model=MeResponse,
    summary="Current account + synced progress.",
)
def me(authorization: str | None = Header(None)) -> MeResponse:
    try:
        username = auth_service.authenticate(_bearer(authorization))
        progress = auth_service.get_progress(username)
        users = auth_service.list_students()
        me_rec = next((s for s in users if s["username"] == username),
                      {"username": username, "display_name": username})
    except AuthError as exc:
        raise _err(exc)
    return MeResponse(
        user=UserPublic(username=username, display_name=me_rec["display_name"]),
        progress=ProgressPayload(**{k: progress.get(k) for k in
                                    ("xp", "streak", "hearts", "completed_lessons",
                                     "uiLang", "lastPlayedDate", "updated_at")
                                    if k in progress} or {}),
    )


# GET + POST /api/auth/progress ───────────────────────────────────────────────

@auth_router.get(
    "/progress",
    response_model=ProgressPayload,
    summary="Fetch synced progress.",
)
def get_progress(authorization: str | None = Header(None)) -> ProgressPayload:
    try:
        username = auth_service.authenticate(_bearer(authorization))
        return ProgressPayload(**auth_service.get_progress(username))
    except AuthError as exc:
        raise _err(exc)


@auth_router.post(
    "/progress",
    response_model=ProgressPayload,
    summary="Save synced progress.",
)
def save_progress(req: ProgressPayload, authorization: str | None = Header(None)) -> ProgressPayload:
    try:
        username = auth_service.authenticate(_bearer(authorization))
        return ProgressPayload(**auth_service.save_progress(username, req.model_dump()))
    except AuthError as exc:
        raise _err(exc)


# GET /api/auth/students ──────────────────────────────────────────────────────

@auth_router.get(
    "/students",
    response_model=StudentsResponse,
    summary="Public roster of learners + progress (teacher dashboard).",
)
def students() -> StudentsResponse:
    roster = auth_service.list_students()
    return StudentsResponse(count=len(roster), students=roster)
