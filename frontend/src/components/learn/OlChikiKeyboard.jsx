// OlChikiKeyboard.jsx — On-screen Santali keyboard.
// Learners don't have an Ol Chiki system keyboard, so anywhere Santali text
// must be typed (wordbook search, listen-and-type) this panel pops up.
// 30 letters grouped like the alphabet lessons: vowels, then consonants.

import { useState } from 'react'

const ROWS = [
  ['ᱚ', 'ᱟ', 'ᱤ', 'ᱩ', 'ᱮ', 'ᱳ'],
  ['ᱠ', 'ᱜ', 'ᱝ', 'ᱪ', 'ᱡ', 'ᱧ', 'ᱴ', 'ᱰ'],
  ['ᱛ', 'ᱫ', 'ᱱ', 'ᱯ', 'ᱵ', 'ᱢ', 'ᱭ', 'ᱞ'],
  ['ᱬ', 'ᱨ', 'ᱣ', 'ᱥ', 'ᱦ', 'ᱲ'],
  ['ᱶ', 'ᱷ', 'ᱸ'],
]

/**
 * Insert `text` at the cursor of an <input>, replacing any selection.
 * Returns the new full value (caller sets state + restores caret).
 */
export function insertAtCursor(inputEl, currentValue, text) {
  if (!inputEl) return { value: currentValue + text, caret: (currentValue + text).length }
  const start = inputEl.selectionStart ?? currentValue.length
  const end = inputEl.selectionEnd ?? currentValue.length
  const value = currentValue.slice(0, start) + text + currentValue.slice(end)
  return { value, caret: start + text.length }
}

/** Delete one char before the cursor (or the selection). */
export function backspaceAtCursor(inputEl, currentValue) {
  if (!inputEl) return { value: currentValue.slice(0, -1), caret: Math.max(0, currentValue.length - 1) }
  const start = inputEl.selectionStart ?? currentValue.length
  const end = inputEl.selectionEnd ?? currentValue.length
  if (start !== end) {
    return { value: currentValue.slice(0, start) + currentValue.slice(end), caret: start }
  }
  if (start === 0) return { value: currentValue, caret: 0 }
  return { value: currentValue.slice(0, start - 1) + currentValue.slice(end), caret: start - 1 }
}

export default function OlChikiKeyboard({ inputRef, value, onChange, startOpen = true }) {
  const [open, setOpen] = useState(startOpen)

  function focusCaret(pos) {
    const el = inputRef?.current
    if (!el) return
    requestAnimationFrame(() => {
      el.focus({ preventScroll: true })
      try { el.setSelectionRange(pos, pos) } catch { /* noop */ }
    })
  }

  function typeChar(ch) {
    const { value: next, caret } = insertAtCursor(inputRef?.current, value, ch)
    onChange(next)
    focusCaret(caret)
  }

  function doBackspace() {
    const { value: next, caret } = backspaceAtCursor(inputRef?.current, value)
    onChange(next)
    focusCaret(caret)
  }

  function typeSpace() {
    typeChar(' ')
  }

  return (
    <div className="w-full">
      <div className="flex justify-end mb-1">
        <button
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-label={open ? 'Hide Santali keyboard' : 'Show Santali keyboard'}
          className="px-3 py-1 rounded-full text-xs font-bold"
          style={{
            backgroundColor: open ? '#c2571b' : 'white',
            color: open ? 'white' : '#78716c',
            border: '2px solid',
            borderColor: open ? '#c2571b' : '#e7e5e4',
          }}
        >
          ⌨ ᱚᱞ
        </button>
      </div>

      {open && (
        <div
          className="rounded-2xl p-2 flex flex-col gap-1.5"
          style={{ backgroundColor: '#f5f5f4', border: '2px solid #e7e5e4' }}
          role="group"
          aria-label="Ol Chiki keyboard"
        >
          {ROWS.map((row, i) => (
            <div key={i} className="flex gap-1.5">
              {row.map(ch => (
                <button
                  key={ch}
                  onClick={() => typeChar(ch)}
                  aria-label={`Type ${ch}`}
                  className="flex-1 rounded-xl py-2 text-xl font-semibold shadow-sm active:scale-95 transition-transform"
                  style={{ backgroundColor: 'white', color: '#1c1917', border: '1px solid #e7e5e4' }}
                >
                  {ch}
                </button>
              ))}
            </div>
          ))}
          <div className="flex gap-1.5">
            <button
              onClick={typeSpace}
              aria-label="Space"
              className="rounded-xl py-2 text-sm font-bold shadow-sm active:scale-95 transition-transform"
              style={{ backgroundColor: 'white', color: '#78716c', border: '1px solid #e7e5e4', flex: 4 }}
            >
              space
            </button>
            <button
              onClick={doBackspace}
              aria-label="Backspace"
              className="rounded-xl py-2 text-lg font-bold shadow-sm active:scale-95 transition-transform"
              style={{ backgroundColor: 'white', color: '#78716c', border: '1px solid #e7e5e4', flex: 1 }}
            >
              ⌫
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
