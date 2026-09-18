"""API route handlers.

Thin layer: parse/validate input -> call services (ASR / translation / TTS) ->
map results to response schemas -> handle service errors as JSON. No business
logic lives here; it is all in app.services.
"""
from __future__ import annotations

import base64
import logging

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile, status

from ..config import settings
from ..models.schemas import (
    CorrectionApplied,
    DictionaryEntry,
    DictionaryResponse,
    ErrorResponse,
    HealthResponse,
    OutputMode,
    ReloadResponse,
    SourceLanguage,
    TargetLanguage,
    TTSMeta,
    TextTranslateRequest,
    TokenTranslation,
    TranslationResponse,
)
from ..services.asr import ASRError, get_asr
from ..services.pronunciation import get_pronunciation_layer
from ..services.translation import TranslationResult, get_engine, reload_engine
from ..services.tts import TTSError, get_tts

logger = logging.getLogger("warli.api")

router = APIRouter()


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
def _result_to_response(
    result: TranslationResult,
    output_mode: OutputMode,
    audio_bytes: bytes | None = None,
    audio_mime: str | None = None,
    tts_meta: TTSMeta | None = None,
) -> TranslationResponse:
    return TranslationResponse(
        source_text=result.source_text,
        source_lang=SourceLanguage(result.source_lang)
        if result.source_lang in ("en", "hi", "mr")
        else SourceLanguage.auto,
        target_lang=TargetLanguage(result.target_lang)
        if result.target_lang in ("warli", "santali")
        else TargetLanguage.warli,
        warli_text=result.warli_text,
        warli_roman=result.warli_roman,
        translated_text=result.warli_text,
        target_roman=result.warli_roman,
        engine=result.engine,
        tokens=[
            TokenTranslation(
                source=t.source, warli=t.warli, matched=t.matched,
                pos=t.pos, roman=t.roman,
            )
            for t in result.tokens
        ],
        unmatched=result.unmatched,
        corrections_applied=[
            CorrectionApplied(wrong=c.wrong, correct=c.correct, source=c.source)
            for c in result.corrections_applied
        ],
        warnings=result.warnings,
        output_mode=output_mode,
        tts=tts_meta,
        audio_base64=base64.b64encode(audio_bytes).decode("ascii") if audio_bytes else None,
        audio_mime=audio_mime,
    )


def _maybe_synthesize(warli_text: str, output_mode: OutputMode,
                      target_lang: str = "warli"):
    """If speech output is requested, synthesize audio.

    Warli: Marathi voice reading Devanagari (approximation). Santali: Ol Chiki
    is first transliterated to Devanagari, then read by the same voice (double
    approximation — flagged in the note). No Santali voice model exists.
    """
    if output_mode != OutputMode.speech or not warli_text:
        return None, None, None
    if target_lang != "warli":
        from ..services.transliterate import transliterate_olchiki
        try:
            spoken = transliterate_olchiki(warli_text)
            tts_result = get_tts().synthesize(spoken, apply_pronunciation=False)
        except TTSError as exc:
            logger.warning("Santali TTS failed: %s", exc)
            meta = TTSMeta(
                generated=False, approximation=True, voice_lang=None,
                pronunciation_layer_applied=False, note=str(exc),
            )
            return None, None, meta
        meta = TTSMeta(
            generated=True,
            approximation=True,
            voice_lang=tts_result.voice_lang,
            pronunciation_layer_applied=False,
            note=("Santali speech is an approximation: Ol Chiki transliterated to "
                  "Devanagari and read by a Marathi voice — no Santali voice "
                  "model exists."),
        )
        return tts_result.audio_bytes, tts_result.mime, meta
    try:
        tts_result = get_tts().synthesize(warli_text)
    except TTSError as exc:
        # Speech failure should not fail the whole request — still return text,
        # but tell the client audio could not be generated.
        logger.warning("TTS failed: %s", exc)
        meta = TTSMeta(
            generated=False, approximation=True, voice_lang=None,
            pronunciation_layer_applied=False, note=str(exc),
        )
        return None, None, meta
    meta = TTSMeta(
        generated=True,
        approximation=True,
        voice_lang=tts_result.voice_lang,
        pronunciation_layer_applied=tts_result.pronunciation_applied,
    )
    return tts_result.audio_bytes, tts_result.mime, meta


