# Linguify — Translator + Learning App (Warli & Santali)

Two apps, one server, one origin:

1. **Translator** — type or speak **English / Hindi / Marathi**, get **Warli**
   (Varli, Devanagari) text, with optional spoken output — or get **Santali**
   (Ol Chiki, Jharkhand) text via the seed pack (text only, no voice yet).
2. **Learning app** — a gamified course starting with **Santali first**
   (Ol Chiki script → tiny words → everyday talk, then 15 Warli lessons:
   23 lessons in 8 units, 123 exercises, trilingual EN/HI/MR instruction),
   learner **accounts** with cloud
   progress sync, a searchable **wordbook** over
   the full dictionaries with tap-to-hear pronunciation, and a
   **teacher dashboard** with class analytics.

A single Docker image (root `Dockerfile`) builds the React
app and runs the FastAPI backend, which serves the JSON API under `/api` **and** the UI
at `/`. There is no separate frontend host and no cross-origin CORS hop.

Two output modes:

1. **Text → Warli Text** — type English/Hindi/Marathi, get the Warli text.
2. **Speech / Text → Warli Text + Audio** — the same, plus the Warli translation spoken aloud.

> **Honesty note.** Warli is **not** recognized directly from audio (no large Warli
> speech corpus exists) and there is **no true Warli TTS model**. The pipeline is
> `ASR (English/Hindi/Marathi) → rule-based translation → optional TTS`, where the Warli
> **speech output is an approximation**: a **Marathi** gTTS voice (preferred over Hindi,
> because Warli is Marathi-family) reading Devanagari Warli text, optionally nudged by a
> pronunciation-respelling lexicon. This is flagged in code, in API responses, and in the UI.

---

## Pipeline

```
User speaks / types (English / Hindi / Marathi)
        ↓  ASR  (Whisper — pretrained; supports en/hi/mr)          [speech input only]
Source-language text
        ↓  Translation engine (dictionary lookup + grammar rules + spelling correction)
Warli text (Devanagari)
        ↓  (optional) pronunciation respelling  →  Marathi gTTS voice   [APPROXIMATION]
Warli speech audio
```

The translation "model" is deliberately **not a pure neural net**. It is a data-driven
**lookup + rule engine** with spelling correction, plus a **frozen multilingual
embedding layer** that rescues near-misses by meaning ("infant" → "child") and a
stdlib spelling fallback ("watre" → "water") — no training, no corpus needed.
Every fuzzy hit is flagged in response warnings, never silent. The engine sits
behind a clean interface so it can later be swapped for a trained seq2seq model
without touching the routes or the frontend.

> **Marathi input.** Warli is a Marathi-family dialect, so the dictionary also indexes
> each Warli headword as a Marathi key: a spoken Marathi word that matches shared core
> vocabulary resolves directly, the Marathi copula/tense auxiliaries are dropped, and
> Marathi postpositions map to Warli. Unmatched inflected forms pass through as readable
> Devanagari.

---

## Project structure

```
warliiii/
├── README.md                     ← this file (full guide)
├── Dockerfile                    ← ONE image: builds the frontend + runs the backend (API + UI)
├── .dockerignore                 ← keeps the Docker build context small
├── render.yaml                   ← Render blueprint (Docker runtime, single service)
├── .gitignore / .gitattributes   ← Git hygiene
│
├── backend/                      ← FastAPI (Python) service
│   ├── requirements.txt
│   ├── .env.example
│   ├── smoke_test.py
│   └── app/
│       ├── __init__.py
│       ├── main.py               # entrypoint: mounts /api routes AND serves frontend/dist at /
│       ├── config.py             # settings + feature flags + paths (incl. api_prefix, frontend_dist)
│       ├── api/       (__init__.py, routes.py, learning_routes.py, auth_routes.py, errors.py)
│       ├── models/    (__init__.py, schemas.py, learning_schemas.py, auth_schemas.py)
│       └── services/  (__init__.py, asr.py, translation.py, tts.py, pronunciation.py, learning_service.py, auth_service.py)
│
├── frontend/                     ← React + Vite SPA (built into dist/, then served by FastAPI)
│   ├── index.html
│   ├── package.json / package-lock.json
│   ├── vite.config.js
│   ├── .env.example / .gitignore
│   └── src/
│       ├── main.jsx              # React entrypoint + routes (/, /lesson/:id, /words, /teacher, /translate)
│       ├── index.css             # the entire design system / theming (+ Tailwind)
│       ├── api/        (client.js, learning.js)
│       ├── context/    (AuthContext.jsx — session; ProgressContext.jsx — stars/streak/hearts/language + cloud sync)
│       ├── components/ (Recorder, ResultPanel [incl. the audio player], WarliArt)
│       ├── components/learn/ (LearningMap, LessonNode, ExerciseCard, MultipleChoice,
│       │                      MatchPairs, ListenType, AnswerCard [Guru Card], MascotHint,
│       │                      ProgressBar, HeartIndicator, XpBurst, LanguageSwitcher)
│       ├── components/layout/ (Navbar, GameHeader)
│       └── pages/      (LearnPage, LessonPlayer, WordsPage, LoginPage, TeacherDashboard, TranslatePage)
│
└── data/                         ← runtime data assets (read from disk; nothing hardcoded)
    ├── warli_dictionary/    (warli_dictionary.json, grammar_rules.json, README.md)
    ├── voice_recording/     (corrections.json, README.md)
    ├── pronunciation_audio/ (lexicon.json, transcriptions.csv, sources.md, README.md, clips/)
    ├── pedagogy/            (curriculum.json, mock_classroom.json, lessons/lesson_001…015.json)
    └── research_papers/     (README.md — drop reference PDFs here)
```

