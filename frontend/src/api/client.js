// API client for the Warli backend. Defaults to the relative "/api" base, which
// works both in dev (the Vite server proxies /api to FastAPI) and in the
// single-server production build (FastAPI serves the API and this app on one
// origin). Override with VITE_API_URL only if you host the API elsewhere. All
// calls return parsed JSON and throw an Error with the backend's `detail`/`error`
// message on failure.

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

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

// POST /translate/text — text in, Warli text (+optional audio) out.
export async function translateText({ text, sourceLang = 'en', outputMode = 'text' }) {
  const res = await fetch(joinUrl('/translate/text'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, source_lang: sourceLang, output_mode: outputMode }),
  })
  return handle(res)
}

// POST /translate/speech — audio blob/file in, Warli text (+optional audio) out.
export async function translateSpeech({ audioBlob, filename = 'recording.webm', sourceLang = 'auto', outputMode = 'text' }) {
  const form = new FormData()
  form.append('audio', audioBlob, filename)
  form.append('source_lang', sourceLang)
  form.append('output_mode', outputMode)
  const res = await fetch(joinUrl('/translate/speech'), { method: 'POST', body: form })
  return handle(res)
}

// GET /health — used to show backend status + data counts in the UI.
export async function getHealth() {
  const res = await fetch(joinUrl('/health'))
  return handle(res)
}

// Turn a base64 mp3 payload from the API into a playable object URL.
export function base64ToAudioUrl(b64, mime = 'audio/mpeg') {
  const bytes = atob(b64)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i += 1) arr[i] = bytes.charCodeAt(i)
  const blob = new Blob([arr], { type: mime })
  return URL.createObjectURL(blob)
}
