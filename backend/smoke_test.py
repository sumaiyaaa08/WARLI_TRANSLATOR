"""End-to-end smoke test for the Warli Speech Translator backend.

Exercises the REAL components (no mocks):
  1. Translation engine  (dictionary + grammar rules + spelling correction)
  2. Pronunciation layer (optional, decoupled)
  3. TTS                 (gTTS Marathi voice reading Warli Devanagari) [needs internet]
  4. ASR round-trip      (gTTS creates English speech -> faster-whisper transcribes
                          -> translate -> Warli) [downloads Whisper model on first run]
  5. HTTP endpoints      (FastAPI TestClient: /api/health, /api/translate/text,
                          /api/dictionary, error handling)

Run from backend/:
    set WARLI_ASR_MODEL=tiny   (small download for the test)
    python smoke_test.py
Each check prints PASS/FAIL; exits non-zero if any hard failure occurs.
"""
from __future__ import annotations

import io
import os
import sys
import tempfile
import traceback

# Default to the tiny Whisper model for a fast test download unless overridden.
os.environ.setdefault("WARLI_ASR_MODEL", "tiny")
os.environ.setdefault("WARLI_ASR_ENABLED", "true")
os.environ.setdefault("WARLI_TTS_ENABLED", "true")

RESULTS: list[tuple[str, bool, str]] = []


def check(name: str, fn):
    try:
        detail = fn()
        RESULTS.append((name, True, detail or ""))
        print(f"[PASS] {name} — {detail or ''}")
    except Exception as exc:  # noqa: BLE001
        RESULTS.append((name, False, f"{type(exc).__name__}: {exc}"))
        print(f"[FAIL] {name} — {type(exc).__name__}: {exc}")
        traceback.print_exc()


# --- 1. Translation engine -------------------------------------------------
def t_translation():
    from app.services.translation import build_engine
    engine = build_engine("rule")
    r = engine.translate("give water to the child", "en")
    assert r.warli_text, "empty Warli output"
    # verb 'दे' (give) should be moved to the end by the SOV reorder rule
    assert r.warli_text.strip().split()[-1] == "दे", f"SOV reorder failed: {r.warli_text}"
    r2 = engine.translate("I drink water", "en")
    assert "पाणी" in r2.warli_text, f"dictionary lookup failed: {r2.warli_text}"
    return f"'give water to the child' -> '{r.warli_text}'"


def t_correction():
    # The correction table maps पानी -> पाणी; feed it through the corrector.
    from app.services.translation import build_engine
    engine = build_engine("rule")
    corrected, applied = engine.corrector.correct_token("पानी")
    assert corrected == "पाणी" and applied is not None, "spelling correction failed"
    return f"पानी -> {corrected}"


# --- 2. Pronunciation layer (optional) ------------------------------------
def t_pronunciation():
    from app.services.pronunciation import get_pronunciation_layer
    layer = get_pronunciation_layer()
    text, changed, applied = layer.adjust("पाणी मादे")
    # lexicon has पाणी -> पावऽणी ; must not crash and must be decoupled-safe
    return f"available={layer.available} changed={changed} applied={applied} out='{text}'"


# --- 3. TTS (gTTS) ---------------------------------------------------------
def t_tts():
    from app.services.tts import get_tts
    res = get_tts().synthesize("पाणी दे")
    assert res.audio_bytes and len(res.audio_bytes) > 1000, "TTS produced no/short audio"
    assert res.approximation is True, "TTS must be flagged as approximation"
    return f"{len(res.audio_bytes)} bytes mp3, voice={res.voice_lang}, approx={res.approximation}"


# --- 4. ASR round-trip (gTTS -> faster-whisper) ----------------------------
def t_asr_roundtrip():
    from gtts import gTTS
    from app.services.asr import get_asr
    from app.services.translation import build_engine

    # Create a real English speech clip.
    phrase = "give water to the child"
    buf = io.BytesIO()
    gTTS(text=phrase, lang="en").write_to_fp(buf)
    audio = buf.getvalue()
    assert len(audio) > 1000, "gTTS could not create the test clip (internet?)"

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
    tmp.write(audio); tmp.flush(); tmp.close()
    try:
        asr = get_asr().transcribe(audio, source_lang="en", filename="speech.mp3")
    finally:
        os.unlink(tmp.name)

    assert asr.text, "ASR returned empty transcription"
    result = build_engine("rule").translate(asr.text, "en")
    assert result.warli_text, "translation of ASR output empty"
    return f"heard='{asr.text}' -> warli='{result.warli_text}'"