> All dictionary / correction / pronunciation data lives in `data/` and is read at
> runtime. The current content is clearly-labeled **seed/example** data (~2,203
> dictionary entries) so the app runs immediately; replace it with the team's real
> researched assets.

---

## What each file does

### Root
- **Dockerfile** — multi-stage build: stage 1 (`node:20-alpine`) builds the React app into `dist/`; stage 2 (`python:3.12-slim`) installs the backend deps, copies `backend/` + `data/` + the built `dist/`, **pre-downloads the Whisper `tiny` model into the image** (so cold starts don't re-fetch it), and runs uvicorn serving both API and UI.
- **.dockerignore** — excludes `node_modules`, local `dist`, `.venv`, caches, `.git`, `.qoder` and Vercel leftovers from the build context.
- **render.yaml** — Render "blueprint": one `docker` web service, `/api/health` check, and the `WARLI_*` env vars (note `WARLI_TTS_LANG: mr`). Edit to change hosting.
- **.gitignore / .gitattributes** — Git hygiene (ignores generated/local files; normalizes line endings).

### backend/ — FastAPI service
- **requirements.txt** — Python dependencies (fastapi, uvicorn, python-multipart, pydantic, gTTS, faster-whisper, python-dotenv).
- **.env.example** — template of backend environment variables (copy to `.env` to override defaults locally; never commit `.env`).
- **smoke_test.py** — standalone end-to-end sanity check (translation, correction, pronunciation, TTS, an ASR round-trip, and the `/api/*` HTTP endpoints via FastAPI's TestClient). Run `python smoke_test.py` from `backend/`.

### backend/app/
- **main.py** — the FastAPI entrypoint. Registers the API router under `settings.api_prefix` (default `/api`) + centralized error handlers + CORS, then **mounts the built frontend (`frontend/dist`) at `/`** when present (single-server). Falls back to a JSON landing page when there is no build (typical dev).
- **config.py** — the `Settings` dataclass: data-file paths, feature flags, model sizes, the TTS voice language (`tts_voice_lang`, default `mr`), `api_prefix`, `frontend_dist`, and CORS origins — all overridable via `WARLI_*` env vars. **Most backend tuning happens here.**

### backend/app/api/
- **routes.py** — the HTTP handlers: `POST /api/translate/text`, `POST /api/translate/speech` (audio upload with size/format validation), `GET /api/dictionary`, `GET /api/health`, `POST /api/admin/reload`. A thin layer that calls the services and shapes responses.
- **errors.py** — centralized exception handlers that turn domain + validation/HTTP errors into consistent JSON `{error, detail}` with proper status codes.

### backend/app/models/
- **schemas.py** — Pydantic request/response models. `SourceLanguage` supports `en | hi | mr | auto`; `OutputMode` is `text | speech`.

### backend/app/services/
- **translation.py** — **the core.** `Dictionary` (greedy longest-phrase lookup + postpositions; indexes `en`, `hi`, and a `mr` map derived from the Warli headwords), `GrammarRules` (SOV reordering + coarse inflection, per-language cues), and `SpellingCorrector`, combined in `RuleBasedTranslator` behind the abstract `TranslationEngine` interface + `build_engine()` factory.
- **asr.py** — Whisper speech→text wrapper (`WhisperASR`, lazy-loaded; faster-whisper or openai-whisper). The chosen source language (`en`/`hi`/`mr`) is forwarded straight to Whisper. Disable with `WARLI_ASR_ENABLED=false`.
- **tts.py** — the `GttsWarli` provider (synthesizes Warli Devanagari via a **Marathi** gTTS voice and flags the output as an approximation). Change the voice via `WARLI_TTS_LANG`.
- **pronunciation.py** — **optional and fully decoupled.** `LexiconPronunciation` rewrites words to Devanagari respellings from `data/pronunciation_audio/lexicon.json` before TTS. If empty/disabled, text passes through unchanged.

### frontend/ — React + Vite SPA
- **index.html** — the SPA HTML shell (title, meta, `#root`; loads `/src/main.jsx`).
- **package.json / package-lock.json** — npm scripts (`dev`, `build`, `preview`) + locked deps.
- **vite.config.js** — the React plugin + the dev proxy that forwards `/api` → `http://127.0.0.1:8000` (no rewrite, since the backend already lives under `/api`).
- **.env.example** — documents the optional `VITE_API_URL` (defaults to relative `/api`; only override to host the API elsewhere).

### frontend/src/
- **main.jsx** — React entrypoint; mounts `<TranslatePage/>` into `#root` and imports `index.css`.
- **index.css** — the entire design system: CSS variables (light + dark themes, terracotta accent), layout, composer, buttons, segmented toggles, result card, and Warli-art styling. **Change colors/spacing/theme here.**
- **api/client.js** — the backend API client: `getHealth()`, `translateText()`, `translateSpeech()`, and base64→object-URL audio conversion. Uses the relative `/api` base in dev and production.
- **pages/TranslatePage.jsx** — the main page + state: the unified composer (textarea + mic/upload), the From-language (English/Hindi/Marathi/Auto) and Output-mode toggles (the segmented control lives inline here), health/status, submit handling, errors, Warli-art placement, and result rendering. **Most UI changes start here.**
- **components/Recorder.jsx** — speech input: mic recording (MediaRecorder → webm) and file upload, as inline icon buttons; reports status/errors upward.
- **components/ResultPanel.jsx** — the result card: Warli text (Devanagari), romanization, source transcript, status chips, notices, and the inline audio player (the play/pause control lives inline here).
- **components/WarliArt.jsx** — the decorative Warli paintings as **inline SVG** (no image files): `WarliBackdrop`, `WarliBorder`, `WarliDivider`, `WarliMural`. **Edit motifs/scene here.**

### data/ — runtime assets (replace the seed data with real research)
- **warli_dictionary/warli_dictionary.json** — English/Hindi → Warli entries (`warli`, `roman`, `en`, `hi`, `pos`, optional `example`/`tags`). The main lexicon (~2,203 seed entries). Add words here.
- **warli_dictionary/grammar_rules.json** — Warli word order (SOV), the postposition map, function words, and inflection/aspect cues for `en`/`hi`/`mr`. Edit translation grammar here.
- **voice_recording/corrections.json** — wrong→correct Warli spelling pairs learned from annotated recordings; applied by the spelling corrector.
- **pronunciation_audio/lexicon.json** — optional `word → Devanagari respelling` map used by the pronunciation layer to improve the TTS approximation.
- **pronunciation_audio/transcriptions.csv** / **sources.md** — transcribed audio segments + citations/credits.
- **research_papers/README.md** — where to drop reference PDFs that inform the dictionary and rules.

---

## Where to make common changes

| I want to… | Edit this file |
|---|---|
| Add or fix a translated word | `data/warli_dictionary/warli_dictionary.json` (then `POST /api/admin/reload` or redeploy) |
| Change word order / grammar | `data/warli_dictionary/grammar_rules.json` |
| Fix Warli spellings | `data/voice_recording/corrections.json` |
| Improve a word's spoken pronunciation | `data/pronunciation_audio/lexicon.json` |
| Change the TTS voice language | `backend/app/config.py` (`tts_voice_lang`) **and** `render.yaml` (`WARLI_TTS_LANG`) |
| Change the API prefix / where the UI is served from | `backend/app/config.py` (`api_prefix`, `frontend_dist`) |
| Swap the rule engine for a trained model | add a `TranslationEngine` subclass in `backend/app/services/translation.py` + register it in `build_engine()` |
| Add a backend endpoint | `backend/app/api/routes.py` (+ its schema in `backend/app/models/schemas.py`) |
| Change colors / theme / spacing | `frontend/src/index.css` |
| Change the Warli paintings | `frontend/src/components/WarliArt.jsx` |
| Change the page layout / composer / languages | `frontend/src/pages/TranslatePage.jsx` |
| Add a Python / npm dependency | `backend/requirements.txt` · `frontend/package.json` |
| Change hosting | `Dockerfile` · `render.yaml` |

> After editing any `data/*.json` **no code change is needed** — call `POST /api/admin/reload`
> on a running instance, or commit + push to redeploy.

---

## Run locally

You need **Python 3.11–3.13** (3.12 is the sweet spot) and **Node 20+**. On a very new
interpreter (e.g. 3.14) some native wheels (`pydantic-core`, `faster-whisper`) may not
exist yet and pip will try to compile from source — if that fails, use Python 3.12.

### Option A — single server (production-like)

```powershell
# 1. Build the frontend once
cd frontend ; npm install ; npm run build ; cd ..

# 2. Run the backend — it serves the built UI at / and the API at /api
cd backend
python -m venv .venv ; .\.venv\Scripts\Activate.ps1   # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
# open http://127.0.0.1:8000   (UI + API on one origin; docs at /docs)
```

### Option B — dev with hot reload (two processes)

```powershell
# terminal 1: backend
cd backend ; uvicorn app.main:app --reload            # http://127.0.0.1:8000/api

# terminal 2: frontend (Vite proxies /api -> backend, so no CORS needed)
cd frontend ; npm install ; npm run dev                # http://localhost:5173
```

### Option C — Docker (exactly what deploys)

```powershell
docker build -t warli .
docker run --rm -p 8000:8000 warli                     # http://localhost:8000
```

### Quick checks

```powershell
curl http://127.0.0.1:8000/api/health   # status + data counts
cd backend ; python smoke_test.py        # full end-to-end suite (ASR/TTS need internet)
```

---

## Environment variables (backend)

All optional; the defaults live in `backend/app/config.py`. Set them in `backend/.env`
(copy from `.env.example`) or in your host's dashboard.

| Variable | Default | Purpose |
|---|---|---|
| `WARLI_ASR_ENABLED` | `true` | Turn off Whisper (text mode still works) |
| `WARLI_ASR_BACKEND` | `faster-whisper` | or `openai-whisper` |
| `WARLI_ASR_MODEL` | `small` | Whisper model size (`tiny`/`base`/`small`/…); Render uses `tiny` |
| `WARLI_TRANSLATION_ENGINE` | `rule` | engine selector (see "swap the engine") |
| `WARLI_TTS_ENABLED` | `true` | Turn off speech output (gTTS needs internet) |
| `WARLI_TTS_LANG` | `mr` | Voice for the approximation: `mr` (Marathi — default) or `hi` (Hindi) |
| `WARLI_PRONUNCIATION_ENABLED` | `true` | Enable/disable the optional pronunciation-respelling layer |
| `WARLI_DATA_DIR` | `<repo>/data` | Override where data files are read from |
| `WARLI_API_PREFIX` | `/api` | Prefix for all JSON routes (the UI is served at `/`) |
| `WARLI_FRONTEND_DIST` | `<repo>/frontend/dist` | Where the built React app is served from |
| `WARLI_CORS_ORIGINS` | localhost dev URLs | Comma-separated allowed browser origins (not needed same-origin) |

Frontend: **`VITE_API_URL`** defaults to the relative `/api` and normally needs no change.

Run text-only with no ML/network dependencies at all:

```powershell
$env:WARLI_ASR_ENABLED="false"; $env:WARLI_TTS_ENABLED="false"; uvicorn app.main:app --reload
```

---

## API endpoints

The UI is served at `GET /`; every JSON endpoint lives under `/api`.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/translate/text` | `{text, source_lang, output_mode, target_lang}` → target text (+ base64 audio if `speech` + Warli) |
| `POST` | `/api/translate/speech` | multipart `audio` file + `source_lang` + `output_mode` + `target_lang` → target text (+ audio if Warli) |
| `GET` | `/api/dictionary` | admin/debug lookup; `?q=`, `?source_lang=`, `?target_lang=warli\|santali`, `?limit=` |
| `GET` | `/api/health` | status + data counts (dictionary / corrections / pronunciation) |
| `POST` | `/api/admin/reload` | re-read all data files from disk without restarting |

`source_lang` accepts `en`, `hi`, `mr`, or `auto`. Errors always return
`{ "error": "<code>", "detail": "<message>" }` with a proper HTTP status (e.g. `415`
unsupported audio format, `413` too large, `422` validation, `400` no speech detected).

### Learning endpoints (`/api/learning/*`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/learning/path` | full curriculum (4 units, 12 lessons) with inlined summaries |
| `GET` | `/api/learning/lesson/{id}` | one lesson with all exercises (incl. trilingual prompts + tips) |
| `POST` | `/api/learning/hint` | `{prompt_en, correct_answer, source_lang}` → child-friendly hint (never 5xx) |
| `GET` | `/api/learning/pronounce?word=` | single Warli word → base64 MP3 (same approximation notice as TTS) |
| `GET` | `/api/learning/classroom` | mock classroom data + avg XP for the teacher dashboard |
| `POST` | `/api/auth/signup` | `{username, password, display_name?}` → `{token, user}` (201; 400 if taken) |
| `POST` | `/api/auth/login` | `{username, password}` → `{token, user}` (401 if wrong) |
| `POST` | `/api/auth/logout` | invalidate the bearer token |
| `GET` | `/api/auth/me` | current account + synced progress (bearer) |
| `GET/POST` | `/api/auth/progress` | fetch / save `{xp, streak, hearts, completed_lessons, uiLang, lastPlayedDate}` (bearer) |
| `GET` | `/api/auth/students` | public learner roster + progress for the teacher dashboard |

---

## Learning app (Warli Seekho)

The course lives in `data/pedagogy/`: `curriculum.json` (units → lesson IDs) plus one
file per lesson under `lessons/`. v6 ships **23 lessons in 8 units, 123 exercises**,
**Santali first**:

| Unit | Lessons |
|---|---|
| Ol Chiki Script | Meet the Vowels · First/More/Last Consonants |
| Tiny Words | Two-Letter · Three-Letter Words |
| Everyday Santali | Johar! First Words · Around Me |
| First Words | Greetings · Numbers 1-5 · You & Me |
| The World Around Us | Body Parts · Animals · Nature |
| Daily Life | Colours · Food & Water · Family |
| Speak Warli | Actions · First Sentences · Daily Phrases |
| Village Life | Time & Days · Work & Farm · Celebration |

Every lesson carries **trilingual instruction** (`prompt_en` / `prompt_hi` / `prompt_mr`,
switchable in the navbar, persisted in localStorage), and sentence lessons carry
**grammar tips** (`tip_en/hi/mr`, e.g. the SOV verb-last rule). Exercise types:
`multiple_choice` (listen-and-choose with auto-playing audio, or letter naming
with a giant display letter), `match_pairs` (tap-to-match, English side shows
picture emoji for pre-literate kids), `listen_type`
(listen-and-type), and `teach` (intro cards that teach first — alphabet grids,
joining rules — advancing free via "Got it"). Santali typing uses the built-in
Ol Chiki on-screen keyboard, since no system keyboard ships it.

Run a classroom pilot with `PILOT.md` (weekend protocol, 10 kids, pre/post sheets)
to produce honest learning-gain numbers for the deck. Answers open an original
Warli-framed **Guru Card** with the correct word, Next / Try-again actions, and an
exit (✕) back to the map — a wrong answer can never strand the learner.

Beyond lessons: **`/words`** is a searchable wordbook over the entire 2,203-word
Warli dictionary (tap 🔊 to hear any word) **plus the 744-word Santali pack**
(text only), and **`/teacher`** is a classroom dashboard
(KPIs, score chart, struggle areas, student table) fed by `mock_classroom.json`.
Progress (stars, streak, hearts, completed lessons, language) persists in
localStorage; hearts/streak roll over daily.

### Santali pack (Jharkhand)

The engine supports two target languages via `target_lang` (`warli` default,
`santali`). The Santali seed pack (`data/santali_dictionary/`, 744 entries in Ol
Chiki script + a grammar stub) is merged from CC-BY-SA open sources — see
`santali_dictionary/SOURCES.md` for credits. The course opens with a Santali
unit (Johar! — lessons 016–017); hints and audio follow each exercise's
`target_lang`. **Santali voice**: Ol Chiki is transliterated to Devanagari
(`services/transliterate.py`, verified against the official UDHR Santali text)
and read by the Marathi voice — a flagged double approximation, since no
Santali voice model exists. The course lessons beyond the Santali unit remain
Warli; adding a Santali course unit = new `lessons/*.json` files, no code
changes — the same pattern that will carry Mundari/Ho next.

### Learner accounts (progress tracking)

Learners can **sign up / log in** (`/login`) with a username + password. While logged
in, the app pulls the account record on login (keeping whichever side learned more)
and pushes every change (debounced); the header dot shows grey (device-only), amber
(syncing), green (synced) or red (failed, retries automatically). Teachers see every
registered learner's stars, streak, lessons completed and last-active date in the
**Registered learners (live)** panel on `/teacher`.

Auth is deliberately **demo-grade**: salted pbkdf2 hashes + opaque bearer tokens in
`data/users.json` (gitignored, never committed). Two honest limits for the report:
(1) no rate-limiting/email recovery — swap in a real user DB for production; (2) on
free-tier hosts **without a persistent disk, `users.json` resets on redeploy** — mount
a disk at the data dir (or set `WARLI_USERS_FILE`) for real classes.

To add a lesson: drop `lessons/lesson_016.json` (same schema), list it in
`curriculum.json`, then `POST /api/admin/reload` — no code change, no restart.

---

## Deployment (one Docker service)

The whole app ships as **ONE Docker image** (root `Dockerfile`): it builds the React
frontend and runs FastAPI, which serves the API under `/api` and the UI at `/`. Deploy it
to any container host — `render.yaml` wires it up for Render.

1. **Push** the repo to GitHub.
2. **Render → New + → Blueprint →** select the repo (it reads `render.yaml` and builds the Dockerfile).
   - If you already have the old native-Python `warli-backend` service, the blueprint sync
     switches it to the Docker runtime; `https://warli-backend.onrender.com` then serves the
     **full app** (UI + API).
3. **Open** `https://warli-backend.onrender.com` — the UI loads and the status strip shows
   live dictionary counts. `…/api/health` returns `status: ok`.

**Why this is faster than the old split (Vercel frontend + Render backend):**
- **One origin** — no browser→Vercel→Render round-trip and no CORS preflight on every call.
- **Model pre-baked** — the Whisper `tiny` model is downloaded into the image at build time
  (see `Dockerfile`), so a cold start no longer re-fetches it. This was the biggest latency source.
- Free tier still spins down when idle, so the first request after spin-down pays the container
  boot cost. To remove cold starts entirely, upgrade the instance or add a persistent disk /
  keep-warm ping.

**Updating data after deploy.** Edit the JSON under `data/`, commit, and push — Render rebuilds
(`autoDeploy: true`). For a no-rebuild refresh on a running instance, call `POST /api/admin/reload`.

---

## Improving accuracy over time

- **Translation quality** scales with the dictionary + rules: expand `data/warli_dictionary/*.json` with real researched entries (the loader is dedup-safe on English headwords).
- **Pronunciation** scales with transcribed Warli audio: collect public/consented audio → clip into `data/pronunciation_audio/clips/` → transcribe in `transcriptions.csv` → add respellings to `lexicon.json` → credit every source in `sources.md`.
- **Advanced path:** with enough transcribed audio, fine-tune a small open-source TTS/ASR model and wire it in via config — it exposes the same interfaces, so it stays decoupled from translation.
- **Legal/ethics:** use only publicly available content or recordings made with explicit community consent, and list every source in `sources.md`.

---

## Known limitations

- Warli **speech output is an approximation** (a Marathi gTTS voice reading Devanagari), not a real Warli voice.
- The rule engine's grammar coverage is coarse; quality depends entirely on the dictionary + rules supplied.
- **Marathi input** relies on Warli↔Marathi shared vocabulary (identity lookup) + function-word/postposition rules; heavily inflected Marathi verb forms may pass through unchanged (still readable Devanagari). English inflections (e.g. "needs" vs "need") likewise depend on dictionary coverage.
- Whisper downloads its model on first use if it was not pre-baked; gTTS needs internet access.
- Seed data in `data/` is example content — replace it with the team's researched dictionary before any real evaluation.
- Several `lexicon.json` respellings are pattern-derived and marked `"needs field validation"` — confirm them with native speakers.
