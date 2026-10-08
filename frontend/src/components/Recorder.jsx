import React, { useEffect, useRef, useState } from 'react'

// Inline speech controls for the unified composer: a round mic button (record /
// stop) and an upload button, plus a compact status line. Produces an audio Blob
// via onCapture(blob, filename). Uses the MediaRecorder API and picks a mimeType
// the current browser supports.
function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10v1a7 7 0 0 0 14 0v-1" />
      <line x1="12" y1="18" x2="12" y2="22" />
    </svg>
  )
}
function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2.5" />
    </svg>
  )
}
function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

export default function Recorder({ onCapture, disabled }) {
  const [recording, setRecording] = useState(false)
  const [status, setStatus] = useState('Tap the mic and speak')
  const [error, setError] = useState(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)

  // Pick a supported mime type (codecs differ across browsers).
  function pickMimeType() {
    if (!window.MediaRecorder) return ''
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
    return candidates.find((t) => window.MediaRecorder.isTypeSupported(t)) || ''
  }

  async function startRecording() {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Recording unsupported here — use upload')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      if (!window.MediaRecorder) {
        stream.getTracks().forEach((t) => t.stop())
        setError('Recording is not supported in this browser — use upload')
        return
      }
      const mimeType = pickMimeType()
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      mediaRecorderRef.current = mr
      chunksRef.current = []

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onerror = () => {
        setError('The microphone recording failed — please try again or use upload')
        setRecording(false)
        setStatus('Recording failed')
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        mediaRecorderRef.current = null
      }
      mr.onstop = () => {
        const type = mr.mimeType || mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        const ext = type.includes('mp4') ? 'mp4' : type.includes('ogg') ? 'ogg' : 'webm'
        if (blob.size > 0) {
          onCapture(blob, `recording.${ext}`)
        } else {
          setError('No audio was captured — check microphone permission and try again')
          setStatus('Recording was empty')
        }
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        mediaRecorderRef.current = null
      }

      // A timeslice makes browsers emit usable chunks even when stop() happens
      // immediately after a short recording.
      mr.start(250)
      setRecording(true)
      setStatus('Recording… tap to stop')
    } catch (err) {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      setError(err?.message || 'Could not access the microphone')
      setStatus('Microphone unavailable')
    }
  }

  function stopRecording() {
    const mr = mediaRecorderRef.current
    if (mr && mr.state !== 'inactive') mr.stop()
    setRecording(false)
    setStatus('Processing recording…')
  }

  function onFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setStatus(`Uploading ${file.name}…`)
    onCapture(file, file.name)
    e.target.value = '' // allow re-selecting the same file
  }

  // Clean up any live stream if the component unmounts mid-recording.
  useEffect(() => () => {
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop())
  }, [])

  return (
    <>
      <button
        type="button"
        className={`icon-btn${recording ? ' recording' : ''}`}
        onClick={recording ? stopRecording : startRecording}
        disabled={disabled}
        aria-label={recording ? 'Stop recording' : 'Start recording'}
        title={recording ? 'Stop recording' : 'Record speech'}
      >
        {recording ? <StopIcon /> : <MicIcon />}
      </button>

      <label
        className="icon-btn"
        title="Upload an audio file"
        aria-label="Upload an audio file"
        style={disabled ? { opacity: 0.45, pointerEvents: 'none' } : undefined}
      >
        <UploadIcon />
        <input
          type="file"
          className="file-input"
          accept="audio/*,.wav,.mp3,.m4a,.ogg,.webm,.flac"
          onChange={onFileChange}
          disabled={disabled}
        />
      </label>

      <span
        className="tool-status"
        role="status"
        aria-live="polite"
        style={error ? { color: 'var(--danger)' } : undefined}
      >
        {error || status}
      </span>
    </>
  )
}
