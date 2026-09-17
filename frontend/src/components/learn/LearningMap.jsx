// LearningMap.jsx — The journey trail through Warli country.
// An ORIGINAL Warli Seekho design: each unit opens with a terracotta mural
// banner (white dance-chain divider), then its lessons wind down a dashed
// village trail as cards alternating left/right — not a row of circles.

import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import LessonNode from './LessonNode'
import { WarliDivider } from '../WarliArt'
import { useProgress } from '../../context/ProgressContext'

export default function LearningMap({ units, completedLessons }) {
  const navigate = useNavigate()
  const { uiLang } = useProgress()

  // Build a flat ordered list of all lesson IDs for prerequisite logic
  const allLessonIds = units.flatMap(unit =>
    unit.lessons.map(l => l.id)
  )

  function getLessonStatus(lessonId) {
    if (completedLessons.includes(lessonId)) return 'completed'
    const idx = allLessonIds.indexOf(lessonId)
    if (idx === 0) return 'unlocked'  // first lesson is always unlocked
    const prevId = allLessonIds[idx - 1]
    if (completedLessons.includes(prevId)) return 'unlocked'
    return 'locked'
  }

  function handleNodeClick(lessonId, status) {
    if (status === 'unlocked' || status === 'completed') {
      navigate(`/lesson/${lessonId}`)
    }
  }

  function unitTitle(unit) {
    return uiLang === 'mr'
      ? (unit.title_mr || unit.title_hi)
      : uiLang === 'en'
        ? unit.title_en
        : unit.title_hi
  }

  return (
    <div className="w-full max-w-md mx-auto pb-12 px-4">
      {units.map((unit) => {
        const done = unit.lessons.filter(l => completedLessons.includes(l.id)).length
        const total = unit.lessons.length

        return (
          <section key={unit.id} className="mb-8">
            {/* ── Mural banner ─────────────────────────────────────────── */}
            <motion.div
              className="rounded-3xl px-5 pt-4 pb-5 shadow-md relative overflow-hidden"
              style={{ backgroundColor: '#c2571b' }}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.35 }}
            >
              <div style={{ color: '#fdf5ea' }}>
                <WarliDivider />
              </div>
              <div className="flex items-end justify-between gap-3 mt-1">
                <div className="min-w-0">
                  <h2
                    className="text-2xl font-bold leading-tight"
                    style={{ color: '#fdf5ea', fontFamily: '"Baloo 2", system-ui, sans-serif' }}
                  >
                    {unitTitle(unit)}
                  </h2>
                  {uiLang !== 'en' && (
                    <p className="text-xs font-semibold" style={{ color: 'rgba(253,245,234,0.75)' }}>
                      {unit.title_en}
                    </p>
                  )}
                </div>
                <span
                  className="shrink-0 rounded-full px-3 py-1 text-xs font-bold"
                  style={{ backgroundColor: '#fdf5ea', color: '#9a3412' }}
                  aria-label={`${done} of ${total} lessons done`}
                >
                  {done === total ? `✓ ${done}/${total}` : `${done}/${total}`}
                </span>
              </div>
            </motion.div>

            {/* ── Winding trail of lesson cards ────────────────────────── */}
            <div className="relative flex flex-col gap-4 mt-4 mb-2 px-1">
              {/* dashed centre trail */}
              <div
                className="absolute top-2 bottom-2 left-1/2 -translate-x-1/2 border-l-2 border-dashed"
                style={{ borderColor: '#d8c3b2' }}
                aria-hidden="true"
              />
              {unit.lessons.map((lesson, lessonIdx) => {
                const status = getLessonStatus(lesson.id)
                const leftSide = lessonIdx % 2 === 0

                return (
                  <div
                    key={lesson.id}
                    className={`relative z-10 w-[84%] ${leftSide ? 'self-start' : 'self-end'}`}
                  >
                    <LessonNode
                      lesson={lesson}
                      status={status}
                      onClick={() => handleNodeClick(lesson.id, status)}
                    />
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
