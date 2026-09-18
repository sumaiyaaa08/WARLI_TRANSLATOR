// ProgressContext.jsx — Global gamification state (XP, streak, hearts, progress)
// Persisted in localStorage under the key "warli_progress".
// When logged in (see AuthContext), progress ALSO syncs to the server account:
// pull-on-login keeps the stronger record, then every change pushes (debounced).

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { getServerProgress, saveServerProgress } from '../api/learning'

const STORAGE_KEY = 'warli_progress'

const DEFAULT_STATE = {
  xp: 0,
  streak: 0,
  hearts: 5,
  lastPlayedDate: null,   // ISO date string "YYYY-MM-DD" or null
  completedLessons: [],   // string[] of lesson IDs
  uiLang: 'hi',           // 'en' | 'hi' | 'mr' — medium of instruction
  learnTarget: 'santali', // 'santali' (primary) | 'warli' — which language path
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
  syncStatus: 'local', // 'local' | 'syncing' | 'synced' | 'error'
  addXp: (_amount) => {},
  loseHeart: () => {},
  resetHearts: () => {},
  completeLesson: (_lessonId) => {},
  checkDayRollover: () => {},
  setUiLang: (_lang) => {},
  setLearnTarget: (_target) => {},
})

// ── Provider ──────────────────────────────────────────────────────────────────

export function ProgressProvider({ children }) {
  const { token } = useAuth()
  const [state, setState] = useState(loadFromStorage)
  const [syncStatus, setSyncStatus] = useState('local')
  const lastPushedRef = useRef(null)   // JSON snapshot of last server-confirmed state
  const pulledTokenRef = useRef(null)  // token already pulled for (prevents re-pull loops)

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

  // ── Cloud sync ────────────────────────────────────────────────────────────

  /** The exact fields the server stores (excludes sync bookkeeping). */
  function snapshot(s) {
    return {
      xp: s.xp,
      streak: s.streak,
      hearts: s.hearts,
      completed_lessons: s.completedLessons,
      uiLang: s.uiLang,
      lastPlayedDate: s.lastPlayedDate,
    }
  }

  // Pull once per login: keep whichever record learned MORE (more lessons,
  // tie-break on XP). The loser is overwritten on the next push.
  useEffect(() => {
    if (!token) {
      pulledTokenRef.current = null
      setSyncStatus('local')
      return
    }
    if (pulledTokenRef.current === token) return
    pulledTokenRef.current = token
    setSyncStatus('syncing')
    getServerProgress(token)
      .then(server => {
        setState(prev => {
          const sCount = (server.completed_lessons || []).length
          const pCount = (prev.completedLessons || []).length
          const serverWins =
            sCount > pCount || (sCount === pCount && (server.xp || 0) > prev.xp)
          const merged = serverWins
            ? {
                ...prev,
                xp: server.xp ?? prev.xp,
                streak: server.streak ?? prev.streak,
                hearts: server.hearts ?? prev.hearts,
                completedLessons: server.completed_lessons ?? prev.completedLessons,
                uiLang: ['en', 'hi', 'mr'].includes(server.uiLang) ? server.uiLang : prev.uiLang,
                lastPlayedDate: server.lastPlayedDate ?? prev.lastPlayedDate,
              }
            : prev
          lastPushedRef.current = JSON.stringify(snapshot(merged))
          return merged
        })
        setSyncStatus('synced')
      })
      .catch(() => setSyncStatus('error'))
  }, [token])

  // Push every change (debounced) while logged in.
  useEffect(() => {
    if (!token) return
    const snap = JSON.stringify(snapshot(state))
    if (lastPushedRef.current === snap) return  // already on the server (or just pulled)
    setSyncStatus('syncing')
    const timer = setTimeout(() => {
      saveServerProgress(token, { ...JSON.parse(snap), updated_at: new Date().toISOString() })
        .then(() => {
          lastPushedRef.current = snap
          setSyncStatus('synced')
        })
        .catch(() => setSyncStatus('error'))
    }, 1500)
    return () => clearTimeout(timer)
  }, [state, token])

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

  /** Set which language path to learn ('santali' | 'warli'). */
  function setLearnTarget(target) {
    if (!['santali', 'warli'].includes(target)) return
    setState((prev) => ({ ...prev, learnTarget: target }))
  }

  // ── Context value ───────────────────────────────────────────────────────────

  const value = {
    xp: state.xp,
    streak: state.streak,
    hearts: state.hearts,
    lastPlayedDate: state.lastPlayedDate,
    completedLessons: state.completedLessons,
    uiLang: state.uiLang || 'hi',
    learnTarget: state.learnTarget || 'santali',
    syncStatus,
    addXp,
    loseHeart,
    resetHearts,
    completeLesson,
    checkDayRollover,
    setUiLang,
    setLearnTarget,
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
