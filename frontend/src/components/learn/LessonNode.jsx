// LessonNode.jsx — A single circular node on the Learning Map.
// Status: 'locked' (grey), 'unlocked' (orange, interactive), 'completed' (green + checkmark).
// Shows a completion ripple animation when status becomes 'completed'.

import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useProgress } from '../../context/ProgressContext'

export default function LessonNode({ lesson, status, onClick }) {
  const { uiLang } = useProgress()
  const displayTitle = uiLang === 'mr' ? (lesson.title_mr || lesson.title_hi) : uiLang === 'en' ? lesson.title_en : lesson.title_hi
  const [showRipple, setShowRipple] = useState(false)
  const prevStatusRef = useRef(status)

  // Trigger ripple when transitioning to completed
  useEffect(() => {
    if (prevStatusRef.current !== 'completed' && status === 'completed') {
      setShowRipple(true)
      const timer = setTimeout(() => setShowRipple(false), 700)
      return () => clearTimeout(timer)
    }
    prevStatusRef.current = status
  }, [status])

  const handleClick = () => {
    if (status === 'unlocked' || status === 'completed') {
      onClick?.()
    }
  }

  const baseClasses = 'relative w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold transition-all select-none'

  const statusClasses = {
    locked: 'bg-stone-300 text-stone-500 cursor-not-allowed',
    unlocked: 'bg-[#f97316] text-white shadow-lg cursor-pointer',
    completed: 'bg-[#22c55e] text-white cursor-pointer',
  }

  const nodeContent = {
    locked: '🔒',
    unlocked: displayTitle.charAt(0),
    completed: '✓',
  }

  if (status === 'unlocked') {
    return (
      <div className="flex flex-col items-center">
        <motion.button
          className={`${baseClasses} ${statusClasses.unlocked}`}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleClick}
          aria-label={`${lesson.title_en} — unlocked`}
        >
          {nodeContent.unlocked}
        </motion.button>
        <span className="text-xs text-stone-500 text-center mt-1 max-w-[80px] leading-tight">
          {displayTitle}
        </span>
      </div>
    )
  }

  if (status === 'completed') {
    return (
      <div className="flex flex-col items-center">
        <div className="relative">
          <button
            className={`${baseClasses} ${statusClasses.completed}`}
            onClick={handleClick}
            aria-label={`${lesson.title_en} — completed`}
          >
            <CheckCircle size={36} aria-hidden="true" />
          </button>
          {/* Completion ripple */}
          <AnimatePresence>
            {showRipple && (
              <motion.div
                className="absolute inset-0 rounded-full bg-[#22c55e] pointer-events-none"
                initial={{ scale: 1, opacity: 0.5 }}
                animate={{ scale: 2, opacity: 0 }}
                exit={{}}
                transition={{ duration: 0.6 }}
              />
            )}
          </AnimatePresence>
        </div>
        <span className="text-xs text-stone-500 text-center mt-1 max-w-[80px] leading-tight">
          {displayTitle}
        </span>
      </div>
    )
  }

  // Locked
  return (
    <div className="flex flex-col items-center">
      <div
        className={`${baseClasses} ${statusClasses.locked}`}
        role="img"
        aria-label={`${lesson.title_en} — locked`}
      >
        🔒
      </div>
      <span className="text-xs text-stone-400 text-center mt-1 max-w-[80px] leading-tight">
        {displayTitle}
      </span>
    </div>
  )
}
