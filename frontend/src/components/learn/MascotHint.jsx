// MascotHint.jsx — Tribal-art mascot guide with hint speech bubble.
// Fixed position bottom-right. Tapping uses one of 3 hint lifelines.

import { AnimatePresence, motion } from 'framer-motion'
import { useState, useEffect, useRef } from 'react'
import { getHint } from '../../api/learning'
import { useProgress } from '../../context/ProgressContext'

// ── Warli-style tribal dancer SVG mascot ────────────────────────────────────
function WarliDancer() {
  return (
    <svg
      width="56"
      height="72"
      viewBox="0 0 56 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Head — circle */}
      <circle cx="28" cy="10" r="8" fill="#f97316" />
      {/* Neck */}
      <line x1="28" y1="18" x2="28" y2="26" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
      {/* Body */}
      <line x1="28" y1="26" x2="28" y2="44" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
      {/* Left arm raised */}
      <line x1="28" y1="30" x2="10" y2="20" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
      {/* Right arm raised */}
      <line x1="28" y1="30" x2="46" y2="20" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
      {/* Skirt — triangle shape */}
      <polygon points="28,44 12,66 44,66" fill="#f97316" opacity="0.85" />
      {/* Left leg hint */}
      <line x1="20" y1="62" x2="14" y2="70" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
      {/* Right leg hint */}
      <line x1="36" y1="62" x2="42" y2="70" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
      {/* Decorative dot on head */}
      <circle cx="28" cy="10" r="3" fill="white" opacity="0.5" />
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MascotHint({ exercise, hintsRemaining, onUse }) {
  const { uiLang } = useProgress()
  const [hint, setHint] = useState(null)
  const [loading, setLoading] = useState(false)
  const [bounceKey, setBounceKey] = useState(0)
  const dismissTimerRef = useRef(null)

  // Dismiss hint after 8 seconds
  useEffect(() => {
    if (hint) {
      clearTimeout(dismissTimerRef.current)
      dismissTimerRef.current = setTimeout(() => setHint(null), 8000)
    }
    return () => clearTimeout(dismissTimerRef.current)
  }, [hint])

  // Clear hint when exercise changes
  useEffect(() => {
    setHint(null)
    setLoading(false)
  }, [exercise?.id])

  async function handleTap() {
    if (hintsRemaining <= 0 || loading) return
    onUse()
    setLoading(true)
    try {
      const response = await getHint({
        promptEn: exercise.prompt_en,
        correctAnswer: exercise.correct,
        sourceLang: uiLang || 'en',
        targetLang: exercise.target_lang || 'warli',
      })
      setHint(response.hint)
      setBounceKey(k => k + 1)
    } catch {
      setHint('Tap the speaker to hear the word again!')
      setBounceKey(k => k + 1)
    } finally {
      setLoading(false)
    }
  }

  const isDisabled = hintsRemaining <= 0 || loading

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {/* Speech bubble */}
      <AnimatePresence>
        {(hint || loading) && (
          <motion.div
            className="bg-white rounded-2xl shadow-lg p-3 max-w-[200px] border border-stone-200 relative"
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            transition={{ duration: 0.25 }}
          >
            {/* Bubble tail pointing down-right */}
            <div
              className="absolute bottom-[-8px] right-6 w-4 h-4 bg-white border-r border-b border-stone-200"
              style={{ transform: 'rotate(45deg)', clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}
            />
            {loading ? (
              <div className="space-y-2 py-1">
                <div className="h-3 bg-stone-200 rounded animate-pulse w-full" />
                <div className="h-3 bg-stone-200 rounded animate-pulse w-4/5" />
              </div>
            ) : (
              <p className="text-sm text-stone-700 leading-relaxed">{hint}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mascot button */}
      <div className="relative">
        {/* Hint count badge */}
        <span
          className="absolute -top-1 -left-1 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center text-white z-10"
          style={{ backgroundColor: hintsRemaining > 0 ? '#f97316' : '#d1d5db' }}
          aria-label={`${hintsRemaining} hints remaining`}
        >
          {hintsRemaining}
        </span>

        <motion.button
          key={bounceKey}
          onClick={handleTap}
          disabled={isDisabled}
          className="p-1 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
          style={{ opacity: isDisabled ? 0.4 : 1, cursor: isDisabled ? 'not-allowed' : 'pointer' }}
          aria-label={`Get a hint (${hintsRemaining} remaining)`}
          animate={
            bounceKey > 0
              ? { y: [0, -12, 0] }
              : { y: [0, -4, 0] }
          }
          transition={
            bounceKey > 0
              ? { duration: 0.4 }
              : { repeat: Infinity, duration: 2, ease: 'easeInOut' }
          }
        >
          <WarliDancer />
        </motion.button>
      </div>
    </div>
  )
}
