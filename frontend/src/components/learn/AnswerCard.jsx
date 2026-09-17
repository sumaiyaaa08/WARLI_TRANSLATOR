// AnswerCard.jsx — "Guru Card": the village teacher's feedback after an answer.
// An ORIGINAL design for Warli Seekho (not a Duolingo footer): a floating
// paper card framed by Warli triangle borders, with a tarpa-dance divider,
// a praise/encouragement line in the learner's language (EN/HI/MR), the
// Warli word revealed on mistakes, and Next / Try-again actions.

import { motion } from 'framer-motion'
import { WarliBorder, WarliDivider } from '../WarliArt'

const COPY = {
  en: {
    praise: ['Brilliant!', 'Shabash!', 'Lovely!', 'Well done!'],
    wrongTitle: 'Not quite…',
    wordLabel: 'The Warli word',
    generic: 'Look at the matches above.',
    xpSuffix: 'stars',
    next: 'Next →',
    retry: '↻ Try again',
  },
  hi: {
    praise: ['शाबाश!', 'बहुत बढ़िया!', 'सुंदर!', 'बहुत खूब!'],
    wrongTitle: 'अरे…',
    wordLabel: 'Warli शब्द',
    generic: 'ऊपर के जोड़ों को देखो।',
    xpSuffix: 'तारे',
    next: 'आगे →',
    retry: '↻ फिर से',
  },
  mr: {
    praise: ['शाब्बास!', 'छान!', 'सुंदर!', 'फार छान!'],
    wrongTitle: 'अरे…',
    wordLabel: 'वारली शब्द',
    generic: 'वरच्या जोड्या पाहा.',
    xpSuffix: 'तारे',
    next: 'पुढे →',
    retry: '↻ पुन्हा',
  },
}

export default function AnswerCard({ ok, xp = 0, answer = null, uiLang = 'hi', onNext, onRetry }) {
  const t = COPY[uiLang] || COPY.hi
  // Vary the praise line with earned XP so repeat visitors see variety.
  const praise = t.praise[xp % t.praise.length]

  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(28, 25, 23, 0.45)', backdropFilter: 'blur(2px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="w-full max-w-sm overflow-hidden rounded-3xl shadow-2xl"
        style={{ backgroundColor: '#fffdf7', border: '2px solid #e7e5e4' }}
        initial={{ scale: 0.85, y: 28 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 16, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        role="dialog"
        aria-live="polite"
        aria-label={ok ? praise : t.wrongTitle}
      >
        {/* Top Warli triangle border */}
        <div style={{ color: ok ? '#22c55e' : '#c2571b' }}>
          <WarliBorder />
        </div>

        <div className="px-6 pt-2 pb-5 text-center">
          {/* Tarpa dance divider */}
          <div style={{ color: ok ? '#22c55e' : '#c2571b' }}>
            <WarliDivider />
          </div>

          <h2
            className="text-3xl font-bold mt-1 mb-1"
            style={{
              color: ok ? '#15803d' : '#9a3412',
              fontFamily: '"Baloo 2", system-ui, sans-serif',
            }}
          >
            {ok ? praise : t.wrongTitle}
          </h2>

          {ok ? (
            <p className="text-base font-bold mb-4" style={{ color: '#f97316' }}>
              ★ +{xp} {t.xpSuffix}
            </p>
          ) : (
            <div
              className="rounded-2xl px-4 py-3 mb-4"
              style={{ backgroundColor: '#fff7ed', border: '2px dashed #c2571b' }}
            >
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#9a3412' }}>
                {t.wordLabel}
              </p>
              <p
                className="text-2xl font-bold text-stone-800 leading-snug"
                style={{ fontFamily: '"Baloo 2", system-ui, sans-serif' }}
              >
                {answer || '—'}
              </p>
              {!answer && (
                <p className="text-xs mt-1" style={{ color: '#78716c' }}>{t.generic}</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <motion.button
              onClick={onNext}
              className="w-full py-3 rounded-full text-lg font-bold text-white shadow"
              style={{ backgroundColor: ok ? '#22c55e' : '#c2571b' }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              {t.next}
            </motion.button>
            {!ok && (
              <button
                onClick={onRetry}
                className="w-full py-2 rounded-full text-sm font-bold"
                style={{ color: '#c2571b', border: '2px solid #e7e5e4', background: 'white' }}
              >
                {t.retry}
              </button>
            )}
          </div>
        </div>

        {/* Bottom Warli triangle border (flipped) */}
        <div style={{ color: ok ? '#22c55e' : '#c2571b', transform: 'rotate(180deg)' }}>
          <WarliBorder />
        </div>
      </motion.div>
    </motion.div>
  )
}
