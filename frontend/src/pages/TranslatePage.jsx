import React, { useEffect, useRef, useState } from 'react'
import Navbar from '../components/layout/Navbar'
import Recorder from '../components/Recorder'
import ResultPanel from '../components/ResultPanel'
import { WarliBackdrop, WarliBorder, WarliDivider, WarliMural } from '../components/WarliArt'
import { translateSpeech, translateText, getHealth } from '../api/client'

const LANG_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'mr', label: 'Marathi' },
  { value: 'auto', label: 'Auto' },
]
const MODE_OPTIONS = [
  { value: 'text', label: 'Text' },
  { value: 'speech', label: 'Text + Audio' },
]
const TARGET_OPTIONS = [
  { value: 'warli', label: 'Warli' },
  { value: 'santali', label: 'Santali' },
]

// Accessible segmented toggle (used for From-language and Output-mode).
// `options` = [{ value, label }]. Uses aria-pressed on each button so screen
// readers announce the active choice. Kept inline — it is the only control of
// its kind, so a separate file would be needless sprawl.
function SegmentedToggle({ name, value, options, onChange, labelledBy }) {
  return (
    <div className="segmented" role="group" aria-labelledby={labelledBy} data-toggle={name}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="4" y1="12" x2="19" y2="12" />
      <polyline points="13 6 19 12 13 18" />
    </svg>
  )
}

export default function TranslatePage() {
  const [sourceLang, setSourceLang] = useState('auto')
  const [outputMode, setOutputMode] = useState('text')
  const [targetLang, setTargetLang] = useState('warli')
  const [textInput, setTextInput] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [health, setHealth] = useState(null)
  const taRef = useRef(null)

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth(null))
  }, [])

  // Auto-grow the textarea up to a cap so the composer feels like a search bar.
  useEffect(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(128, Math.min(el.scrollHeight, 320))}px`
  }, [textInput])

  async function runText() {
    if (!textInput.trim()) { setError('Type or record something to translate.'); return }
    setBusy(true); setError(null); setResult(null)
    try {
      const res = await translateText({
        text: textInput,
        sourceLang: targetLang === 'santali' ? 'en' : sourceLang,
        outputMode: targetLang === 'santali' ? 'text' : outputMode,
        targetLang,
      })
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
      const res = await translateSpeech({
        audioBlob: blob, filename,
        sourceLang: targetLang === 'santali' ? 'en' : sourceLang,
        outputMode: targetLang === 'santali' ? 'text' : outputMode,
        targetLang,
      })
      setResult(res)
    } catch (e) {
      setError(e.message || 'Speech translation failed.')
    } finally {
      setBusy(false)
    }
  }

  // Switching target: Santali pack (v0) understands English input and has no
  // voice yet, so lock From=English and Output=Text while it is selected.
  function handleTargetChange(v) {
    setTargetLang(v)
    setResult(null)
    setError(null)
    if (v === 'santali') {
      setSourceLang('en')
      setOutputMode('text')
    }
  }

  // Ctrl/Cmd + Enter submits without leaving the textarea.
  function onKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      runText()
    }
  }

  return (
    <>
      <WarliBackdrop />

      {/* Shared nav: Learn / Words / Translate / Teacher + language switcher */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        <Navbar />
      </div>

      <div className="app">
        <WarliBorder />

        <header className="app-header">
          <h1>Warli <span className="brand-dot">Translator</span></h1>
          <p>Type or speak in English / Hindi / Marathi — see and hear it in Warli (Devanagari, Palghar dialect).</p>
        </header>

        {/* Slim backend status line */}
        <div className="status-bar">
          <span className={`status-dot${health ? ' online' : ''}`} aria-hidden="true" />
          {health ? (
            <span>
              Connected <span className="sep">·</span> {health.translation_engine} engine
              <span className="sep">·</span> {health.dictionary_entries} words
              <span className="sep">·</span> {health.pronunciation_entries} pronunciation
              <span className="sep">·</span> TTS {health.tts_enabled ? 'on' : 'off'}
            </span>
          ) : (
            <span>Backend not reachable at the configured API URL</span>
          )}
        </div>

        {/* Warli tarpa-dance divider */}
        <WarliDivider />

        {/* Unified composer — type OR speak in one box */}
        <section className="card composer">
          <div className="composer-bar">
            <div className="bar-group">
              <span className="bar-caption" id="lang-caption">From</span>
              <SegmentedToggle
                name="lang" value={sourceLang} options={LANG_OPTIONS}
                onChange={setSourceLang} labelledBy="lang-caption"
              />
            </div>
            <div className="bar-group">
              <span className="bar-caption" id="mode-caption">Output</span>
              <SegmentedToggle
                name="mode" value={outputMode} options={MODE_OPTIONS}
                onChange={setOutputMode} labelledBy="mode-caption"
              />
            </div>
            <div className="bar-group">
              <span className="bar-caption" id="target-caption">To</span>
              <SegmentedToggle
                name="target" value={targetLang} options={TARGET_OPTIONS}
                onChange={handleTargetChange} labelledBy="target-caption"
              />
            </div>
          </div>
          {targetLang === 'santali' && (
            <p className="target-note">
              Santali pack (Jharkhand) understands English for now · text output only — voice coming.
              From is locked to English.
            </p>
          )}

          <label className="sr-only" htmlFor="text-input">Text to translate</label>
          <textarea
            id="text-input"
            ref={taRef}
            className="composer-input"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type here, or tap the mic and speak…  e.g. give water to the child"
            disabled={busy}
          />

          <div className="composer-actions">
            <div className="composer-tools">
              <Recorder onCapture={onCapture} disabled={busy} />
            </div>
            <button
              type="button"
              className="send-btn"
              onClick={runText}
              disabled={busy || !textInput.trim()}
              title="Translate (Ctrl/Cmd + Enter)"
            >
              {busy ? <span className="spinner" aria-hidden="true" /> : <SendIcon />}
              <span>{busy ? 'Working…' : 'Translate'}</span>
            </button>
          </div>
        </section>

        {error && <div className="error" role="alert">{error}</div>}

        {result && (
          <ResultPanel
            result={result}
            audioBase64={result.audio_base64}
            audioMime={result.audio_mime}
            outputMode={outputMode}
          />
        )}

        <footer className="app-footer">
          <WarliMural />
          <p className="footer-note">
            Warli speech output is an approximation — a Marathi voice (closest available to Warli,
            a Marathi-family language) reading Devanagari, nudged by an optional Warli pronunciation
            layer. No true Warli TTS model exists yet.
          </p>
        </footer>
      </div>
    </>
  )
}
