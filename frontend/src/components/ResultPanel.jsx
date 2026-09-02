import React from 'react'
import AudioPlayer from './AudioPlayer'

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
          <span className="audio-hint">Switch to “Text + Speech” to hear it</span>
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
