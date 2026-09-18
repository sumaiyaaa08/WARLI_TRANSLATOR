// API client for the Warli learning (pedagogy) endpoints.
// Mirrors the fetch + handle() pattern from client.js but does NOT import it.
// BASE_URL is resolved the same way: VITE_API_URL env var or the relative '/api'.

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

// ── Helpers ──────────────────────────────────────────────────────────────────

function joinUrl(path) {
  return `${BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}

async function handle(res) {
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`
    try {
      const body = await res.json()
      detail = body.detail || body.error || detail
    } catch {
      /* non-JSON error body; keep the status text */
    }
    throw new Error(detail)
  }
  return res.json()
}

/**
 * Convert a base64-encoded audio string to a playable object URL.
 * The caller is responsible for revoking the URL when done (URL.revokeObjectURL).
 */
export function base64ToAudioUrl(b64, mime = 'audio/mpeg') {
  const bytes = atob(b64)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i += 1) arr[i] = bytes.charCodeAt(i)
  const blob = new Blob([arr], { type: mime })
  return URL.createObjectURL(blob)
}

// ── Audio cache ───────────────────────────────────────────────────────────────
// Keyed by Warli word; stores the raw API response object so each word is
// synthesised at most once per browser session.

const audioCache = new Map()

// ── API functions ─────────────────────────────────────────────────────────────

/**
 * GET /api/learning/path
 * Returns the full curriculum (LearningPathResponse) with inlined lesson summaries.
 */
export async function getLearningPath() {
  const res = await fetch(joinUrl('/learning/path'))
  return handle(res)
}

/**
 * GET /api/learning/lesson/{lessonId}
 * Returns LessonDetail (with exercises). Throws on 404 / other errors.
 */
export async function getLesson(lessonId) {
  const res = await fetch(joinUrl(`/learning/lesson/${encodeURIComponent(lessonId)}`))
  return handle(res)
}

/**
 * POST /api/learning/hint
 * Body: { prompt_en, correct_answer, source_lang }
 * Returns HintResponse with child-friendly hint text.
 */
export async function getHint({ promptEn, correctAnswer, sourceLang = 'en', targetLang = 'warli' }) {
  const res = await fetch(joinUrl('/learning/hint'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt_en: promptEn, correct_answer: correctAnswer, source_lang: sourceLang, target_lang: targetLang }),
  })
  return handle(res)
}

/**
 * GET /api/learning/pronounce?word={word}
 * Returns PronounceResponse (audio_base64, audio_mime, word, approximation).
 * Responses are cached in `audioCache` for the duration of the browser session
 * to avoid redundant network calls for the same word.
 */
export async function getPronounce(word) {
  if (audioCache.has(word)) {
    return audioCache.get(word)
  }
  const res = await fetch(joinUrl(`/learning/pronounce?word=${encodeURIComponent(word)}`))
  const result = await handle(res)
  audioCache.set(word, result)
  return result
}

/**
 * GET /api/learning/classroom
 * Returns ClassroomResponse (students, lesson_stats, avg_class_xp).
 */
export async function getClassroom() {
  const res = await fetch(joinUrl('/learning/classroom'))
  return handle(res)
}

// ── Accounts + progress sync ────────────────────────────────────────────────

function authHeaders(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

/**
 * GET /api/auth/progress — fetch the account's synced progress.
 */
export async function getServerProgress(token) {
  const res = await fetch(joinUrl('/auth/progress'), { headers: { Authorization: `Bearer ${token}` } })
  return handle(res)
}

/**
 * POST /api/auth/progress — save progress to the account.
 */
export async function saveServerProgress(token, payload) {
  const res = await fetch(joinUrl('/auth/progress'), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handle(res)
}

/**
 * GET /api/auth/students — public roster of registered learners (teacher view).
 */
export async function getStudents() {
  const res = await fetch(joinUrl('/auth/students'))
  return handle(res)
}
