// LearningMap.jsx — Vertical scrolling learning roadmap.
// Renders unit section headers with sticky positioning.
// Draws LessonNode components connected by vertical SVG lines.
// Computes lesson lock/unlock status based on completedLessons.

import { useNavigate } from 'react-router-dom'
import LessonNode from './LessonNode'
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

  const unitIcons = { wave: '👋', sun: '☀️', home: '🏠', star: '⭐' }

  return (
    <div className="w-full max-w-md mx-auto pb-12">
      {units.map((unit, unitIdx) => (
        <div key={unit.id} className="mb-6">
          {/* Sticky unit heading */}
          <div className="sticky top-[56px] z-30 bg-[#fef9f0]/90 backdrop-blur-sm py-2 px-4 border-b border-stone-100 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl" aria-hidden="true">
                {unitIcons[unit.icon] || '📚'}
              </span>
              <div>
                <p className="font-bold text-[#1c1917] leading-tight" style={{ fontFamily: '"Baloo 2", system-ui, sans-serif' }}>
                  {uiLang === 'mr' ? (unit.title_mr || unit.title_hi) : uiLang === 'en' ? unit.title_en : unit.title_hi}
                </p>
                <p className="text-xs text-[#78716c]">{unit.title_en}</p>
              </div>
            </div>
          </div>

          {/* Lesson nodes connected by vertical SVG lines */}
          <div className="flex flex-col items-center gap-0">
            {unit.lessons.map((lesson, lessonIdx) => {
              const status = getLessonStatus(lesson.id)
              const isLast = lessonIdx === unit.lessons.length - 1

              return (
                <div key={lesson.id} className="flex flex-col items-center">
                  <LessonNode
                    lesson={lesson}
                    status={status}
                    onClick={() => handleNodeClick(lesson.id, status)}
                  />
                  {/* Connector line to next node */}
                  {!isLast && (
                    <svg
                      width="4"
                      height="32"
                      viewBox="0 0 4 32"
                      aria-hidden="true"
                      className="my-1"
                    >
                      <line
                        x1="2" y1="0" x2="2" y2="32"
                        stroke="#e7e5e4"
                        strokeWidth="4"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                </div>
              )
            })}
          </div>

          {/* Connector line between units */}
          {unitIdx < units.length - 1 && (
            <div className="flex justify-center mt-2 mb-2">
              <svg width="4" height="24" viewBox="0 0 4 24" aria-hidden="true">
                <line
                  x1="2" y1="0" x2="2" y2="24"
                  stroke="#d6d3d1"
                  strokeWidth="4"
                  strokeDasharray="4 4"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
