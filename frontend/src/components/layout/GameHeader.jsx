// GameHeader.jsx — Status bar: day streak, star balance, heart meter.
// Reads live gamification state from ProgressContext.

import { useProgress } from '../../context/ProgressContext'
import HeartIndicator from '../learn/HeartIndicator'

export default function GameHeader() {
  const { xp, streak, hearts } = useProgress()

  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-center gap-6 px-4 py-2 border-b border-stone-200"
      style={{ backgroundColor: '#fef9f0' }}
      aria-label="Progress status"
    >
      <span
        className="text-sm font-bold"
        style={{ color: streak > 0 ? '#f97316' : '#a8a29e' }}
        title="Day streak"
      >
        🔥 {streak}
      </span>
      <span
        className="text-sm font-bold"
        style={{ color: '#f97316' }}
        title="Star balance"
      >
        ★ {xp}
      </span>
      <span aria-live="polite">
        <HeartIndicator hearts={hearts} />
      </span>
    </header>
  )
}
