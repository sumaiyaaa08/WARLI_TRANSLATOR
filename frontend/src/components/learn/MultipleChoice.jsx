// MultipleChoice.jsx — Listen-and-choose exercise.
// Shows 4 shuffled options; auto-plays audio on mount.

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Volume2, Loader2 } from 'lucide-react'
import { getPronounce, base64ToAudioUrl } from '../../api/learning'

function fisherYates(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function MultipleChoice({ exercise, onCorrect, onWrong }) {
  const [options, setOptions] = useState([])
  const [selected, setSelected] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [audioLoading, setAudioLoading] = useState(false)
  const [audioAvailable, setAudioAvailable] = useState(false)
  const audioRef = useRef(null)

  // Shuffle options once on mount
  useEffect(() => {
    setOptions(fisherYates(exercise.options || []))
  }, [exercise.id])

  // Fetch and auto-play audio on mount
  useEffect(() => {
    audioRef.current = null
    setAudioAvailable(false)
    if (!exercise.audio_word) return
    let cancelled = false
    setAudioLoading(true)

    getPronounce(exercise.audio_word)
      .then(data => {
        if (cancelled) return
        if (!data) {
          // TTS disabled or unavailable — hide the speaker button
          setAudioLoading(false)
          return
        }
        const url = base64ToAudioUrl(data.audio_base64, data.audio_mime)
        const audio = new Audio(url)
        audioRef.current = audio
        setAudioAvailable(true)
        setAudioLoading(false)
        // Auto-play after 300ms delay
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

  function handleSelect(opt) {
    if (revealed) return
    setSelected(opt)
    setRevealed(true)

    const correct = opt === exercise.correct
    if (correct) {
      setTimeout(onCorrect, 900)
    } else {
      setTimeout(() => onWrong(exercise.correct), 1200)
    }
  }

  return (
    <div className="w-full">
      {/* Audio button — only shown when audio loaded successfully */}
      {(audioLoading || audioAvailable) && (
        <div className="flex justify-center mb-4">
          <button
            onClick={replayAudio}
            disabled={audioLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-full border-2 text-sm font-semibold"
            style={{ borderColor: '#f97316', color: '#f97316', background: 'white' }}
            aria-label="Play audio"
          >
            {audioLoading
              ? <Loader2 size={18} className="animate-spin" />
              : <Volume2 size={18} />
            }
            <span>Listen</span>
          </button>
        </div>
      )}

      {/* Options: single column when options are full sentences, else 2-col grid */}
      <OptionsGrid options={options} revealed={revealed} selected={selected}
        exercise={exercise} onSelect={handleSelect} />
    </div>
  )
}

// ── Adaptive options grid ───────────────────────────────────────────────────
// Short words (माझं, पाणी) sit in a compact 2-column grid; full Warli
// sentences (मी भात खातो) get roomy single-column rows.

function OptionsGrid({ options, revealed, selected, exercise, onSelect }) {
  const long = options.some(o => (o || '').length > 14)

  function getOptionStyle(opt) {
    if (!revealed) return { border: '2px solid #e7e5e4', background: 'white' }
    if (opt === exercise.correct) return { border: '2px solid #22c55e', background: '#f0fdf4' }
    if (opt === selected) return { border: '2px solid #ef4444', background: '#fef2f2' }
    return { border: '2px solid #e7e5e4', background: 'white', opacity: 0.6 }
  }

  return (
    <div className={long ? 'flex flex-col gap-3' : 'grid grid-cols-2 gap-3'}>
      {options.map(opt => {
        const isCorrect = opt === exercise.correct
        const isSelected = opt === selected

        return (
          <motion.button
            key={opt}
            className={`rounded-2xl p-4 font-semibold text-center min-h-[56px] transition-colors ${long ? 'text-lg' : 'text-lg'}`}
            style={getOptionStyle(opt)}
            onClick={() => onSelect(opt)}
            disabled={revealed}
            animate={
              revealed && isSelected && !isCorrect
                ? { x: [0, -8, 8, -8, 0] }
                : revealed && isSelected && isCorrect
                ? { scale: [1, 1.12, 1] }
                : {}
            }
            transition={{ duration: 0.4 }}
            aria-pressed={isSelected}
          >
            {opt}
          </motion.button>
        )
      })}
    </div>
  )
}
