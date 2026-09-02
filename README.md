# Warli Speech Translator

A full-stack web app that translates spoken or typed **English / Hindi** into
**Warli** (a tribal language of the Palghar region, written here in Devanagari).

Two output modes:

1. **Speech → Warli Text** — you speak English/Hindi, the app shows the Warli text.
2. **Speech → Warli Speech** — same, plus the app plays the Warli translation as audio.

> **Important honesty note:** Warli is **not** recognized directly from audio
> (no large Warli speech corpus exists). The pipeline is
> `ASR (English/Hindi) → rule-based translation → optional TTS`, and the Warli
> **speech output is an approximation** — a Hindi/Marathi voice reading Devanagari
> Warli text. There is no true Warli TTS model. This is flagged in code, in API
> responses, and in the UI.

---

## Pipeline

```
User speaks (English/Hindi)
        ↓  ASR  (Whisper — pretrained, not built from scratch)
English/Hindi text
        ↓  Translation engine (dictionary lookup + grammar rules + spelling correction)
Warli text (Devanagari)
        ↓  (optional) TTS — Hindi/Marathi voice reading Devanagari  [APPROXIMATION]
Warli speech audio
```

The **translation "model" is deliberately not a neural net**. It is a
data-driven **lookup + rule engine** with a **spelling-correction pass**, all
behind a clean interface so it can later be swapped for a trained seq2seq model.

---

## Folder structure

```
warliiii/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entrypoint
│   │   ├── config.py            # paths + feature flags (env-overridable)
│   │   ├── api/
│   │   │   ├── routes.py        # thin HTTP handlers
│   │   │   └── errors.py        # consistent JSON error responses
│   │   ├── services/
│   │   │   ├── asr.py           # Whisper speech→text wrapper (lazy-loaded)
│   │   │   ├── translation.py   # dictionary + rules + correction (CORE)
│   │   │   ├── tts.py           # Hindi/Marathi voice (approximation)
│   │   │   └── pronunciation.py # OPTIONAL, decoupled pronunciation nudge
│   │   └── models/schemas.py    # Pydantic request/response models
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/client.js        # backend calls
│   │   ├── components/          # Recorder, ResultPanel, AudioPlayer, toggles
│   │   ├── pages/TranslatePage.jsx
│   │   ├── App.jsx, main.jsx, index.css
│   └── package.json, vite.config.js
├── data/
│   ├── warli_dictionary/        # dictionary + grammar rules (loaded at runtime)
│   ├── voice_recording/         # wrong→correct spelling pairs
│   ├── research_papers/         # lipi/pronunciation reference PDFs (drop here)
│   └── pronunciation_audio/     # OPTIONAL: YouTube/field clips + lexicon
└── README.md
```

**All dictionary / correction / pronunciation data is read from files under
`data/` at runtime — nothing is hardcoded in Python.** The data currently in the
repo is clearly-labeled **seed/example** data so the app runs immediately; you
replace it with the team's real assets (see below).

---

## Run locally

### 1. Backend (FastAPI)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1          # Windows PowerShell
pip install -r requirements.txt
uvicorn app.main:app --reload         # http://127.0.0.1:8000  (docs at /docs)
```

macOS/Linux: `source .venv/bin/activate`.

> **Python version:** 3.11–3.13 is the sweet spot. On a very new interpreter
> (e.g. 3.14) some native wheels (`pydantic-core`, `faster-whisper`) may not
> exist yet — if `pip install` tries to compile Rust and fails, use Python 3.12.

### 2. Frontend (React + Vite)

```powershell
cd frontend
npm install
npm run dev                           # http://localhost:5173
```

The Vite dev server proxies `/api` → `http://127.0.0.1:8000`, so no CORS setup
is needed in dev. To point elsewhere, set `VITE_API_URL` (see `frontend/.env.example`).

### Quick check without the UI

```powershell
curl http://127.0.0.1:8000/health
curl -X POST http://127.0.0.1:8000/translate/text `
     -H "Content-Type: application/json" `
     -d '{\"text\":\"give water to the child\",\"source_lang\":\"en\",\"output_mode\":\"text\"}'
```

---

