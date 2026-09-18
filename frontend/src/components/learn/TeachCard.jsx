// TeachCard.jsx — "Learn before you are tested."
// A manuscript-style intro card that TEACHES first: heading, explanation,
// and an optional grid of letters (Ol Chiki alphabet lessons). One button —
// "Got it / Next" — moves on. Never scored, never costs a heart.

import { motion } from 'framer-motion'
import { WarliDivider } from '../WarliArt'
import { useProgress } from '../../context/ProgressContext'

const NEXT_LABEL = { en: 'Got it →', hi: 'समझ गया →', mr: 'समजलं →' }

export default function TeachCard({ exercise, onNext }) {
  const { uiLang } = useProgress()
  const lang = ['en', 'hi', 'mr'].includes(uiLang) ? uiLang : 'hi'

  const title =
    lang === 'mr' ? (exercise.prompt_mr || exercise.prompt_hi)
    : lang === 'en' ? exercise.prompt_en
    : exercise.prompt_hi
  const body =
    lang === 'mr' ? (exercise.body_mr || exercise.body_hi || exercise.body_en)
    : lang === 'en' ? (exercise.body_en || exercise.body_hi)
    : (exercise.body_hi || exercise.body_en)
  const letters = exercise.letters || []

  return (
    <motion.div
      className="w-full max-w-lg mx-auto px-4 py-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div
        className="rounded-3xl overflow-hidden shadow-md"
        style={{ backgroundColor: '#fffdf7', border: '2px dashed #c2571b' }}
      >
        {/* manuscript header */}
        <div className="px-5 pt-4" style={{ color: '#c2571b' }}>
          <WarliDivider />
          <p
            className="text-xs font-bold uppercase tracking-widest text-center mt-1"
            style={{ color: '#c2571b' }}
          >
            📖 Learn first
          </p>
          <h2
            className="text-2xl font-bold text-center leading-snug"
            style={{ color: '#1c1917', fontFamily: '"Baloo 2", system-ui, sans-serif' }}
          >
            {title}
          </h2>
        </div>

        <div className="px-5 pb-5">
          {body && (
            <p className="text-base leading-relaxed text-center mt-1" style={{ color: '#44403c' }}>
              {body}
            </p>
          )}

          {/* letter grid */}
          {letters.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-4">
              {letters.map((l, i) => (
                <div
                  key={i}
                  className="rounded-2xl py-2 px-1 text-center"
                  style={{ backgroundColor: '#fef3e8', border: '1px solid #ead9c2' }}
                >
                  <span className="block text-3xl font-bold" style={{ color: '#9a3412' }}>
                    {l.char}
                  </span>
                  <span className="block text-xs font-bold mt-0.5" style={{ color: '#78716c' }}>
                    {l.name}
                  </span>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={onNext}
            className="w-full mt-4 py-3 rounded-full text-lg font-bold text-white shadow"
            style={{ backgroundColor: '#c2571b' }}
          >
            {NEXT_LABEL[lang]}
          </button>
        </div>
      </div>
    </motion.div>
  )
}
