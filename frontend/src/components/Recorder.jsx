import React, { useEffect, useRef, useState } from 'react'

// Microphone recorder + file upload. Produces an audio Blob via onCapture(blob, filename).
// Uses the MediaRecorder API; requests a mimeType the browser supports.
export default function Recorder({ onCapture, disabled }) {
  const [recording, setRecording] = useState(false)
  const [status, setStatus] = useState('Idle. Tap the mic and speak in English or Hindi.')
  const [error, setError] = useState(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)

  // Pick a supported mime type (codecs differ across browsers).
  function pickMimeType() {
    const candidates = ['audio/webm', 'audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4']
    return candidates.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || ''
  }

  async function startRecording() {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Recording is not supported in this browser. Use the upload option instead.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = pickMimeType()
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      mediaRecorderRef.current = mr
      chunksRef.current = []

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        const type = mr.mimeType || mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        const ext = type.includes('mp4') ? 'mp4' : type.includes('ogg') ? 'ogg' : 'webm'
        if (blob.size > 0) onCapture(blob, `recording.${ext}`)
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }

      mr.start()
      setRecording(true)
      setStatus('Recording… tap Stop when done.')
    } catch (err) {
      setError(err?.message || 'Could not access the microphone.')
      setStatus('Microphone unavailable.')
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
    <div>
      <div className="recorder">
        <button
          type="button"
          className={`mic-btn${recording ? ' recording' : ''}`}
          onClick={recording ? stopRecording : startRecording}
          disabled={disabled}
          aria-label={recording ? 'Stop recording' : 'Start recording'}
        >
          <span className="mic-dot" aria-hidden="true" />
          {recording ? 'Stop' : 'Record'}
        </button>
        <span className="status-text" role="status" aria-live="polite">{status}</span>
      </div>

      <div className="upload-row">
        <label className="file-label">
          Upload audio file
          <input
            type="file"
            accept="audio/*,.wav,.mp3,.m4a,.ogg,.webm,.flac"
            onChange={onFileChange}
            disabled={disabled}
          />
        </label>
        <span className="status-text">.wav, .mp3, .m4a, .ogg, .webm</span>
      </div>

      {error && <p className="error" style={{ marginTop: 12 }}>{error}</p>}
    </div>
  )
}
