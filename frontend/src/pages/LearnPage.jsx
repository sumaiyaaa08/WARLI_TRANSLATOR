import { useEffect, useState } from 'react'
import { getLearningPath } from '../api/learning'
import GameHeader from '../components/layout/GameHeader'
import Navbar from '../components/layout/Navbar'
import LearningMap from '../components/learn/LearningMap'
import { useProgress } from '../context/ProgressContext'

export default function LearnPage() {
  const { completedLessons } = useProgress()
  const [units, setUnits] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  function fetchPath() {
    setLoading(true)
    setError(null)
    getLearningPath()
      .then(data => { setUnits(data.units || []); setLoading(false) })
      .catch(err => { setError(err.message || 'Failed to load curriculum.'); setLoading(false) })
  }

  useEffect(() => { fetchPath() }, [])

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#fef9f0' }}>
      <Navbar />
      <GameHeader />
      <div className="px-4 pt-4 pb-2 text-center">
        <h1 className="text-4xl font-bold" style={{ color: '#1c1917', fontFamily: '"Baloo 2", system-ui, sans-serif' }}>
          🌿 Warli Seekho
        </h1>
        <p className="text-sm mt-1" style={{ color: '#78716c' }}>Learn Warli — one lesson at a time</p>
      </div>
      {loading && (
        <div className="flex flex-col items-center gap-4 mt-8">
          {[0,1,2].map(i => (
            <div key={i} className="w-20 h-20 rounded-full animate-pulse" style={{ backgroundColor: '#e7e5e4' }} aria-hidden="true" />
          ))}
        </div>
      )}
      {!loading && error && (
        <div className="flex flex-col items-center mt-12 px-4 text-center">
          <p className="text-stone-600 mb-4">{error}</p>
          <button onClick={fetchPath} className="px-6 py-3 rounded-full font-semibold text-white" style={{ backgroundColor: '#f97316' }}>
            Retry
          </button>
        </div>
      )}
      {!loading && !error && (
        <LearningMap units={units} completedLessons={completedLessons} />
      )}
    </div>
  )
}
