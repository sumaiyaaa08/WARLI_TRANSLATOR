// ProgressContext.jsx — Global gamification state (XP, streak, hearts, progress)
// Persisted in localStorage under the key "warli_progress".

import { createContext, useContext, useEffect, useState } from 'react'

const STORAGE_KEY = 'warli_progress'

const DEFAULT_STATE = {
  xp: 0,
  streak: 0,
  hearts: 5,
  lastPlayedDate: null,   // ISO date string "YYYY-MM-DD" or null
  completedLessons: [],   // string[] of lesson IDs
  uiLang: 'hi',           // 'en' | 'hi' | 'mr' — medium of instruction
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Read and parse stored progress, falling back to DEFAULT_STATE on any error. */
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_STATE }
    const parsed = JSON.parse(raw)
    // Merge with defaults so any missing keys (e.g. new fields) are covered.
    return { ...DEFAULT_STATE, ...parsed }
  } catch {
    return { ...DEFAULT_STATE }
  }
}

/** Returns today's date as "YYYY-MM-DD" using UTC. */
function todayUTC() {
  return new Date().toISOString().slice(0, 10)
}

/** Returns yesterday's date as "YYYY-MM-DD" using UTC. */
function yesterdayUTC() {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

// ── Context ───────────────────────────────────────────────────────────────────

const ProgressContext = createContext({
  ...DEFAULT_STATE,
  addXp: (_amount) => {},
  loseHeart: () => {},
  resetHearts: () => {},
  completeLesson: (_lessonId) => {},
  checkDayRollover: () => {},
  setUiLang: (_lang) => {},
})

// ── Provider ──────────────────────────────────────────────────────────────────

export function ProgressProvider({ children }) {
  const [state, setState] = useState(loadFromStorage)

  // Persist every state change to localStorage.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // localStorage may be unavailable (e.g. private browsing quota exceeded).
    }
  }, [state])

  // On mount: check day rollover so streak / hearts are correct immediately.
  useEffect(() => {
    checkDayRollover()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Day rollover ────────────────────────────────────────────────────────────

  /**
   * Compare today's UTC date against lastPlayedDate.
   * - New day → reset hearts to 5.
   * - Last played yesterday → increment streak.
   * - Last played before yesterday → reset streak to 0.
   * - Same day → no-op.
   */
  function checkDayRollover() {
    const today = todayUTC()
    setState((prev) => {
      if (prev.lastPlayedDate === today) return prev   // already rolled over today

      const yesterday = yesterdayUTC()
      const newStreak =
        prev.lastPlayedDate === yesterday ? prev.streak + 1 : 0

      return {
        ...prev,
        streak: newStreak,
        hearts: 5,
        lastPlayedDate: today,
      }
    })
  }

  // ── Mutators ────────────────────────────────────────────────────────────────

  /** Add `amount` XP to the total. */
  function addXp(amount) {
    setState((prev) => ({ ...prev, xp: prev.xp + amount }))
  }

  /** Deduct one heart, minimum 0. */
  function loseHeart() {
    setState((prev) => ({ ...prev, hearts: Math.max(0, prev.hearts - 1) }))
  }

  /** Restore hearts to the maximum (5). */
  function resetHearts() {
    setState((prev) => ({ ...prev, hearts: 5 }))
  }

  /**
   * Mark a lesson as completed.
   * Adds `lessonId` to completedLessons only if not already present.
   */
  function completeLesson(lessonId) {
    setState((prev) => {
      if (prev.completedLessons.includes(lessonId)) return prev
      return {
        ...prev,
        completedLessons: [...prev.completedLessons, lessonId],
      }
    })
  }

  /** Set the medium of instruction ('en' | 'hi' | 'mr'). */
  function setUiLang(lang) {
    if (!['en', 'hi', 'mr'].includes(lang)) return
    setState((prev) => ({ ...prev, uiLang: lang }))
  }

  // ── Context value ───────────────────────────────────────────────────────────

  const value = {
    xp: state.xp,
    streak: state.streak,
    hearts: state.hearts,
    lastPlayedDate: state.lastPlayedDate,
    completedLessons: state.completedLessons,
    uiLang: state.uiLang || 'hi',
    addXp,
    loseHeart,
    resetHearts,
    completeLesson,
    checkDayRollover,
    setUiLang,
  }

  return (
    <ProgressContext.Provider value={value}>
      {children}
    </ProgressContext.Provider>
  )
}

// ── Custom hook ───────────────────────────────────────────────────────────────

/** Returns the ProgressContext value. Must be used inside <ProgressProvider>. */
export function useProgress() {
  return useContext(ProgressContext)
}

export default ProgressContext
