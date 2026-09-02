import React, { useEffect, useRef, useState } from 'react'
import { base64ToAudioUrl } from '../api/client'

// Plays the synthesized Warli speech (base64 mp3 from the API). Converts the
// payload to an object URL and cleans it up when the source changes/unmounts.
export default function AudioPlayer({ audioBase64, mime = 'audio/mpeg' }) {
  const [url, setUrl] = useState(null)
  const [autoplayFailed, setAutoplayFailed] = useState(false)
  const audioRef = useRef(null)

  useEffect(() => {
    if (!audioBase64) { setUrl(null); return undefined }
    const objectUrl = base64ToAudioUrl(audioBase64, mime)
    setUrl(objectUrl)
    setAutoplayFailed(false)
    return () => URL.revokeObjectURL(objectUrl)
  }, [audioBase64, mime])

  useEffect(() => {
    if (url && audioRef.current) {
      // Try to autoplay; browsers may block it, so fall back to a Play button.
      audioRef.current.play().catch(() => setAutoplayFailed(true))
    }
  }, [url])

  if (!url) return null

  return (
    <div className="audio-row">
      <div className="result-label">Warli speech (approximation)</div>
      <audio ref={audioRef} controls src={url} />
      {autoplayFailed && (
        <div className="status-text" style={{ marginTop: 6 }}>
          Press play to hear the Warli audio.
        </div>
      )}
    </div>
  )
}
