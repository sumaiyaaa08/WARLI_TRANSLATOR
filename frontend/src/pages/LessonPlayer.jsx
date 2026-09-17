// LessonPlayer.jsx — Full-screen lesson execution page.
// Sequences exercises, manages hearts/XP, and shows completion screen.

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getLesson } from '../api/learning'
import GameHeader from '../components/layout/GameHeader'
import ExerciseCard from '../components/learn/ExerciseCard'
import MascotHint from '../components/learn/MascotHint'
import ProgressBar from '../components/learn/ProgressBar'
import { useProgress } from '../context/ProgressContext'

export default function LessonPlayer() {
  const { lessonId } = useParams()
  const navigate = useNavigate()
  const { hearts, addXp, loseHeart, completeLesson } = useProgress()

  const [lesson, setLesson] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [hintsRemaining, setHintsRemaining] = useState(3)
  const [showComplete, setShowComplete] = useState(false)
  const [sessionXp, setSessionXp] = useState(0)
  const [showNoHearts, setShowNoHearts] = useState(false)

  // Track if we're in the middle of a heart-loss navigation to avoid double-fire
  const navigatingRef = useRef(false)

  // Redirect immediately if hearts are already 0 on mount
  useEffect(() => {
    if (hearts === 0) {
      navigate('/')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    getLesson(lessonId)
      .then(data => {
        if (!cancelled) {
          setLesson(data)
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message || 'Failed to load lesson.')
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [lessonId])

  const exercises = lesson?.exercises || []
  const exercise = exercises[currentIdx]

  function handleCorrect() {
    if (!lesson) return
    const xpPerExercise = Math.floor(lesson.xp_reward / Math.max(exercises.length, 1))
    addXp(xpPerExercise)
    setSessionXp(prev => prev + xpPerExercise)

    if (currentIdx + 1 < exercises.length) {
      setTimeout(() => setCurrentIdx(i => i + 1), 1000)
    } else {
      completeLesson(lessonId)
      setShowComplete(true)
    }
  }

  function handleWrong() {
    if (navigatingRef.current) return
    loseHeart()

    // Check if this was the last heart
    // Note: hearts from context hasn't updated yet (stale closure),
    // so we check hearts - 1
    if (hearts - 1 <= 0) {
      navigatingRef.current = true
      setShowNoHearts(true)
      setTimeout(() => navigate('/'), 2000)
    }
  }

  function handleHintUsed() {
    setHintsRemaining(h => Math.max(0, h - 1))
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#fef9f0' }}>
        <GameHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col gap-4 items-center">
            <div className="w-64 h-8 bg-stone-200 rounded-full animate-pulse" />
            <div className="w-full max-w-sm h-40 bg-stone-200 rounded-2xl animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (error || !lesson) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#fef9f0' }}>
        <GameHeader />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <p className="text-xl font-semibold text-stone-700 mb-4">
              {error || 'Lesson not found.'}
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 rounded-full font-semibold text-white"
              style={{ backgroundColor: '#f97316' }}
            >
              Back to Map
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Main lesson layout ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#fef9f0' }}>
      <GameHeader />
      <ProgressBar current={currentIdx} total={exercises.length} />

      <main className="flex-1 overflow-y-auto pb-32">
        <AnimatePresence mode="wait">
          {exercise && (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              onCorrect={handleCorrect}
              onWrong={handleWrong}
            />
          )}
        </AnimatePresence>
      </main>

      {/* Mascot hint — fixed position */}
      {exercise && (
        <MascotHint
          exercise={exercise}
          hintsRemaining={hintsRemaining}
          onUse={handleHintUsed}
        />
      )}

      {/* No-hearts modal */}
      <AnimatePresence>
        {showNoHearts && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-3xl p-8 text-center max-w-sm w-full shadow-2xl"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <p className="text-5xl mb-4">💔</p>
              <h2 className="text-xl font-bold text-stone-800 mb-2">No hearts left!</h2>
              <p className="text-stone-500">Come back tomorrow — hearts restore daily.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lesson Complete overlay */}
      <AnimatePresence>
        {showComplete && (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6"
            style={{ backgroundColor: '#fef9f0' }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            <motion.div
              className="text-center"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.4 }}
            >
              <p className="text-7xl mb-4">🎉</p>
              <h1
                className="text-4xl font-bold mb-2"
                style={{ color: '#f97316', fontFamily: '"Baloo 2", system-ui, sans-serif' }}
              >
                Lesson Complete!
              </h1>
              <p className="text-2xl font-semibold text-stone-600 mb-8">
                +{sessionXp} XP earned
              </p>
              <motion.button
                onClick={() => navigate('/')}
                className="px-10 py-4 rounded-full text-xl font-bold text-white shadow-lg"
                style={{ backgroundColor: '#f97316' }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Continue →
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
