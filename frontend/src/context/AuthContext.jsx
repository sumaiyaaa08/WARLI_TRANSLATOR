// AuthContext.jsx — Learner accounts (signup / login / logout).
// Session (token + public user) persists in localStorage under "warli_auth".
// Progress SYNC lives in ProgressContext; this file only owns identity.

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'
const STORAGE_KEY = 'warli_auth'

function joinUrl(path) {
  return `${BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}

async function handle(res) {
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.detail || body.error || `${res.status} ${res.statusText}`)
  return body
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { token: null, user: null }
    const parsed = JSON.parse(raw)
    if (!parsed?.token) return { token: null, user: null }
    return { token: parsed.token, user: parsed.user || null }
  } catch {
    return { token: null, user: null }
  }
}

const AuthContext = createContext({
  token: null,
  user: null,
  login: async () => {},
  signup: async () => {},
  logout: () => {},
})

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(loadFromStorage)

  useEffect(() => {
    try {
      if (auth.token) localStorage.setItem(STORAGE_KEY, JSON.stringify(auth))
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      // storage unavailable; session simply won't persist
    }
  }, [auth])

  const login = useCallback(async (username, password) => {
    const res = await fetch(joinUrl('/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await handle(res)
    setAuth({ token: data.token, user: data.user })
    return data.user
  }, [])

  const signup = useCallback(async (username, password, displayName) => {
    const res = await fetch(joinUrl('/auth/signup'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password,
        display_name: displayName || undefined,
      }),
    })
    const data = await handle(res)
    setAuth({ token: data.token, user: data.user })
    return data.user
  }, [])

  const logout = useCallback(() => {
    const token = loadFromStorage().token
    if (token) {
      fetch(joinUrl('/auth/logout'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {})
    }
    setAuth({ token: null, user: null })
  }, [])

  return (
    <AuthContext.Provider value={{ token: auth.token, user: auth.user, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

export default AuthContext
