// ExerciseCard.jsx — Wrapper that renders the correct exercise component.
// Applies an entry animation on each new exercise via Framer Motion.

import { motion } from 'framer-motion'
import MultipleChoice from './MultipleChoice'
import MatchPairs from './MatchPairs'
import ListenType from './ListenType'
import { useProgress } from '../../context/ProgressContext'

export default function ExerciseCard({ exercise, onCorrect, onWrong }) {
  const { uiLang } = useProgress()
  const primary = uiLang === 'mr'
    ? (exercise.prompt_mr || exercise.prompt_hi)
    : uiLang === 'en'
      ? exercise.prompt_en
      : exercise.prompt_hi
  const secondary = uiLang === 'en' ? null : exercise.prompt_en
  const tip = uiLang === 'mr'
    ? (exercise.tip_mr || exercise.tip_hi || exercise.tip_en)
    : uiLang === 'hi'
      ? (exercise.tip_hi || exercise.tip_en)
      : exercise.tip_en

  function renderExercise() {
    switch (exercise.type) {
      case 'multiple_choice':
        return <MultipleChoice exercise={exercise} onCorrect={onCorrect} onWrong={onWrong} />
      case 'match_pairs':
        return <MatchPairs exercise={exercise} onCorrect={onCorrect} onWrong={onWrong} />
      case 'listen_type':
        return <ListenType exercise={exercise} onCorrect={onCorrect} onWrong={onWrong} />
      default:
        return <p className="text-stone-500">Unknown exercise type: {exercise.type}</p>
    }
  }

  return (
    <motion.div
      className="w-full max-w-lg mx-auto px-4 py-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Prompt */}
      <div className="mb-4 text-center">
        <p className="text-xl font-semibold text-stone-800 mb-1">{primary}</p>
        {secondary && <p className="text-sm text-stone-500">{secondary}</p>}
      </div>

      {/* Grammar/vocab tip (only on exercises that carry one) */}
      {tip && (
        <div
          className="mb-4 rounded-2xl px-4 py-3 text-sm leading-relaxed"
          style={{ backgroundColor: '#fef3e8', border: '2px dashed #c2571b', color: '#7c2d12' }}
          role="note"
        >
          <span className="font-bold">💡 </span>{tip}
        </div>
      )}

      {/* Exercise content */}
      {renderExercise()}
    </motion.div>
  )
}
