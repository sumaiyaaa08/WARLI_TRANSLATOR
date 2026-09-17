// WordsPage.jsx — The Warli wordbook: search the full 2,178-word dictionary.
// Uses GET /api/dictionary for lookup and /api/learning/pronounce to hear
// any word. This is how learners go beyond lessons to the whole language.

import { useEffect, useRef, useState } from 'react'
import { Volume2, Search } from 'lucide-react'
import Navbar from '../components/layout/Navbar'
import GameHeader from '../components/layout/GameHeader'
import { getPronounce, base64ToAudioUrl } from '../api/learning'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

function joinUrl(path) {
  return `${BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}

async function searchDictionary(q) {
  const params = new URLSearchParams({ limit: '60' })
  if (q.trim()) params.set('q', q.trim())
  const res = await fetch(joinUrl(`/dictionary?${params.toString()}`))
  if (!res.ok) throw new Error(`Search failed (${res.status})`)
  return res.json()
}

function WordCard({ entry }) {
  const [playing, setPlaying] = useState(false)

  async function speak() {
    if (playing) return
    setPlaying(true)
    try {
      const data = await getPronounce(entry.warli)
      const url = base64ToAudioUrl(data.audio_base64, data.audio_mime)
      const audio = new Audio(url)
      audio.onended = () => setPlaying(false)
      await audio.play().catch(() => setPlaying(false))
    } catch {
      setPlaying(false)
    }
  }

  return (
    <div
      className="rounded-2xl p-4 shadow-sm flex items-center gap-3"
      style={{ backgroundColor: 'white', border: '1px solid #f5f5f4' }}
    >
      <div className="flex-1 min-w-0">
        <p
          className="text-xl font-bold leading-tight"
          style={{ color: '#1c1917', fontFamily: '"Baloo 2", system-ui, sans-serif' }}
        >
          {entry.warli}
        </p>
        {entry.roman && (
          <p className="text-xs" style={{ color: '#a8a29e' }}>{entry.roman}</p>
        )}
        <p className="text-sm mt-1 truncate" style={{ color: '#57534e' }}>
          {[entry.en, entry.hi].filter(Boolean).join(' • ')}
        </p>
        {entry.pos && (
          <span
            className="inline-block mt-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
            style={{ backgroundColor: '#fef3e8', color: '#c2571b' }}
          >
            {entry.pos}
          </span>
        )}
      </div>
      <button
        onClick={speak}
        disabled={playing}
        aria-label={`Hear ${entry.warli}`}
        className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-white shadow"
        style={{ backgroundColor: playing ? '#d6d3d1' : '#c2571b' }}
      >
        <Volume2 size={20} />
      </button>
    </div>
  )
}

export default function WordsPage() {
  const [query, setQuery] = useState('')
  const [entries, setEntries] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const debounceRef = useRef(null)

  function runSearch(q) {
    setLoading(true)
    setError(null)
    searchDictionary(q)
      .then(data => {
        setEntries(data.entries || [])
        setTotal(data.count ?? 0)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message || 'Search failed.')
        setLoading(false)
      })
  }

  // Initial load (browse first 60 words)
  useEffect(() => { runSearch('') }, [])

  function handleChange(value) {
    setQuery(value)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(value), 450)
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#fef9f0' }}>
      <Navbar />
      <GameHeader />

      <div className="max-w-md mx-auto px-4 pt-4 pb-12">
        <h1
          className="text-3xl font-bold"
          style={{ color: '#1c1917', fontFamily: '"Baloo 2", system-ui, sans-serif' }}
        >
          📖 Wordbook
        </h1>
        <p className="text-sm mt-1 mb-4" style={{ color: '#78716c' }}>
          The whole dictionary — search English, Hindi or Warli, tap 🔊 to hear a word.
        </p>

        {/* Search box */}
        <div
          className="flex items-center gap-2 rounded-full px-4 py-3 mb-2 shadow-sm"
          style={{ backgroundColor: 'white', border: '2px solid #e7e5e4' }}
        >
          <Search size={18} style={{ color: '#a8a29e' }} />
          <input
            value={query}
            onChange={e => handleChange(e.target.value)}
            placeholder="Search: water, पाणी, love…"
            aria-label="Search the dictionary"
            className="flex-1 outline-none text-base bg-transparent"
            style={{ color: '#1c1917' }}
          />
          {query && (
            <button
              onClick={() => { setQuery(''); runSearch('') }}
              aria-label="Clear search"
              className="text-stone-400 font-bold"
            >
              ✕
            </button>
          )}
        </div>
        <p className="text-xs mb-4 px-1" style={{ color: '#a8a29e' }}>
          {loading ? 'Searching…' : `${entries.length} shown${total ? ` (of ${total} matches)` : ''}`}
        </p>

        {error && (
          <div className="text-center mt-8">
            <p className="text-stone-600 mb-4">{error}</p>
            <button
              onClick={() => runSearch(query)}
              className="px-6 py-3 rounded-full font-semibold text-white"
              style={{ backgroundColor: '#c2571b' }}
            >
              Retry
            </button>
          </div>
        )}

        {!error && (
          <div className="flex flex-col gap-3">
            {entries.map((e, i) => (
              <WordCard key={`${e.warli}-${i}`} entry={e} />
            ))}
            {!loading && entries.length === 0 && (
              <p className="text-center text-stone-500 mt-8">
                No words found — try another spelling.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
