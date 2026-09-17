// TeacherDashboard.jsx — Educator analytics dashboard (Phase 3).
// Shows classroom KPIs, lesson score chart, student table, and struggle areas.

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { getClassroom } from '../api/learning'
import Navbar from '../components/layout/Navbar'

export default function TeacherDashboard() {
  const [classroom, setClassroom] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sortBy, setSortBy] = useState('xp') // 'xp' | 'name'

  function fetchClassroom() {
    setLoading(true)
    setError(null)
    getClassroom()
      .then(data => { setClassroom(data); setLoading(false) })
      .catch(err => { setError(err.message || 'Failed to load classroom data.'); setLoading(false) })
  }

  useEffect(() => { fetchClassroom() }, [])

  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#fef9f0' }}>
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col gap-4 w-full max-w-2xl px-6">
            <div className="h-24 bg-stone-200 rounded-2xl animate-pulse" />
            <div className="h-64 bg-stone-200 rounded-2xl animate-pulse" />
            <div className="h-48 bg-stone-200 rounded-2xl animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#fef9f0' }}>
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh] text-center px-4">
          <div>
            <p className="text-xl font-semibold text-stone-700 mb-4">{error}</p>
            <button
              onClick={fetchClassroom}
              className="px-6 py-3 rounded-full font-semibold text-white"
              style={{ backgroundColor: '#f97316' }}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  const students = classroom?.students || []
  const lessonStats = classroom?.lesson_stats || []
  const struggleLessons = lessonStats.filter(s => s.avg_score_pct < 60 && s.attempts > 0)

  // Sort students
  const sortedStudents = [...students].sort((a, b) => {
    if (sortBy === 'xp') return b.xp - a.xp
    return a.name.localeCompare(b.name)
  })

  // Chart data
  const chartData = lessonStats.map(s => ({
    name: s.lesson_id.replace('lesson_0', 'L'),
    score: s.avg_score_pct,
  }))

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#fef9f0' }}>
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Dashboard title */}
        <div className="mb-6">
          <h1
            className="text-3xl font-bold"
            style={{ color: '#1c1917', fontFamily: '"Baloo 2", system-ui, sans-serif' }}
          >
            📊 Teacher Dashboard
          </h1>
          <p className="text-sm mt-1" style={{ color: '#78716c' }}>{classroom?.class_name}</p>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-4 shadow-sm text-center border border-stone-100">
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#78716c' }}>Avg. XP</p>
            <p className="text-4xl font-bold" style={{ color: '#f97316', fontFamily: '"Baloo 2", system-ui, sans-serif' }}>
              {classroom?.avg_class_xp ?? 0}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm text-center border border-stone-100">
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#78716c' }}>Students</p>
            <p className="text-4xl font-bold" style={{ color: '#1c1917', fontFamily: '"Baloo 2", system-ui, sans-serif' }}>
              {students.length}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm text-center border border-stone-100">
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#78716c' }}>Struggles</p>
            <p className="text-4xl font-bold" style={{ color: struggleLessons.length > 0 ? '#ef4444' : '#22c55e', fontFamily: '"Baloo 2", system-ui, sans-serif' }}>
              {struggleLessons.length}
            </p>
          </div>
        </div>

        {/* Bar Chart — hidden on mobile, replaced by table */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-100 mb-6">
          <h2 className="font-semibold text-stone-700 mb-3">Lesson Scores (%)</h2>
          {/* Chart — visible sm and above */}
          <div className="hidden sm:block">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => [`${v}%`, 'Score']} />
                <Bar dataKey="score" radius={[4,4,0,0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.score >= 60 ? '#22c55e' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Fallback table — visible on mobile only */}
          <div className="block sm:hidden overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="py-2 pr-4 font-semibold text-stone-600">Lesson</th>
                  <th className="py-2 font-semibold text-stone-600">Score</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((row, i) => (
                  <tr key={i} className="border-t border-stone-100">
                    <td className="py-2 pr-4">{row.name}</td>
                    <td className="py-2" style={{ color: row.score >= 60 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                      {row.score}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Struggle Areas panel */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-100 mb-6">
          <h2 className="font-semibold text-stone-700 mb-3">Struggle Areas</h2>
          {struggleLessons.length === 0 ? (
            <div className="rounded-xl p-3 text-center" style={{ backgroundColor: '#f0fdf4', color: '#15803d' }}>
              🎉 No struggle areas — great class progress!
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {struggleLessons.map(s => (
                <div
                  key={s.lesson_id}
                  className="flex items-center justify-between rounded-xl p-3 border"
                  style={{ borderColor: '#ef4444', backgroundColor: '#fff1f2' }}
                >
                  <span className="font-semibold text-stone-700">{s.lesson_id.replace('_', ' ')}</span>
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-bold text-white"
                      style={{ backgroundColor: '#ef4444' }}
                    >
                      {s.avg_score_pct}%
                    </span>
                    {s.struggle_exercise_ids.length > 0 && (
                      <span className="text-xs" style={{ color: '#78716c' }}>
                        {s.struggle_exercise_ids.length} exercise{s.struggle_exercise_ids.length > 1 ? 's' : ''} struggling
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Student Table */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-stone-700">Students</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setSortBy('xp')}
                className="px-3 py-1 rounded-full text-xs font-semibold"
                style={{
                  backgroundColor: sortBy === 'xp' ? 'rgba(249,115,22,0.12)' : 'transparent',
                  color: sortBy === 'xp' ? '#f97316' : '#78716c',
                  border: '1px solid',
                  borderColor: sortBy === 'xp' ? '#f97316' : '#e7e5e4',
                }}
              >
                Sort by XP
              </button>
              <button
                onClick={() => setSortBy('name')}
                className="px-3 py-1 rounded-full text-xs font-semibold"
                style={{
                  backgroundColor: sortBy === 'name' ? 'rgba(249,115,22,0.12)' : 'transparent',
                  color: sortBy === 'name' ? '#f97316' : '#78716c',
                  border: '1px solid',
                  borderColor: sortBy === 'name' ? '#f97316' : '#e7e5e4',
                }}
              >
                Sort by Name
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className="py-2 pr-4 font-semibold text-stone-600">Name</th>
                  <th className="py-2 pr-4 font-semibold text-stone-600">XP</th>
                  <th className="py-2 pr-4 font-semibold text-stone-600">Streak 🔥</th>
                  <th className="py-2 font-semibold text-stone-600">Lessons Done</th>
                </tr>
              </thead>
              <tbody>
                {sortedStudents.map(s => (
                  <tr key={s.id} className="border-t border-stone-50 hover:bg-stone-50">
                    <td className="py-2 pr-4 font-medium text-stone-800">{s.name}</td>
                    <td className="py-2 pr-4 font-bold" style={{ color: '#f97316' }}>{s.xp}</td>
                    <td className="py-2 pr-4 text-stone-600">{s.streak}</td>
                    <td className="py-2 text-stone-600">{s.completed_lessons.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
