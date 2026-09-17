// LessonNode.jsx — One lesson card on the journey trail.
// Status: 'locked' (stone, no entry), 'unlocked' (terracotta, inviting),
// 'completed' (leaf-green seal). Shows the lesson title in the learner's
// language, the English subtitle, and the star reward.

import { motion } from 'framer-motion'
import { useProgress } from '../../context/ProgressContext'

const MEDALLIONS = {
  locked: { icon: '🔒', bg: '#e7e5e4', fg: '#a8a29e' },
  unlocked: { icon: '▶', bg: '#c2571b', fg: '#fdf5ea' },
  completed: { icon: '✓', bg: '#22c55e', fg: '#ffffff' },
}

export default function LessonNode({ lesson, status, onClick }) {
  const { uiLang } = useProgress()
  const displayTitle =
    uiLang === 'mr'
      ? (lesson.title_mr || lesson.title_hi)
      : uiLang === 'en'
        ? lesson.title_en
        : lesson.title_hi

  const medallion = MEDALLIONS[status] || MEDALLIONS.locked
  const clickable = status === 'unlocked' || status === 'completed'

  const edgeColor =
    status === 'completed' ? '#22c55e' : status === 'unlocked' ? '#c2571b' : '#d6d3d1'

  return (
    <motion.button
      onClick={() => { if (clickable) onClick?.() }}
      disabled={!clickable}
      className="w-full flex items-center gap-3 rounded-2xl p-3 text-left border-l-4 shadow-sm"
      style={{
        backgroundColor: '#ffffff',
        borderColor: edgeColor,
        borderTop: '1px solid #f5f5f4',
        borderRight: '1px solid #f5f5f4',
        borderBottom: '1px solid #f5f5f4',
        opacity: status === 'locked' ? 0.75 : 1,
        cursor: clickable ? 'pointer' : 'not-allowed',
      }}
      whileHover={clickable ? { scale: 1.02, x: 2 } : {}}
      whileTap={clickable ? { scale: 0.98 } : {}}
      aria-label={`${lesson.title_en} — ${status}`}
    >
      {/* Status medallion */}
      <span
        className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold"
        style={{ backgroundColor: medallion.bg, color: medallion.fg }}
        aria-hidden="true"
      >
        {medallion.icon}
      </span>

      {/* Titles */}
      <span className="flex-1 min-w-0">
        <span
          className="block font-bold leading-tight truncate"
          style={{
            color: status === 'locked' ? '#a8a29e' : '#1c1917',
            fontFamily: '"Baloo 2", system-ui, sans-serif',
          }}
        >
          {displayTitle}
        </span>
        {uiLang !== 'en' && (
          <span className="block text-xs truncate" style={{ color: '#a8a29e' }}>
            {lesson.title_en}
          </span>
        )}
        <span
          className="inline-block mt-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
          style={{ backgroundColor: '#fef3e8', color: '#c2571b' }}
        >
          ★ {lesson.xp_reward}
        </span>
      </span>

      {/* Chevron for enterable lessons */}
      {clickable && (
        <span className="shrink-0 text-xl font-bold" style={{ color: '#d6d3d1' }} aria-hidden="true">
          ›
        </span>
      )}
    </motion.button>
  )
}
