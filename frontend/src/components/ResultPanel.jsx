import React, { useEffect, useRef, useState } from 'react'
import { base64ToAudioUrl } from '../api/client'

// Compact play/pause control for the synthesized Warli speech (base64 mp3 from
// the API). A single round icon button drives a hidden <audio> element, keeping
// the result head clean (Google-Translate style speaker). Converts the payload
// to an object URL and revokes it when the source changes / on unmount. Kept
// inline here because ResultPanel is its only consumer.
function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l11.14-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14z" />
    </svg>
  )
}
function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1.5" />
      <rect x="14" y="5" width="4" height="14" rx="1.5" />
    </svg>
  )
}

function AudioPlayer({ audioBase64, mime = 'audio/mpeg' }) {
  const [url, setUrl] = useState(null)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef(null)

  useEffect(() => {
    if (!audioBase64) { setUrl(null); return undefined }
    const objectUrl = base64ToAudioUrl(audioBase64, mime)
    setUrl(objectUrl)
    setPlaying(false)
    return () => URL.revokeObjectURL(objectUrl)
  }, [audioBase64, mime])

  // Try to autoplay once the URL is ready; browsers may block it (that's fine —
  // the button stays available).
  useEffect(() => {
    if (url && audioRef.current) {
      audioRef.current.play().catch(() => setPlaying(false))
    }
  }, [url])

  function toggle() {
    const el = audioRef.current
    if (!el || !url) return
    if (el.paused) el.play().catch(() => setPlaying(false))
    else el.pause()
  }

  if (!url) return null

  return (
    <div className="audio-inline">
      <button
        type="button"
        className="icon-btn"
        onClick={toggle}
        aria-label={playing ? 'Pause Warli audio' : 'Play Warli audio'}
        title={playing ? 'Pause' : 'Play Warli audio'}
        style={playing ? { background: 'var(--accent)', color: 'var(--accent-contrast)' } : undefined}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <audio
        ref={audioRef}
        src={url}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        style={{ display: 'none' }}
      />
    </div>
  )
}

// Clean result card: source line, Warli output (Devanagari) + romanization,
// inline audio playback, token chips, and the TTS approximation notice. Audio is
// rendered inline in the head (Google-Translate style) instead of a separate box.
export default function ResultPanel({ result, audioBase64, audioMime, outputMode }) {
  if (!result) return null
  const {
    source_text: sourceText,
    warli_text: warliText,
    warli_roman: warliRoman,
    unmatched = [],
    corrections_applied: corrections = [],
    warnings = [],
    tts,
  } = result

  const hasAudio = outputMode === 'speech' && Boolean(audioBase64)

  return (
    <div className="card result-card">
      <div className="result-head">
        <span className="result-lang">Warli · Devanagari</span>
        {hasAudio ? (
          <AudioPlayer audioBase64={audioBase64} mime={audioMime || 'audio/mpeg'} />
        ) : outputMode === 'text' ? (
          <span className="audio-hint">Switch to “Text + Audio” to hear it</span>
        ) : null}
      </div>

      {sourceText && (
        <div className="result-source">
          <span className="src-label">You said</span>
          <span className="src-text">{sourceText}</span>
        </div>
      )}

      <div>
        <div className="result-warli devanagari" lang="mr">{warliText || '—'}</div>
        {warliRoman && <div className="result-roman">{warliRoman}</div>}
      </div>

      {(unmatched.length > 0 || corrections.length > 0) && (
        <div className="chips">
          {corrections.map((c, i) => (
            <span key={`c-${i}`} className="chip corrected" title={`Spelling corrected from ${c.wrong}`}>
              fixed: {c.correct}
            </span>
          ))}
          {unmatched.map((u, i) => (
            <span key={`u-${i}`} className="chip unmatched" title="No dictionary match — passed through">
              no match: {u}
            </span>
          ))}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="notice">
          {warnings.map((w, i) => <div key={i}>{w}</div>)}
        </div>
      )}

      {tts && tts.generated && (
        <div className="notice">
          <strong>Speech is an approximation.</strong> {tts.note}
          {tts.pronunciation_layer_applied && (
            <span> The Warli pronunciation layer was applied.</span>
          )}
          {tts.voice_lang && (
            <span> Voice: {tts.voice_lang === 'hi' ? 'Hindi' : tts.voice_lang === 'mr' ? 'Marathi' : tts.voice_lang}.</span>
          )}
        </div>
      )}
      {tts && !tts.generated && tts.note && (
        <div className="notice"><strong>No audio:</strong> {tts.note}</div>
      )}
    </div>
  )
}