# --- 5. HTTP endpoints (TestClient) ----------------------------------------
def t_http():
    from fastapi.testclient import TestClient
    from app.main import app
    with TestClient(app) as client:
        h = client.get("/api/health")
        assert h.status_code == 200, f"/health {h.status_code}"
        health = h.json()
        assert health["status"] == "ok" and health["dictionary_entries"] > 0

        r = client.post("/api/translate/text", json={
            "text": "I drink water", "source_lang": "en", "output_mode": "text",
        })
        assert r.status_code == 200, f"/api/translate/text {r.status_code}: {r.text}"
        body = r.json()
        assert body["warli_text"], "no warli_text in response"

        d = client.get("/api/dictionary", params={"q": "water"})
        assert d.status_code == 200 and d.json()["count"] >= 1, "dictionary search failed"

        # Validation error path -> clean JSON with 422
        bad = client.post("/api/translate/text", json={})
        assert bad.status_code == 422, f"expected 422, got {bad.status_code}"
        assert bad.json().get("error") == "validation_error", bad.text

        return (f"/health ok ({health['dictionary_entries']} entries); "
                f"/translate/text -> '{body['warli_text']}'; /dictionary ok; 422 error ok")


def t_http_speech():
    # Full speech endpoint through HTTP with a real generated clip.
    from fastapi.testclient import TestClient
    from gtts import gTTS
    from app.main import app
    buf = io.BytesIO(); gTTS(text="come here", lang="en").write_to_fp(buf)
    with TestClient(app) as client:
        files = {"audio": ("speech.mp3", buf.getvalue(), "audio/mpeg")}
        data = {"source_lang": "en", "output_mode": "speech"}
        r = client.post("/api/translate/speech", files=files, data=data)
        assert r.status_code == 200, f"/api/translate/speech {r.status_code}: {r.text}"
        body = r.json()
        assert body["warli_text"], "no warli_text from speech endpoint"
        has_audio = bool(body.get("audio_base64"))
        return (f"speech->text '{body['source_text']}' -> '{body['warli_text']}'; "
                f"warli_audio={'yes' if has_audio else 'no'}")


def t_http_bad_format():
    from fastapi.testclient import TestClient
    from app.main import app
    with TestClient(app) as client:
        files = {"audio": ("notes.txt", b"hello world", "text/plain")}
        r = client.post("/api/translate/speech", files=files,
                        data={"source_lang": "auto", "output_mode": "text"})
        assert r.status_code == 415, f"expected 415 for .txt, got {r.status_code}: {r.text}"
        return f"unsupported format -> 415 ({r.json().get('error')})"


def main():
    print("=" * 60)
    print("Warli backend end-to-end smoke test")
    print("=" * 60)
    check("translation engine (lookup + SOV reorder)", t_translation)
    check("spelling correction table", t_correction)
    check("pronunciation layer (decoupled)", t_pronunciation)
    check("TTS synthesis (gTTS, approximation)", t_tts)
    check("HTTP endpoints (health/text/dictionary/errors)", t_http)
    check("HTTP unsupported-format handling (415)", t_http_bad_format)
    check("ASR round-trip (gTTS -> faster-whisper -> translate)", t_asr_roundtrip)
    check("HTTP /translate/speech end-to-end (+ Warli audio)", t_http_speech)

    print("=" * 60)
    passed = sum(1 for _, ok, _ in RESULTS if ok)
    total = len(RESULTS)
    print(f"RESULT: {passed}/{total} checks passed")
    for name, ok, detail in RESULTS:
        if not ok:
            print(f"  FAILED: {name} — {detail}")
    print("=" * 60)
    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    main()