## Optional feature flags (environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `WARLI_ASR_ENABLED` | `true` | Turn off Whisper (text mode still works) |
| `WARLI_ASR_BACKEND` | `faster-whisper` | or `openai-whisper` |
| `WARLI_ASR_MODEL` | `small` | Whisper model size |
| `WARLI_TRANSLATION_ENGINE` | `rule` | engine selector (see "swapping") |
| `WARLI_TTS_ENABLED` | `true` | turn off speech output (gTTS needs internet) |
| `WARLI_TTS_LANG` | `hi` | `hi` or `mr` voice for the approximation |
| `WARLI_PRONUNCIATION_ENABLED` | `true` | enable/disable the optional pronunciation layer |
| `WARLI_DATA_DIR` | `<repo>/data` | override where data files are read from |
| `WARLI_CORS_ORIGINS` | localhost dev URLs | comma-separated allowed origins |

To run text-only with no ML/network dependencies at all:

```powershell
$env:WARLI_ASR_ENABLED="false"; $env:WARLI_TTS_ENABLED="false"
uvicorn app.main:app --reload
```

---

## API endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/translate/text` | `{text, source_lang, output_mode}` → Warli text (+ audio if `speech`) |
| `POST` | `/translate/speech` | multipart: `audio` file + `source_lang` + `output_mode` → Warli text (+ audio) |
| `GET` | `/dictionary` | admin/debug lookup; `?q=`, `?source_lang=`, `?limit=` |
| `GET` | `/health` | status + data counts (dictionary/corrections/pronunciation) |
| `POST` | `/admin/reload` | re-read all data files from disk without restarting |

Errors always return `{ "error": "<code>", "detail": "<message>" }` with a proper
HTTP status (e.g. `415` unsupported audio format, `413` too large, `422`
validation, `400` no speech detected).

---

## Where to drop in your real data

Replace the seed data — keep the same JSON schema and the app picks it up on
restart (or `POST /admin/reload`):

| Your asset | Put it here | Notes |
|---|---|---|
| `warli_dictionary.*` | `data/warli_dictionary/warli_dictionary.json` | English/Hindi → Warli entries |
| grammar from research papers | `data/warli_dictionary/grammar_rules.json` | word order, inflection, postpositions |
| `voice_recording.*` annotations | `data/voice_recording/corrections.json` | wrong → correct spelling pairs |
| research PDFs (lipi + pronunciation) | `data/research_papers/` | authoritative reference for the two JSONs above |
| YouTube/field pronunciation audio | `data/pronunciation_audio/` | clips + `transcriptions.csv` + `lexicon.json` |

Each folder has its own `README.md` with the exact schema and conversion steps.
**The current entries are seed/example data**, structurally correct but not the
team's researched dictionary — swap them before any real evaluation.

---

## How the translation logic works (and how to swap it)

`backend/app/services/translation.py` is the core. It is heavily commented and
split into three independent stages:

1. **Lookup** (`Dictionary`) — greedy longest-phrase match, then single word,
   then postposition map (`grammar_rules.json`). Unmatched tokens pass through
   and are flagged in the response.
2. **Grammar rules** (`GrammarRules`) — reorder to Warli **SOV** order and apply
   coarse inflection suffixes triggered by source cues (`is/are` → present,
   `was/were` → past).
3. **Spelling correction** (`SpellingCorrector`) — apply the wrong→correct pairs
   from the annotated voice recording to normalize the output.

Everything sits behind the `TranslationEngine` interface:

```python
class TranslationEngine(ABC):
    def translate(self, text, source_lang) -> TranslationResult: ...
    def reload(self) -> None: ...
```

**To swap in a trained model later:** implement a new `TranslationEngine`
subclass (e.g. `Seq2SeqTranslator`) and register it in `build_engine()`
(`WARLI_TRANSLATION_ENGINE=seq2seq`). Routes and the frontend need **no changes**
because they only ever call the interface.

---

## Optional module — Warli pronunciation fine-tuning (stretch goal)

**What it does:** the base TTS uses a Hindi/Marathi voice, which applies
Hindi/Marathi phonetics to Warli text. The optional layer
(`services/pronunciation.py` + `data/pronunciation_audio/lexicon.json`) rewrites
specific words to a Devanagari **respelling** before synthesis, nudging the voice
closer to authentic Warli pronunciation. The respellings are derived from the
research papers and transcribed audio.

