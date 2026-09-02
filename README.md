# Warli Speech Translator

A full-stack web app that translates **typed or spoken English / Hindi** into
**Warli** (Varli) — an Indo-Aryan, Marathi-family tribal language of the
Maharashtra/Gujarat region — rendered here in Devanagari, with optional spoken output.

Two output modes:

1. **Text → Warli Text** — type English/Hindi, get the Warli text.
2. **Speech / Text → Warli Text + Audio** — the same, plus the Warli translation spoken aloud.

> **Honesty note.** Warli is **not** recognized directly from audio (no large Warli
> speech corpus exists) and there is **no true Warli TTS model**. The pipeline is
> `ASR (English/Hindi) → rule-based translation → optional TTS`, where the Warli
> **speech output is an approximation**: a **Marathi** gTTS voice (preferred over
> Hindi, because Warli is Marathi-family) reading Devanagari Warli text, optionally
> nudged by a pronunciation-respelling lexicon. This is flagged in code, in API
> responses, and in the UI.

---

## Pipeline

```
User speaks / types (English/Hindi)
        ↓  ASR  (Whisper — pretrained, not built from scratch)      [speech input only]
English/Hindi text
        ↓  Translation engine (dictionary lookup + grammar rules + spelling correction)
Warli text (Devanagari)
        ↓  (optional) pronunciation respelling  →  Marathi gTTS voice   [APPROXIMATION]
Warli speech audio
```

The translation "model" is deliberately **not** a neural net. It is a data-driven
**lookup + rule engine** with a **spelling-correction pass**, sitting behind a clean
interface so it can later be swapped for a trained seq2seq model without touching
the routes or the frontend.

---

## Project structure

```
warliiii/
├── README.md                     ← this file (full guide)
├── render.yaml                   ← Render backend deployment blueprint
├── .gitignore / .gitattributes   ← Git hygiene
│
├── backend/                      ← FastAPI (Python) service
│   ├── requirements.txt
│   ├── .env.example
│   ├── smoke_test.py
│   └── app/
│       ├── __init__.py
│       ├── main.py               # FastAPI entrypoint
│       ├── config.py             # settings + feature flags + lazy singletons
│       ├── api/       (__init__.py, routes.py, errors.py)
│       ├── models/    (__init__.py, schemas.py)
│       └── services/  (__init__.py, asr.py, translation.py, tts.py, pronunciation.py)
│
├── frontend/                     ← React + Vite single-page app
│   ├── index.html
│   ├── package.json / package-lock.json
│   ├── vite.config.js
│   ├── vercel.json
│   ├── .env.example / .env.production.example / .gitignore
│   └── src/
│       ├── main.jsx, App.jsx, index.css
│       ├── api/        (client.js)
│       ├── pages/      (TranslatePage.jsx)
│       └── components/ (SegmentedToggle, Recorder, AudioPlayer, ResultPanel, WarliArt)
│
└── data/                         ← runtime data assets (read from disk; nothing hardcoded)
    ├── warli_dictionary/    (warli_dictionary.json, grammar_rules.json, README.md)
    ├── voice_recording/     (corrections.json, README.md)
    ├── pronunciation_audio/ (lexicon.json, transcriptions.csv, sources.md, README.md, clips/)
    └── research_papers/     (README.md — drop reference PDFs here)
```

> All dictionary / correction / pronunciation data lives in `data/` and is read at
> runtime. The current content is clearly-labeled **seed/example** data so the app
> runs immediately; replace it with the team's real researched assets.

---

## What each file does

### Root
- **README.md** — this guide: overview, file map, run/deploy steps, and where to make common changes.
- **render.yaml** — Render "blueprint" that provisions the backend web service (Python 3.12.3, build/start commands, `/health` check, env vars — note `WARLI_TTS_LANG: mr`). Edit to change backend hosting.
- **.gitignore** — tells Git to ignore local/generated files (`.venv`, `node_modules`, `dist`, `__pycache__`, `.env`, `.vercel*`, `.qoder`, model caches).
- **.gitattributes** — normalizes line endings (`* text=auto`) so the repo behaves consistently across Windows/macOS/Linux.

