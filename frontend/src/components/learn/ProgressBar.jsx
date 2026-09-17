// ProgressBar.jsx — Lesson progress indicator (Duolingo-style top bar).
// Props: current (0-based index of active exercise), total (exercise count).

import { motion } from 'framer-motion'

export default function ProgressBar({ current = 0, total = 1 }) {
  const pct = total > 0 ? Math.min(100, Math.round(((current + 1) / total) * 100)) : 0

  return (
    <div className="w-full max-w-lg mx-auto px-4 pt-4" aria-label={`Exercise ${current + 1} of ${total}`}>
      <div
        className="h-3 rounded-full overflow-hidden"
        style={{ backgroundColor: '#e7e5e4' }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: '#22c55e' }}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}
