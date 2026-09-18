"""Pydantic v2 schemas for the learning (pedagogy) API endpoints.

Kept separate from schemas.py so the learning API can evolve
independently of the translation API.
"""
from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


# ── Exercise types ──────────────────────────────────────────────────────────

class ExerciseType(str, Enum):
    multiple_choice = "multiple_choice"
    match_pairs = "match_pairs"
    listen_type = "listen_type"
    teach = "teach"  # intro card: teaches first, no scoring — "Got it" advances


class Exercise(BaseModel):
    id: str
    type: ExerciseType
    prompt_en: str
    prompt_hi: str
    prompt_mr: Optional[str] = None
    target_lang: str = "warli"  # 'warli' | 'santali' — which language is taught
    # Big stimulus shown above the exercise (e.g. an Ol Chiki letter to name).
    display: Optional[str] = None
    # Teach-card body + optional letter grid [{char, name}].
    body_en: Optional[str] = None
    body_hi: Optional[str] = None
    body_mr: Optional[str] = None
    letters: Optional[List[dict]] = None
    audio_word: Optional[str] = None
    options: Optional[List[str]] = None
    pairs: Optional[List[dict]] = None
    # Correct answer (quiz types). Teach cards carry none — "Got it" advances.
    correct: Optional[str] = None
    # Optional grammar/vocab tip shown above the exercise (SOV rule etc.).
    tip_en: Optional[str] = None
    tip_hi: Optional[str] = None
    tip_mr: Optional[str] = None


# ── Lesson ──────────────────────────────────────────────────────────────────

class LessonSummary(BaseModel):
    id: str
    title_en: str
    title_hi: str
    title_mr: Optional[str] = None
    target_lang: str = "warli"
    xp_reward: int


class LessonDetail(BaseModel):
    id: str
    title_en: str
    title_hi: str
    title_mr: Optional[str] = None
    target_lang: str = "warli"
    xp_reward: int
    exercises: List[Exercise] = Field(default_factory=list)


# ── Curriculum ───────────────────────────────────────────────────────────────

class CurriculumUnit(BaseModel):
    id: str
    title_en: str
    title_hi: str
    title_mr: Optional[str] = None
    target_lang: str = "warli"  # 'santali' units come first (primary), Warli after
    icon: str
    lessons: List[LessonSummary] = Field(default_factory=list)


class LearningPathResponse(BaseModel):
    version: str
    units: List[CurriculumUnit] = Field(default_factory=list)


# ── Hint ────────────────────────────────────────────────────────────────────

class HintRequest(BaseModel):
    prompt_en: str = Field(..., description="The exercise question in English.")
    correct_answer: str = Field(..., description="The correct Warli answer.")
    source_lang: str = Field("en", description="Language of prompt: 'en', 'hi' or 'mr'.")
    target_lang: str = Field("warli", description="Language taught: 'warli' or 'santali'.")


class HintResponse(BaseModel):
    hint: str
    warli_breakdown: Optional[str] = None
    engine: str = "rule"


# ── Pronounce ───────────────────────────────────────────────────────────────

class PronounceResponse(BaseModel):
    word: str
    audio_base64: str
    audio_mime: str = "audio/mpeg"
    approximation: bool = True


# ── Classroom (Teacher Dashboard) ───────────────────────────────────────────

class StudentRecord(BaseModel):
    id: str
    name: str
    xp: int
    completed_lessons: List[str] = Field(default_factory=list)
    streak: int = 0


class LessonStat(BaseModel):
    lesson_id: str
    avg_score_pct: int
    attempts: int
    struggle_exercise_ids: List[str] = Field(default_factory=list)


class ClassroomResponse(BaseModel):
    class_name: str
    students: List[StudentRecord] = Field(default_factory=list)
    lesson_stats: List[LessonStat] = Field(default_factory=list)
    avg_class_xp: float = 0.0
