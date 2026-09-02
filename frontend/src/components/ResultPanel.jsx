import React from 'react'

// Displays the translation result: source text, Warli output (Devanagari),
// romanization, unmatched/corrected token chips, and the TTS approximation notice.
export default function ResultPanel({ result }) {
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

  return (
    <div className="panel">
      <h2 className="panel-title">Result</h2>

      <div className="result-block">
        <div className="result-label">You said (transcribed)</div>
        <div className="result-source">{sourceText || '—'}</div>
      </div>

      <div className="result-block">
        <div className="result-label" id="warli-out-label">Warli</div>
        <div className="result-warli devanagari" aria-labelledby="warli-out-label" lang="mr">
          {warliText || '—'}
        </div>
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
            <span> The optional Warli pronunciation layer was applied.</span>
          )}
          {tts.voice_lang && <span> Voice: {tts.voice_lang === 'hi' ? 'Hindi' : tts.voice_lang}.</span>}
        </div>
      )}
      {tts && !tts.generated && tts.note && (
        <div className="notice"><strong>No audio:</strong> {tts.note}</div>
      )}
    </div>
  )
}