**Fully decoupled:** if `lexicon.json` is empty/missing or
`WARLI_PRONUNCIATION_ENABLED=false`, TTS reads the Warli text unchanged. The core
translation pipeline never depends on this module and works with or without it.

**How to improve it over time:**

1. Collect **publicly available** Warli audio (folk songs, community videos) or
   field recordings.
2. Cut into short phrase/word segments → `data/pronunciation_audio/clips/`.
3. Transcribe each into Warli Devanagari → add a row to `transcriptions.csv`.
4. Add `word → respelling` entries to `lexicon.json`.
5. **Credit every source in `data/pronunciation_audio/sources.md`.**

> Accuracy **scales with how much transcribed Warli audio** the team collects
> (from YouTube now, from the field visit later). It is expected to improve over
> time, not be complete at launch.

**Advanced path:** if enough transcribed audio is collected during the field
visit, fine-tune a small open-source TTS/ASR model on it. Implement it as another
class exposing the same `adjust()` method and wire it via config — still decoupled
from translation.

**Legal/ethics:** use only publicly available content (or recordings made with
explicit community consent), and list every source in `sources.md` for academic
transparency.

---

## Deployment (Vercel frontend + Render backend)

The frontend is static (Vercel). The backend needs a persistent server for
Whisper + gTTS, so it goes on Render. Config files are already in the repo:
`render.yaml` (backend blueprint) and `frontend/vercel.json` (frontend build).

### A. Backend → Render

1. Push this repo to GitHub/GitLab.
2. Render dashboard → **New +** → **Blueprint** → connect the repo. Render reads
   `render.yaml` and creates the `warli-backend` web service automatically.
   (Or **New + → Web Service** and set: build `pip install -r backend/requirements.txt`,
   start `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`,
   health check `/health`.)
3. When prompted, set the `WARLI_CORS_ORIGINS` env var to your Vercel origin,
   e.g. `https://warli-translator.vercel.app` (add both `*.vercel.app` and any
   custom domain, comma-separated). This is required or the browser blocks calls.
4. Deploy. Your API is live at `https://<your-service>.onrender.com`
   (verify `…/health`).

> **Free-tier notes:** the service spins down when idle, and the disk is
> ephemeral, so the first request after a cold start re-downloads the Whisper
> model (slow). To mitigate: set `WARLI_ASR_MODEL=base` or `tiny`, or
> `WARLI_ASR_ENABLED=false` for text-only, or upgrade to a paid instance with
> persistent disk. `PYTHON_VERSION` is pinned to 3.12.3 in the blueprint because
> 3.14 lacks prebuilt wheels for some native deps.

### B. Frontend → Vercel

1. Vercel dashboard → **Add New → Project** → import the same repo.
2. Set **Root Directory** to `frontend` (so `frontend/vercel.json` and
   `package.json` are used; framework auto-detected as Vite, output `dist`).
3. Add the environment variable:
   - `VITE_API_URL` = `https://<your-service>.onrender.com` (your Render URL,
     no trailing slash). See `frontend/.env.production.example`.
4. Deploy. Vercel builds and serves the SPA.

> `VITE_API_URL` is baked into the bundle at build time — after changing it,
> redeploy the frontend. In dev the Vite proxy uses `/api`; in production the
> app calls the Render origin directly (hence the CORS requirement in step A3).

### C. Post-deploy checklist

- `GET https://<backend>/health` → `status: ok` with dictionary counts.
- Open the Vercel URL; the status strip at the top should show live counts
  (confirms CORS + API URL are correct). If it says “Backend not reachable”,
  check `VITE_API_URL` and `WARLI_CORS_ORIGINS`.
- Speech input downloads the Whisper model on first use; text mode works
  immediately.

### Updating data after deploy

Edit the JSON files under `data/`, commit, and push — Render auto-redeploys
(`autoDeploy: true`). For a no-restart refresh you can also
`POST https://<backend>/admin/reload`.

---

## Known limitations

- Warli **speech output is an approximation** (Hindi/Marathi voice), not a real
  Warli voice.
- The rule engine's grammar coverage is coarse; quality depends entirely on the
  dictionary + rules the team supplies.
- Whisper downloads its model on first use; gTTS needs internet access.
- Seed data in `data/` is example content, not the researched dictionary.
