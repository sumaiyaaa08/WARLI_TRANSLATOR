// MatchPairs.jsx — Tap-to-match pairs exercise.
// Two columns: source words (left) and Warli words (right), both shuffled.

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

function fisherYates(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function MatchPairs({ exercise, onCorrect, onWrong }) {
  const [sourceCols, setSourceCols] = useState([])
  const [warliCols, setWarliCols] = useState([])
  const [selectedSource, setSelectedSource] = useState(null)
  const [selectedWarli, setSelectedWarli] = useState(null)
  const [matched, setMatched] = useState(new Set())
  const [mistakes, setMistakes] = useState(0)
  const [flashCorrect, setFlashCorrect] = useState(new Set())
  const [flashWrong, setFlashWrong] = useState(new Set())

  const pairs = exercise.pairs || []

  useEffect(() => {
    setSourceCols(fisherYates(pairs.map(p => p.source)))
    setWarliCols(fisherYates(pairs.map(p => p.warli)))
    setMatched(new Set())
    setMistakes(0)
    setSelectedSource(null)
    setSelectedWarli(null)
  }, [exercise.id])

  // Find the Warli equivalent for a source word
  function getWarliFor(source) {
    return pairs.find(p => p.source === source)?.warli
  }

  function handleSourceTap(source) {
    if (matched.has(source) || flashWrong.has(source)) return
    setSelectedSource(source)
  }

  function handleWarliTap(warli) {
    if (!selectedSource || flashWrong.has(warli)) return
    const expectedWarli = getWarliFor(selectedSource)

    if (warli === expectedWarli) {
      // Correct match
      const newMatched = new Set([...matched, selectedSource])
      setFlashCorrect(new Set([selectedSource, warli]))
      setTimeout(() => {
        setFlashCorrect(new Set())
        setMatched(newMatched)
        setSelectedSource(null)
        setSelectedWarli(null)

        if (newMatched.size === pairs.length) {
          if (mistakes === 0) onCorrect()
          else onWrong()
        }
      }, 400)
    } else {
      // Wrong match
      setFlashWrong(new Set([selectedSource, warli]))
      setMistakes(m => m + 1)
      setTimeout(() => {
        setFlashWrong(new Set())
        setSelectedSource(null)
        setSelectedWarli(null)
      }, 600)
    }
  }

  function getSourceStyle(source) {
    if (matched.has(source)) return { border: '2px solid #22c55e', background: '#f0fdf4', opacity: 0.5 }
    if (flashCorrect.has(source)) return { border: '2px solid #22c55e', background: '#f0fdf4' }
    if (flashWrong.has(source)) return { border: '2px solid #ef4444', background: '#fef2f2' }
    if (selectedSource === source) return { border: '2px solid #f97316', background: '#fff7ed' }
    return { border: '2px solid #e7e5e4', background: 'white' }
  }

  function getWarliStyle(warli) {
    const sourceForWarli = pairs.find(p => p.warli === warli)?.source
    if (matched.has(sourceForWarli)) return { border: '2px solid #22c55e', background: '#f0fdf4', opacity: 0.5 }
    if (flashCorrect.has(warli)) return { border: '2px solid #22c55e', background: '#f0fdf4' }
    if (flashWrong.has(warli)) return { border: '2px solid #ef4444', background: '#fef2f2' }
    return { border: '2px solid #e7e5e4', background: 'white' }
  }

  function isSourceMatched(source) {
    return matched.has(source)
  }

  function isWarliMatched(warli) {
    const sourceForWarli = pairs.find(p => p.warli === warli)?.source
    return matched.has(sourceForWarli)
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 gap-3">
        {/* Source column */}
        <div className="flex flex-col gap-2">
          {sourceCols.map(source => (
            <motion.button
              key={source}
              className="rounded-2xl p-3 text-base font-semibold text-center min-h-[56px] transition-colors"
              style={getSourceStyle(source)}
              onClick={() => handleSourceTap(source)}
              disabled={isSourceMatched(source)}
              animate={flashWrong.has(source) ? { x: [0, -6, 6, -6, 0] } : {}}
              transition={{ duration: 0.4 }}
              aria-pressed={selectedSource === source}
            >
              {source}
            </motion.button>
          ))}
        </div>

        {/* Warli column */}
        <div className="flex flex-col gap-2">
          {warliCols.map(warli => (
            <motion.button
              key={warli}
              className="rounded-2xl p-3 text-base font-semibold text-center min-h-[56px] transition-colors"
              style={getWarliStyle(warli)}
              onClick={() => handleWarliTap(warli)}
              disabled={isWarliMatched(warli)}
              animate={flashWrong.has(warli) ? { x: [0, -6, 6, -6, 0] } : {}}
              transition={{ duration: 0.4 }}
            >
              {warli}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  )
}
