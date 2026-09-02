import React, { useEffect, useState } from 'react'
import SegmentedToggle from '../components/SegmentedToggle'
import Recorder from '../components/Recorder'
import ResultPanel from '../components/ResultPanel'
import AudioPlayer from '../components/AudioPlayer'
import { translateSpeech, translateText, getHealth } from '../api/client'

const LANG_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'auto', label: 'Auto' },
]
const MODE_OPTIONS = [
  { value: 'text', label: 'Warli Text' },
  { value: 'speech', label: 'Text + Speech' },
]

export default function TranslatePage() {
  const [sourceLang, setSourceLang] = useState('auto')
  const [outputMode, setOutputMode] = useState('text')
  const [textInput, setTextInput] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [health, setHealth] = useState(null)

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth(null))
  }, [])

  async function runText() {
    if (!textInput.trim()) { setError('Type or record something to translate.'); return }
    setBusy(true); setError(null); setResult(null)
    try {
      const res = await translateText({ text: textInput, sourceLang, outputMode })
      setResult(res)
    } catch (e) {
      setError(e.message || 'Translation failed.')
    } finally {
      setBusy(false)
    }
  }

  async function onCapture(blob, filename) {
    setBusy(true); setError(null); setResult(null)
    try {
      const res = await translateSpeech({ audioBlob: blob, filename, sourceLang, outputMode })
      setResult(res)
    } catch (e) {
      setError(e.message || 'Speech translation failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Warli Speech Translator</h1>
        <p>Speak English or Hindi → see and hear it in Warli (Devanagari, Palghar dialect).</p>
      </header>

      {/* Backend status strip */}
      <div className="panel" style={{ padding: '12px 18px' }}>
        {health ? (
          <div className="chips" style={{ marginTop: 0 }}>
            <span className="chip">engine: {health.translation_engine}</span>
            <span className="chip">dictionary: {health.dictionary_entries}</span>
            <span className="chip">corrections: {health.correction_pairs}</span>
            <span className="chip">pronunciation: {health.pronunciation_entries}</span>
            <span className="chip">ASR: {health.asr_enabled ? 'on' : 'off'}</span>
            <span className="chip">TTS: {health.tts_enabled ? 'on' : 'off'}</span>
          </div>
        ) : (
          <span className="status-text">Backend not reachable at the configured API URL.</span>
        )}
      </div>

      {/* Controls */}
      <div className="panel">
        <h2 className="panel-title">1 · Choose input language &amp; output mode</h2>
        <div className="controls">
          <div className="control-group">
            <span className="label" id="lang-label">Input language</span>
            <SegmentedToggle
              name="lang" value={sourceLang} options={LANG_OPTIONS}
              onChange={setSourceLang} labelledBy="lang-label"
            />
          </div>
          <div className="control-group">
            <span className="label" id="mode-label">Output mode</span>
            <SegmentedToggle
              name="mode" value={outputMode} options={MODE_OPTIONS}
              onChange={setOutputMode} labelledBy="mode-label"
            />
          </div>
        </div>
      </div>

      {/* Speech input */}
      <div className="panel">
        <h2 className="panel-title">2 · Speak or upload audio</h2>
        <Recorder onCapture={onCapture} disabled={busy} />
      </div>

      {/* Text input */}
      <div className="panel">
        <h2 className="panel-title">…or type text</h2>
        <label className="sr-only" htmlFor="text-input">Source text</label>
        <textarea
          id="text-input"
          className="text-input"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="e.g. give water to the child"
          disabled={busy}
        />
        <div style={{ marginTop: 12 }}>
          <button type="button" className="primary-btn" onClick={runText} disabled={busy}>
            {busy ? <span className="spinner" aria-hidden="true" /> : 'Translate text'}
          </button>
        </div>
      </div>

      {busy && <div className="panel"><span className="status-text">Working…</span></div>}
      {error && <div className="panel"><p className="error">{error}</p></div>}

      {/* Output */}
      {result && (
        <>
          <ResultPanel result={result} />
          <div className="panel">
            <h2 className="panel-title">3 · Playback</h2>
            {outputMode === 'speech' && result.audio_base64 ? (
              <AudioPlayer audioBase64={result.audio_base64} mime={result.audio_mime || 'audio/mpeg'} />
            ) : (
              <span className="status-text">
                {outputMode === 'text'
                  ? 'Switch output mode to “Text + Speech” to hear the Warli audio.'
                  : 'No audio was generated for this request.'}
              </span>
            )}
          </div>
        </>
      )}

      <p className="footer-note">
        Warli speech output is an approximation (Hindi/Marathi voice reading Devanagari) — no true Warli TTS model exists yet.
      </p>
    </div>
  )
}
