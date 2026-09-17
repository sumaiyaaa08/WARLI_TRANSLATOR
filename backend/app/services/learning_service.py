"""Learning service — file I/O for pedagogy JSON + hint generation.

All JSON loading is tolerant: missing/bad files log a warning but never
crash the request. Services that need the translation engine or TTS use
lazy local imports inside their function bodies to avoid circular imports.
"""
from __future__ import annotations

import base64
import json
import logging
from pathlib import Path
from typing import Optional

from ..config import settings
from ..models.learning_schemas import (
    ClassroomResponse,
    HintResponse,
    LearningPathResponse,
    LessonDetail,
    LessonSummary,
    PronounceResponse,
)

logger = logging.getLogger("warli.learning")


# ── Helpers ──────────────────────────────────────────────────────────────────

def _load_json(path: Path, default):
    """Tolerant loader — logs warnings but never raises."""
    if not path.exists():
        logger.warning("Pedagogy file missing: %s", path)
        return default
    try:
        with path.open("r", encoding="utf-8") as fh:
            return json.load(fh)
    except (json.JSONDecodeError, OSError) as exc:
        logger.error("Failed to load %s: %s", path, exc)
        return default


# ── Service functions ─────────────────────────────────────────────────────────

def get_learning_path() -> LearningPathResponse:
    """Load curriculum.json and inline lesson summaries from individual files."""
    raw = _load_json(
        settings.pedagogy_dir / "curriculum.json",
        {"version": "1.0", "units": []},
    )
    units = []
    for unit_raw in raw.get("units", []):
        lesson_summaries = []
        for lesson_id in unit_raw.get("lessons", []):
            lesson_raw = _load_json(
                settings.pedagogy_dir / "lessons" / f"{lesson_id}.json", {}
            )
            if lesson_raw:
                lesson_summaries.append(
                    LessonSummary(
                        id=lesson_raw.get("id", lesson_id),
                        title_en=lesson_raw.get("title_en", lesson_id),
                        title_hi=lesson_raw.get("title_hi", lesson_id),
                        title_mr=lesson_raw.get("title_mr", lesson_raw.get("title_hi", lesson_id)),
                        xp_reward=lesson_raw.get("xp_reward", 10),
                    )
                )
        units.append({**unit_raw, "lessons": [ls.model_dump() for ls in lesson_summaries]})
    return LearningPathResponse(**{**raw, "units": units})


def get_lesson(lesson_id: str) -> Optional[LessonDetail]:
    """Load a single lesson file. Returns None if the file is missing."""
    safe_id = Path(lesson_id).name  # prevent path traversal
    path = settings.pedagogy_dir / "lessons" / f"{safe_id}.json"
    raw = _load_json(path, None)
    if raw is None:
        return None
    return LessonDetail(**raw)


def get_hint(prompt_en: str, correct_answer: str) -> HintResponse:
    """Generate a child-friendly hint by using the rule engine."""
    from .translation import get_engine  # lazy to avoid circular import

    try:
        engine = get_engine()
        result = engine.translate(prompt_en, source_lang="en")
        matched = [
            t for t in result.tokens
            if t.matched and t.warli == correct_answer
        ]
        breakdown = None
        if matched and matched[0].roman:
            breakdown = f"'{correct_answer}' sounds like '{matched[0].roman}' in Warli."

        hint = (
            f"Look carefully! The answer is '{correct_answer}'. "
            "Try saying it out loud — tap the speaker to hear it again."
        )
        if breakdown:
            hint = breakdown + " " + hint

        return HintResponse(hint=hint, warli_breakdown=breakdown)
    except Exception as exc:
        logger.warning("Hint generation failed: %s", exc)
        return HintResponse(
            hint=(
                f"The correct answer is '{correct_answer}'. "
                "Tap the speaker button to hear how it sounds!"
            )
        )


def get_pronounce(word: str) -> Optional[PronounceResponse]:
    """Synthesise a single Warli word via the existing GttsWarli service."""
    from .tts import TTSError, get_tts  # lazy to avoid circular import

    word = (word or "").strip()
    if not word:
        return None
    try:
        result = get_tts().synthesize(word)
        return PronounceResponse(
            word=word,
            audio_base64=base64.b64encode(result.audio_bytes).decode("ascii"),
            audio_mime=result.mime,
            approximation=True,
        )
    except TTSError as exc:
        logger.warning("Pronounce TTS failed for '%s': %s", word, exc)
        return None


def get_classroom() -> ClassroomResponse:
    """Load mock classroom data and compute average XP."""
    raw = _load_json(
        settings.pedagogy_dir / "mock_classroom.json",
        {"class_name": "Demo Class", "students": [], "lesson_stats": []},
    )
    students = raw.get("students", [])
    avg_xp = (
        sum(s.get("xp", 0) for s in students) / len(students)
        if students
        else 0.0
    )
    return ClassroomResponse(**{**raw, "avg_class_xp": round(avg_xp, 1)})
