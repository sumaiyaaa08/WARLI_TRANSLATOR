// HeartIndicator.jsx — Small hearts display (e.g. 3/5).
// Reads hearts from ProgressContext when no explicit prop is given.

import { useProgress } from '../../context/ProgressContext'

const MAX_HEARTS = 5

export default function HeartIndicator({ hearts: heartsProp, max = MAX_HEARTS }) {
  const { hearts: heartsCtx } = useProgress()
  const hearts = heartsProp ?? heartsCtx

  return (
    <span
      className="inline-flex items-center gap-0.5 text-sm font-bold"
      style={{ color: hearts > 0 ? '#ef4444' : '#a8a29e' }}
      title={`${hearts}/${max} hearts`}
      aria-label={`${hearts} of ${max} hearts remaining`}
    >
      {Array.from({ length: max }, (_, i) => (
        <span key={i} aria-hidden="true" style={{ opacity: i < hearts ? 1 : 0.25 }}>
          ❤️
        </span>
      ))}
    </span>
  )
}