# --------------------------------------------------------------------------
# POST /translate/text  — text in, Warli text (+optional audio) out
# --------------------------------------------------------------------------
@router.post(
    "/translate/text",
    response_model=TranslationResponse,
    responses={422: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
    summary="Translate English/Hindi/Marathi text to Warli.",
)
def translate_text(req: TextTranslateRequest) -> TranslationResponse:
    engine = get_engine()
    result = engine.translate(
        req.text, source_lang=req.source_lang.value, target_lang=req.target_lang.value
    )
    audio, mime, tts_meta = _maybe_synthesize(
        result.warli_text, req.output_mode, req.target_lang.value
    )
    return _result_to_response(result, req.output_mode, audio, mime, tts_meta)


# --------------------------------------------------------------------------
# POST /translate/speech — audio in, Warli text (+optional audio) out
# --------------------------------------------------------------------------
@router.post(
    "/translate/speech",
    response_model=TranslationResponse,
    responses={
        400: {"model": ErrorResponse},
        413: {"model": ErrorResponse},
        415: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Transcribe English/Hindi/Marathi speech, then translate to Warli.",
)
async def translate_speech(
    audio: UploadFile = File(..., description="Spoken English/Hindi/Marathi audio."),
    source_lang: SourceLanguage = Form(SourceLanguage.auto),
    output_mode: OutputMode = Form(OutputMode.text),
    target_lang: TargetLanguage = Form(TargetLanguage.warli),
) -> TranslationResponse:
    # Guard: upload size.
    raw = await audio.read()
    if len(raw) > settings.max_upload_bytes:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"Audio too large (max {settings.max_upload_bytes // (1024*1024)} MB).",
        )
    if not raw:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty audio upload.")

    # 1) ASR: speech -> source text.
    try:
        asr_result = get_asr().transcribe(
            raw, source_lang=source_lang.value, filename=audio.filename
        )
    except ASRError as exc:
        # Unsupported format / no speech / ASR disabled -> clear JSON errors.
        code = status.HTTP_415_UNSUPPORTED_MEDIA_TYPE if "format" in str(exc).lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(code, str(exc))

    # 2) Translation: source text -> Warli. Use ASR-detected language if caller
    #    asked for 'auto'.
    detected = asr_result.language or source_lang.value
    lang = detected if source_lang == SourceLanguage.auto else source_lang.value
    supported = ("en", "hi", "mr")
    lang = lang if lang in supported else detected if detected in supported else "en"

    engine = get_engine()
    result = engine.translate(asr_result.text, source_lang=lang, target_lang=target_lang.value)

    # 3) Optional TTS: Warli text -> Warli speech (approximation).
    audio_out, mime, tts_meta = _maybe_synthesize(result.warli_text, output_mode, target_lang.value)
    return _result_to_response(result, output_mode, audio_out, mime, tts_meta)


# --------------------------------------------------------------------------
# GET /dictionary — admin/debug lookup
# --------------------------------------------------------------------------
@router.get(
    "/dictionary",
    response_model=DictionaryResponse,
    summary="Browse/search the Warli dictionary (admin & debug).",
)
def get_dictionary(
    q: str | None = Query(None, description="Substring filter across en/hi/headword/roman."),
    source_lang: SourceLanguage | None = Query(None, description="Restrict to entries with this key."),
    target_lang: TargetLanguage = Query(TargetLanguage.warli, description="Which dictionary: 'warli' or 'santali'."),
    limit: int = Query(200, ge=1, le=2000),
) -> DictionaryResponse:
    engine = get_engine()
    dictionary = getattr(engine, "dictionaries", {}).get(target_lang.value) or getattr(engine, "dictionary", None)
    if dictionary is None:
        raise HTTPException(
            status.HTTP_501_NOT_IMPLEMENTED,
            "Active translation engine does not expose a browsable dictionary.",
        )
    head_key = getattr(dictionary, "word_key", "warli")

    needle = (q or "").strip().lower()
    entries: list[DictionaryEntry] = []
    for e in dictionary.all_entries():
        if source_lang and source_lang.value in ("en", "hi", "mr") and not e.get(source_lang.value):
            continue
        if needle:
            haystack = " ".join(
                str(e.get(k, "")).lower() for k in ("en", "hi", head_key, "roman")
            )
            if needle not in haystack:
                continue
        entries.append(
            DictionaryEntry(
                warli=e.get(head_key, ""),
                roman=e.get("roman"),
                en=e.get("en"),
                hi=e.get("hi"),
                pos=e.get("pos"),
                example=e.get("example"),
                tags=e.get("tags", []) or [],
            )
        )
        if len(entries) >= limit:
            break

    return DictionaryResponse(count=len(entries), q=q, source_lang=source_lang.value if source_lang else None, target_lang=target_lang.value, entries=entries)


# --------------------------------------------------------------------------
# GET /health & POST /admin/reload
# --------------------------------------------------------------------------
@router.get("/health", response_model=HealthResponse, summary="Service health + data counts.")
def health() -> HealthResponse:
    engine = get_engine()
    dictionary = getattr(engine, "dictionary", None)
    corrector = getattr(engine, "corrector", None)
    layer = get_pronunciation_layer()
    santali = getattr(engine, "dictionaries", {}).get("santali")
    return HealthResponse(
        status="ok",
        translation_engine=engine.name,
        dictionary_entries=len(dictionary) if dictionary is not None else 0,
        santali_entries=len(santali) if santali is not None else 0,
        correction_pairs=len(corrector) if corrector is not None else 0,
        pronunciation_entries=len(layer),
        asr_enabled=settings.asr_enabled,
        tts_enabled=settings.tts_enabled,
    )


@router.post(
    "/admin/reload",
    response_model=ReloadResponse,
    summary="Reload dictionary/rules/corrections/pronunciation from disk (no restart).",
)
def admin_reload() -> ReloadResponse:
    engine = reload_engine()
    from ..services.pronunciation import reload_pronunciation_layer

    layer = reload_pronunciation_layer()
    dictionary = getattr(engine, "dictionary", None)
    corrector = getattr(engine, "corrector", None)
    santali = getattr(engine, "dictionaries", {}).get("santali")
    return ReloadResponse(
        status="reloaded",
        dictionary_entries=len(dictionary) if dictionary is not None else 0,
        santali_entries=len(santali) if santali is not None else 0,
        correction_pairs=len(corrector) if corrector is not None else 0,
        pronunciation_entries=len(layer),
    )
