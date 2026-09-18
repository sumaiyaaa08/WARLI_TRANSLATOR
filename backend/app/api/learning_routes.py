"""Learning API route handlers.

All endpoints live under the /learning sub-prefix (registered in main.py as
/api/learning/*). Thin layer: validate inputs → call learning_service →
return response schemas. No business logic here.

The /hint handler catches ALL exceptions and returns a friendly fallback
rather than a 5xx, so a translation engine glitch never breaks the lesson.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query, status

from ..models.learning_schemas import (
    ClassroomResponse,
    HintRequest,
    HintResponse,
    LearningPathResponse,
    LessonDetail,
    PronounceResponse,
)
from ..services import learning_service

logger = logging.getLogger("warli.learning.routes")

learning_router = APIRouter(prefix="/learning")


# GET /api/learning/path ──────────────────────────────────────────────────────

@learning_router.get(
    "/path",
    response_model=LearningPathResponse,
    summary="Return the full curriculum with inlined lesson summaries.",
)
def get_path() -> LearningPathResponse:
    return learning_service.get_learning_path()


# GET /api/learning/lesson/{lesson_id} ────────────────────────────────────────

@learning_router.get(
    "/lesson/{lesson_id}",
    response_model=LessonDetail,
    summary="Return a single lesson with all its exercises.",
)
def get_lesson(lesson_id: str) -> LessonDetail:
    lesson = learning_service.get_lesson(lesson_id)
    if lesson is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lesson '{lesson_id}' not found.",
        )
    return lesson


# POST /api/learning/hint ─────────────────────────────────────────────────────

@learning_router.post(
    "/hint",
    response_model=HintResponse,
    summary="Generate a child-friendly hint for the current exercise.",
)
def get_hint(req: HintRequest) -> HintResponse:
    try:
        return learning_service.get_hint(req.prompt_en, req.correct_answer, req.target_lang)
    except Exception as exc:
        # Never return 5xx from the hint endpoint — degrade gracefully.
        logger.warning("Hint endpoint fallback triggered: %s", exc)
        return HintResponse(
            hint="Try listening to the audio again! Tap the speaker button.",
        )


# GET /api/learning/pronounce ─────────────────────────────────────────────────

@learning_router.get(
    "/pronounce",
    response_model=PronounceResponse,
    summary="Synthesise a single Warli word and return base64 MP3 audio.",
)
def pronounce(
    word: str = Query(..., min_length=1, description="Warli word to synthesise."),
) -> PronounceResponse:
    result = learning_service.get_pronounce(word)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Audio synthesis is unavailable. "
                "TTS may be disabled or offline (set WARLI_TTS_ENABLED=true)."
            ),
        )
    return result


# GET /api/learning/classroom ─────────────────────────────────────────────────

@learning_router.get(
    "/classroom",
    response_model=ClassroomResponse,
    summary="Return mock classroom data for the teacher dashboard.",
)
def get_classroom() -> ClassroomResponse:
    return learning_service.get_classroom()
