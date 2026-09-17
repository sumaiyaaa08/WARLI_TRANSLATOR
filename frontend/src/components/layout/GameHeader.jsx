// GameHeader.jsx — Status bar: day streak, star balance, heart meter.
// Reads live gamification state from ProgressContext.

import { useProgress } from '../../context/ProgressContext'
import HeartIndicator from '../learn/HeartIndicator'

export default function GameHeader() {
  const { xp, streak, hearts, syncStatus } = useProgress()

  const syncDot = {
    local: { bg: '#d6d3d1', label: 'Progress saved on this device only — log in to sync' },
    syncing: { bg: '#f59e0b', label: 'Syncing progress…' },
    synced: { bg: '#22c55e', label: 'Progress synced to your account' },
    error: { bg: '#ef4444', label: 'Sync failed — will retry' },
  }[syncStatus] || { bg: '#d6d3d1', label: 'Local progress' }

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
      <span
        className="w-2.5 h-2.5 rounded-full"
        style={{ backgroundColor: syncDot.bg }}
        title={syncDot.label}
        aria-label={syncDot.label}
      />
    </header>
  )
}
