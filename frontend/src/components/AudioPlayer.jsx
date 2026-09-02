import React, { useEffect, useRef, useState } from 'react'
import { base64ToAudioUrl } from '../api/client'

// Compact play/pause control for the synthesized Warli speech (base64 mp3 from
// the API). A single round icon button drives a hidden <audio> element, keeping
// the result head clean (Google-Translate style speaker). Converts the payload
// to an object URL and revokes it when the source changes / on unmount.
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

export default function AudioPlayer({ audioBase64, mime = 'audio/mpeg' }) {
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
