// ListenType.jsx — Listen-and-type exercise.
// Plays the Warli audio for `audio_word`; the learner types what they hear.
// Comparison is whitespace-trimmed and exact (Devanagari).

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Volume2, Loader2 } from 'lucide-react'
import { getPronounce, base64ToAudioUrl } from '../../api/learning'

export default function ListenType({ exercise, onCorrect, onWrong }) {
  const [value, setValue] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [audioLoading, setAudioLoading] = useState(false)
  const [audioAvailable, setAudioAvailable] = useState(false)
  const audioRef = useRef(null)

  // Fetch and auto-play audio on mount
  useEffect(() => {
    audioRef.current = null
    setAudioAvailable(false)
    setValue('')
    setRevealed(false)
    if (!exercise.audio_word) return
    let cancelled = false
    setAudioLoading(true)

    getPronounce(exercise.audio_word)
      .then(data => {
        if (cancelled) return
        if (!data) {
          setAudioLoading(false)
          return
        }
        const url = base64ToAudioUrl(data.audio_base64, data.audio_mime)
        const audio = new Audio(url)
        audioRef.current = audio
        setAudioAvailable(true)
        setAudioLoading(false)
        setTimeout(() => {
          if (!cancelled) audio.play().catch(() => {})
        }, 300)
      })
      .catch(() => {
        if (!cancelled) setAudioLoading(false)
      })

    return () => { cancelled = true }
  }, [exercise.id])

  function replayAudio() {
    if (audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => {})
    }
  }

  function handleCheck() {
    if (revealed || !value.trim()) return
    const correct = value.trim() === (exercise.correct || '').trim()
    setIsCorrect(correct)
    setRevealed(true)
    if (correct) {
      setTimeout(onCorrect, 900)
    } else {
      setTimeout(() => onWrong(exercise.correct), 1200)
    }
  }

  const inputStyle = !revealed
    ? { border: '2px solid #e7e5e4', background: 'white' }
    : isCorrect
      ? { border: '2px solid #22c55e', background: '#f0fdf4' }
      : { border: '2px solid #ef4444', background: '#fef2f2' }

  return (
    <div className="w-full flex flex-col items-center gap-4">
      {/* Big speaker button */}
      <motion.button
        onClick={replayAudio}
        disabled={audioLoading || !audioAvailable}
        className="w-24 h-24 rounded-full flex items-center justify-center text-white shadow-lg"
        style={{ backgroundColor: '#f97316', opacity: audioAvailable ? 1 : 0.6 }}
        whileHover={audioAvailable ? { scale: 1.06 } : {}}
        whileTap={audioAvailable ? { scale: 0.94 } : {}}
        aria-label="Play the Warli word"
      >
        {audioLoading
          ? <Loader2 size={36} className="animate-spin" />
          : <Volume2 size={36} />
        }
      </motion.button>
      {!audioAvailable && !audioLoading && (
        <p className="text-sm text-stone-400">Audio unavailable — read and type the word.</p>
      )}

      {/* Answer input */}
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleCheck() }}
        disabled={revealed}
        placeholder="Type in Warli…"
        aria-label="Type the Warli word you hear"
        className="w-full rounded-2xl p-4 text-lg text-center font-semibold outline-none transition-colors"
        style={inputStyle}
      />

      {revealed && !isCorrect && (
        <p className="text-sm font-semibold" style={{ color: '#22c55e' }}>
          Correct answer: {exercise.correct}
        </p>
      )}

      <button
        onClick={handleCheck}
        disabled={revealed || !value.trim()}
        className="px-10 py-3 rounded-full text-lg font-bold text-white shadow"
        style={{
          backgroundColor: revealed || !value.trim() ? '#d6d3d1' : '#22c55e',
          cursor: revealed || !value.trim() ? 'not-allowed' : 'pointer',
        }}
      >
        Check
      </button>
    </div>
  )
}