### backend/ — FastAPI service
- **requirements.txt** — Python dependencies (fastapi, uvicorn, python-multipart, pydantic, gTTS, faster-whisper, python-dotenv). Add new backend packages here.
- **.env.example** — template of backend environment variables. Copy to `.env` to override defaults locally (never commit `.env`).
- **smoke_test.py** — standalone end-to-end sanity check (translation, spelling correction, pronunciation, TTS, an ASR round-trip, and the HTTP endpoints via FastAPI's TestClient). Run `python smoke_test.py` from `backend/`. Not imported by the running app.

### backend/app/
- **__init__.py** — marks `app` as a Python package (empty).
- **main.py** — the FastAPI entrypoint. Creates the app, mounts the API routes + centralized error handlers, configures CORS, serves pronunciation clips as static media, and defines `/health` and `/admin/reload`. This is what uvicorn runs (`app.main:app`).
- **config.py** — the `Settings` dataclass: data-file paths, feature flags, model sizes, the TTS voice language (`tts_voice_lang`, default `mr`), and CORS origins — all overridable via `WARLI_*` env vars. Also holds lazy singletons (`get_engine`, `get_asr`, `get_tts`, `get_pronunciation_layer`). **Most backend tuning happens here.**

### backend/app/api/
- **__init__.py** — package marker (empty).
- **routes.py** — the HTTP handlers: `POST /translate/text`, `POST /translate/speech` (audio upload with size/format validation), `GET /dictionary`, and `GET /media/pronunciation/{slug}`. A thin layer that calls the services and shapes responses. Add new endpoints here.
- **errors.py** — centralized exception handlers that turn domain errors (`TranslationError`, `ASRError`, `TTSError`) plus validation/HTTP errors into consistent JSON `{error, detail}` with proper status codes.

### backend/app/models/
- **__init__.py** — package marker (empty).
- **schemas.py** — Pydantic request/response models (`TranslateTextRequest`, `TranslateResponse`, `DictionaryEntry`, `HealthResponse`, `ErrorResponse`). These define and validate the API's JSON shapes; update them when you change an endpoint's input/output.

### backend/app/services/
- **__init__.py** — package marker (empty).
- **translation.py** — **the core.** `Dictionary` (greedy longest-phrase lookup + postpositions), `GrammarRules` (SOV reordering + coarse inflection), and `SpellingCorrector` (wrong→correct pairs), combined in `RuleBasedTranslator`. Everything sits behind the abstract `TranslationEngine` interface + `build_engine()` factory, so a trained model can replace the rule engine later without touching routes/frontend.
- **asr.py** — Whisper speech→text wrapper (`WhisperASR`, lazy-loaded; faster-whisper or openai-whisper). Returns text + detected language + segments. Disable with `WARLI_ASR_ENABLED=false`.
- **tts.py** — the `TTSProvider` interface, `GttsWarli` (synthesizes Warli Devanagari via a **Marathi** gTTS voice and flags the output as an approximation), and `NullTTS` (used when disabled/offline). Change the voice language via `WARLI_TTS_LANG`.
- **pronunciation.py** — **optional and fully decoupled.** `LexiconPronunciation` rewrites words to Devanagari respellings from `data/pronunciation_audio/lexicon.json` before TTS. If the lexicon is empty or `WARLI_PRONUNCIATION_ENABLED=false`, text passes through unchanged. Never required by the core pipeline.

### frontend/ — React + Vite SPA
- **index.html** — the SPA HTML shell (title, meta description, `#root` mount point; loads `/src/main.jsx`).
- **package.json** — npm scripts (`dev`, `build`, `preview`) and dependencies (react, react-dom; dev: vite, @vitejs/plugin-react). Add frontend packages here.
- **package-lock.json** — locked dependency versions for reproducible installs. Don't edit by hand.
- **vite.config.js** — Vite config: the React plugin + the dev proxy that forwards `/api` → `http://127.0.0.1:8000` (so no CORS is needed in dev). Change the dev backend target here.
- **vercel.json** — Vercel deploy config: static output `dist`, the SPA `404 → index.html` rewrite, and a `/api` proxy (used for local `vercel dev` preview).
- **.env.example / .env.production.example** — templates for `VITE_API_URL` (dev default `/api`; production = your Render origin). `VITE_API_URL` is baked into the bundle at build time.
- **.gitignore** — frontend-specific ignores (`dist`, `node_modules`, `.vercel`, logs).

### frontend/src/
- **main.jsx** — React entrypoint; mounts `<App/>` into `#root` and imports `index.css`.
- **App.jsx** — top-level shell; renders `<TranslatePage/>`.
- **index.css** — the entire design system: CSS variables (light + dark themes, terracotta accent), page layout (flexbox), the unified composer, buttons, segmented toggles, the result card, and the Warli-art styling. **Change colors/spacing/theme here.**
- **api/client.js** — the backend API client: resolves `API_URL` and exposes `getHealth()`, `translateText()`, and `translateSpeech()` (which converts returned base64 audio into an `audioUrl`). Uses `/api` in dev and `VITE_API_URL` in production.
- **pages/TranslatePage.jsx** — the main page and its state: the unified composer (textarea + mic/upload in one box), the From-language and Output-mode toggles, health/status polling, submit handling, error display, Warli-art placement, and result rendering. **Most UI changes start here.**
- **components/SegmentedToggle.jsx** — the small pill segmented control used for From-language and Output-mode.
- **components/Recorder.jsx** — speech input: mic recording (MediaRecorder → webm) and file upload, rendered as inline icon buttons; reports status/errors upward.
- **components/AudioPlayer.jsx** — a compact play/pause button that plays the returned Warli speech (drives a hidden `<audio>` element).
- **components/ResultPanel.jsx** — the result card: Warli text (Devanagari), romanization, source transcript, status chips (unmatched words, corrections, approximation), notices, and inline audio.
- **components/WarliArt.jsx** — the decorative Warli paintings, drawn as **inline SVG** (no image files): `WarliBackdrop` (faint page watermark), `WarliBorder` (triangle strip under the header), `WarliDivider` (dancers + sun), and `WarliMural` (a terracotta village scene: dancers, tree, sun/moon, birds, deer, hut). **Edit motifs/scene here.**

### data/ — runtime assets (replace the seed data with real research)
- **warli_dictionary/warli_dictionary.json** — English/Hindi → Warli entries (`warli_devanagari`, `warli_roman`, `source_tokens`, `part_of_speech`). The main lexicon (~2,100 seed entries). Add words here.
- **warli_dictionary/grammar_rules.json** — Warli word order (SOV), the postposition map, and inflection/aspect/plural cues. Edit translation grammar here.
- **warli_dictionary/README.md** — schema + conversion steps for the dictionary and rules.
- **voice_recording/corrections.json** — wrong→correct Warli spelling pairs (`corrections[]`) learned from annotated recordings; applied by the spelling corrector.
- **voice_recording/README.md** — how to annotate recordings and fill in `corrections.json`.
- **pronunciation_audio/lexicon.json** — optional `word → Devanagari respelling` map (plus a `_meta` block of documented sound patterns) used by the pronunciation layer to improve the TTS approximation.
- **pronunciation_audio/transcriptions.csv** — transcribed audio segments (`segment_id, source_url, start_s, end_s, warli_devanagari, roman, english, notes`).
- **pronunciation_audio/sources.md** — citations/credits for the pronunciation research (books, the PLSI Warli chapter, and the sound patterns applied).
- **pronunciation_audio/README.md** — the pronunciation workflow (collect → clip → transcribe → respell → credit).
- **pronunciation_audio/clips/.gitkeep** — placeholder that keeps the otherwise-empty `clips/` folder in Git (drop short audio segments here).
- **research_papers/README.md** — where to drop reference PDFs (lipi/pronunciation) that inform the dictionary and rules.

---

## Where to make common changes

| I want to… | Edit this file |
|---|---|
| Add or fix a translated word | `data/warli_dictionary/warli_dictionary.json` (then `POST /admin/reload` or restart) |
| Change word order / grammar | `data/warli_dictionary/grammar_rules.json` |
| Fix Warli spellings | `data/voice_recording/corrections.json` |
| Improve a word's spoken pronunciation | `data/pronunciation_audio/lexicon.json` (add `word → respelling`) |
| Change the TTS voice language | `backend/app/config.py` (`tts_voice_lang`) **and** `render.yaml` (`WARLI_TTS_LANG`) |
| Swap the rule engine for a trained model | add a `TranslationEngine` subclass in `backend/app/services/translation.py` + register it in `build_engine()` |
| Add a backend endpoint | `backend/app/api/routes.py` (+ its schema in `backend/app/models/schemas.py`) |
| Change colors / theme / spacing | `frontend/src/index.css` (CSS variables at `:root` and the dark-theme block) |
| Change the Warli paintings | `frontend/src/components/WarliArt.jsx` |
| Change the page layout / composer | `frontend/src/pages/TranslatePage.jsx` |
| Point the frontend at another backend | dev: `frontend/vite.config.js` proxy · prod: `VITE_API_URL` |
| Add a Python / npm dependency | `backend/requirements.txt` · `frontend/package.json` |
| Change backend / frontend hosting | `render.yaml` · `frontend/vercel.json` |

> After editing any `data/*.json` **no code change is needed** — restart the backend
> or call `POST /admin/reload` to pick it up.

---

## Run locally

You need **both** servers running, or the UI shows "Backend not reachable."

### 1. Backend (FastAPI)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1          # Windows PowerShell (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
uvicorn app.main:app --reload         # http://127.0.0.1:8000   (interactive docs at /docs)
```

> **Python version:** 3.11–3.13 is the sweet spot. On a very new interpreter
> (e.g. 3.14) some native wheels (`pydantic-core`, `faster-whisper`) may not exist
> yet and pip will try to compile from source — if that fails, use Python 3.12.

### 2. Frontend (React + Vite)

```powershell
cd frontend
npm install
npm run dev                           # http://localhost:5173
```

The dev server proxies `/api` → `http://127.0.0.1:8000`, so no CORS setup is needed
in development.

### Quick checks

```powershell
curl http://127.0.0.1:8000/health      # status + data counts
cd backend; python smoke_test.py       # full end-to-end suite (ASR/TTS need internet)
```

---

## Environment variables (backend)

All optional; the defaults live in `backend/app/config.py`. Set them in `backend/.env`
(copy from `.env.example`) or in your host's dashboard.

| Variable | Default | Purpose |
|---|---|---|
| `WARLI_ASR_ENABLED` | `true` | Turn off Whisper (text mode still works) |
| `WARLI_ASR_BACKEND` | `faster-whisper` | or `openai-whisper` |
| `WARLI_ASR_MODEL` | `small` | Whisper model size (`tiny`/`base`/`small`/…) |
| `WARLI_TRANSLATION_ENGINE` | `rule` | engine selector (see "swap the engine") |
| `WARLI_TTS_ENABLED` | `true` | Turn off speech output (gTTS needs internet) |
| `WARLI_TTS_LANG` | `mr` | Voice for the approximation: `mr` (Marathi — default, Warli is Marathi-family) or `hi` (Hindi) |
| `WARLI_PRONUNCIATION_ENABLED` | `true` | Enable/disable the optional pronunciation-respelling layer |
| `WARLI_DATA_DIR` | `<repo>/data` | Override where data files are read from |
| `WARLI_CORS_ORIGINS` | localhost dev URLs | Comma-separated allowed browser origins |

Frontend: **`VITE_API_URL`** (dev default `/api`; production = your backend origin, no trailing slash).

Run text-only with no ML/network dependencies at all:

```powershell
$env:WARLI_ASR_ENABLED="false"; $env:WARLI_TTS_ENABLED="false"; uvicorn app.main:app --reload
```

---

## API endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/translate/text` | `{text, source_lang, output_mode}` → Warli text (+ base64 audio if `speech`) |
| `POST` | `/translate/speech` | multipart `audio` file + `source_lang` + `output_mode` → Warli text (+ audio) |
| `GET` | `/dictionary` | admin/debug lookup; `?q=`, `?source_lang=`, `?limit=` |
| `GET` | `/health` | status + data counts (dictionary / corrections / pronunciation) |
| `POST` | `/admin/reload` | re-read all data files from disk without restarting |
| `GET` | `/media/pronunciation/{slug}` | serve a pronunciation clip (if present) |

Errors always return `{ "error": "<code>", "detail": "<message>" }` with a proper HTTP
status (e.g. `415` unsupported audio format, `413` too large, `422` validation,
`400` no speech detected).

---

## Deployment (Vercel frontend + Render backend)

The frontend is static (Vercel); the backend needs a persistent server for Whisper +
gTTS (Render). Config is already in the repo: `render.yaml` and `frontend/vercel.json`.

**Backend → Render.** Push the repo, then Render → **New +** → **Blueprint** (it reads
`render.yaml` and creates the `warli-backend` service). Set `WARLI_CORS_ORIGINS` to
your Vercel origin (comma-separated; include `*.vercel.app` and any custom domain),
then verify `https://<service>.onrender.com/health`.
> Free tier spins down when idle and the disk is ephemeral, so the first request after
> a cold start re-downloads the Whisper model. Mitigate with `WARLI_ASR_MODEL=base`/`tiny`
> or `WARLI_ASR_ENABLED=false` for text-only.

**Frontend → Vercel.** Import the same repo, set **Root Directory** = `frontend`, add
`VITE_API_URL` = your Render URL (no trailing slash), and deploy. `VITE_API_URL` is
baked in at build time — redeploy after changing it.

**Post-deploy checklist.** `/health` returns `status: ok`; the app's status strip shows
live dictionary counts (confirms CORS + API URL are correct). If it says "Backend not
reachable," check `VITE_API_URL` and `WARLI_CORS_ORIGINS`.

**Updating data after deploy.** Edit the JSON under `data/`, commit, and push — Render
auto-redeploys (`autoDeploy: true`), or call `POST /admin/reload` for a no-restart refresh.

---

## Improving accuracy over time

- **Translation quality** scales with the dictionary + rules: expand `data/warli_dictionary/*.json` with real researched entries.
- **Pronunciation** scales with transcribed Warli audio: collect public/consented audio → clip into `data/pronunciation_audio/clips/` → transcribe in `transcriptions.csv` → add respellings to `lexicon.json` → credit every source in `sources.md`. Full workflow in `data/pronunciation_audio/README.md`.
- **Advanced path:** with enough transcribed audio, fine-tune a small open-source TTS/ASR model and wire it in via config — it exposes the same interfaces, so it stays decoupled from translation.
- **Legal/ethics:** use only publicly available content or recordings made with explicit community consent, and list every source in `sources.md`.

---

## Known limitations

- Warli **speech output is an approximation** (a Marathi gTTS voice reading Devanagari), not a real Warli voice.
- The rule engine's grammar coverage is coarse; quality depends entirely on the dictionary + rules supplied.
- Whisper downloads its model on first use; gTTS needs internet access.
- Seed data in `data/` is example content — replace it with the team's researched dictionary before any real evaluation.
- Several `lexicon.json` respellings are pattern-derived and marked `"needs field validation"` — confirm them with native speakers.
