import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { getLearningPath } from '../api/learning'
import GameHeader from '../components/layout/GameHeader'
import Navbar from '../components/layout/Navbar'
import LearningMap from '../components/learn/LearningMap'
import { WarliDivider } from '../components/WarliArt'
import { useProgress } from '../context/ProgressContext'

// ── Language path cards ─────────────────────────────────────────────────────
// Santali first (primary), Warli second. Progress counts come from the loaded
// paths; completedLessons is global (lesson IDs are unique per language).

const PATHS = [
  {
    code: 'santali',
    name: 'Santali',
    native: 'ᱥᱟᱱᱛᱟᱲᱤ',
    tagline: 'Johar! Script → words → everyday talk',
    activeBg: '#c2571b',
  },
  {
    code: 'warli',
    name: 'Warli',
    native: 'वारली',
    tagline: 'First words → sentences → village life',
    activeBg: '#1c1917',
  },
]

function countDone(units, completedLessons) {
  const ids = units.flatMap(u => u.lessons.map(l => l.id))
  const done = ids.filter(id => completedLessons.includes(id)).length
  return { done, total: ids.length }
}

export default function LearnPage() {
  const { completedLessons, learnTarget, setLearnTarget } = useProgress()
  const [paths, setPaths] = useState({ santali: null, warli: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  function fetchPaths() {
    setLoading(true)
    setError(null)
    Promise.all([getLearningPath('santali'), getLearningPath('warli')])
      .then(([sat, war]) => {
        setPaths({ santali: sat, warli: war })
        setLoading(false)
      })
      .catch(err => { setError(err.message || 'Failed to load curriculum.'); setLoading(false) })
  }

  useEffect(() => { fetchPaths() }, [])

  const activeUnits = paths[learnTarget]?.units || []
  const counts = {
    santali: paths.santali ? countDone(paths.santali.units, completedLessons) : null,
    warli: paths.warli ? countDone(paths.warli.units, completedLessons) : null,
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#fef9f0' }}>
      <Navbar />
      <GameHeader />

      <div className="px-4 pt-4 pb-5">
        <div
          className="max-w-md mx-auto rounded-3xl px-5 pt-5 pb-4 shadow-md text-center"
          style={{ backgroundColor: '#c2571b' }}
        >
          <h1 className="text-4xl font-bold" style={{ color: '#fdf5ea', fontFamily: '"Baloo 2", system-ui, sans-serif' }}>
            🌿 Linguify
          </h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(253,245,234,0.85)' }}>
            What do you want to learn today?
          </p>
          <div style={{ color: '#fdf5ea' }} aria-hidden="true">
            <WarliDivider />
          </div>
        </div>
      </div>

      {/* ── Language chooser ─────────────────────────────────────────── */}
      <div className="max-w-md mx-auto px-4 pt-3 pb-1 grid grid-cols-2 gap-3">
        {PATHS.map(p => {
          const active = learnTarget === p.code
          const c = counts[p.code]
          return (
            <motion.button
              key={p.code}
              onClick={() => setLearnTarget(p.code)}
              aria-pressed={active}
              className="rounded-3xl p-4 text-center shadow-sm"
              style={{
                backgroundColor: active ? p.activeBg : 'white',
                color: active ? '#fdf5ea' : '#1c1917',
                border: '2px solid',
                borderColor: active ? p.activeBg : '#e7e5e4',
              }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <span
                className="block text-2xl font-bold"
                style={{ fontFamily: '"Baloo 2", system-ui, sans-serif' }}
              >
                {p.native}
              </span>
              <span className="block text-sm font-bold mt-0.5">{p.name}</span>
              <span
                className="block text-[11px] mt-1 leading-snug"
                style={{ color: active ? 'rgba(253,245,234,0.8)' : '#a8a29e' }}
              >
                {p.tagline}
              </span>
              <span
                className="inline-block mt-2 rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                style={{
                  backgroundColor: active ? 'rgba(253,245,234,0.2)' : '#fef3e8',
                  color: active ? '#fdf5ea' : '#c2571b',
                }}
              >
                {loading ? '…' : c ? `${c.done}/${c.total} lessons` : ''}
              </span>
            </motion.button>
          )
        })}
      </div>

      <div className="max-w-md mx-auto px-8" style={{ color: '#c2571b' }} aria-hidden="true">
        <p className="text-center text-xs font-bold uppercase tracking-widest" style={{ color: '#a8a29e' }}>
          ↓ pick a language, then walk its trail ↓
        </p>
      </div>

      {loading && (
        <div className="flex flex-col items-center gap-4 mt-6">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-full max-w-md mx-4 h-20 rounded-2xl animate-pulse" style={{ backgroundColor: '#e7e5e4' }} aria-hidden="true" />
          ))}
        </div>
      )}
      {!loading && error && (
        <div className="flex flex-col items-center mt-10 px-4 text-center">
          <p className="text-stone-600 mb-4">{error}</p>
          <button onClick={fetchPaths} className="px-6 py-3 rounded-full font-semibold text-white" style={{ backgroundColor: '#c2571b' }}>
            Retry
          </button>
        </div>
      )}
      {!loading && !error && (
        <LearningMap units={activeUnits} completedLessons={completedLessons} />
      )}
    </div>
  )
}
