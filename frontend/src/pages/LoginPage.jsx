// LoginPage.jsx — Learner signup / login for cloud progress tracking.
// On success the session token is stored by AuthContext and ProgressContext
// pulls the account's record (keeping whichever side learned more).

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/layout/Navbar'
import { WarliDivider } from '../components/WarliArt'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const navigate = useNavigate()
  const { token, login, signup } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (token) navigate('/')
  }, [token, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!username.trim() || !password) {
      setError('Enter a username and password.')
      return
    }
    setBusy(true)
    try {
      if (mode === 'signup') await signup(username.trim(), password, displayName.trim())
      else await login(username.trim(), password)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const inputStyle = {
    backgroundColor: 'white',
    border: '2px solid #e7e5e4',
    color: '#1c1917',
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#fef9f0' }}>
      <Navbar />

      <div className="max-w-sm mx-auto px-4 pt-10 pb-12">
        <div
          className="rounded-3xl overflow-hidden shadow-md"
          style={{ backgroundColor: '#fffdf7', border: '2px solid #e7e5e4' }}
        >
          <div className="px-6 pt-5 text-center" style={{ color: '#c2571b' }}>
            <WarliDivider />
            <h1
              className="text-3xl font-bold mt-1"
              style={{ color: '#1c1917', fontFamily: '"Baloo 2", system-ui, sans-serif' }}
            >
              {mode === 'signup' ? 'Join Linguify' : 'Welcome back'}
            </h1>
            <p className="text-sm mt-1" style={{ color: '#78716c' }}>
              {mode === 'signup'
                ? 'Create an account to save progress on any device.'
                : 'Log in to pick up your stars where you left off.'}
            </p>
          </div>

          {/* Mode tabs */}
          <div className="flex gap-2 px-6 mt-4" role="tablist" aria-label="Login or signup">
            {['login', 'signup'].map(m => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => { setMode(m); setError(null) }}
                className="flex-1 py-2 rounded-full text-sm font-bold"
                style={{
                  backgroundColor: mode === m ? '#c2571b' : 'transparent',
                  color: mode === m ? 'white' : '#78716c',
                  border: '2px solid',
                  borderColor: mode === m ? '#c2571b' : '#e7e5e4',
                }}
              >
                {m === 'login' ? 'Log in' : 'Sign up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-4 flex flex-col gap-3">
            <label className="text-sm font-bold" style={{ color: '#57534e' }}>
              Username
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. arjun_04"
                autoComplete="username"
                maxLength={20}
                className="mt-1 w-full rounded-2xl px-4 py-3 text-base outline-none"
                style={inputStyle}
              />
            </label>
            {mode === 'signup' && (
              <label className="text-sm font-bold" style={{ color: '#57534e' }}>
                Display name <span style={{ color: '#a8a29e' }}>(shown to teachers)</span>
                <input
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="e.g. Arjun"
                  autoComplete="nickname"
                  maxLength={40}
                  className="mt-1 w-full rounded-2xl px-4 py-3 text-base outline-none"
                  style={inputStyle}
                />
              </label>
            )}
            <label className="text-sm font-bold" style={{ color: '#57534e' }}>
              Password
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'Min. 4 characters' : 'Your password'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                className="mt-1 w-full rounded-2xl px-4 py-3 text-base outline-none"
                style={inputStyle}
              />
            </label>

            {error && (
              <p
                className="rounded-2xl px-4 py-2 text-sm font-semibold"
                style={{ backgroundColor: '#fef2f2', color: '#b91c1c', border: '2px solid #ef4444' }}
                role="alert"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 rounded-full text-lg font-bold text-white shadow mt-1"
              style={{ backgroundColor: busy ? '#d6d3d1' : '#c2571b' }}
            >
              {busy ? 'Please wait…' : mode === 'signup' ? 'Create account →' : 'Log in →'}
            </button>
          </form>
        </div>

        <p className="text-xs text-center mt-4 px-2" style={{ color: '#a8a29e' }}>
          Classroom demo accounts — use any username; progress syncs to your learner profile.
        </p>
      </div>
    </div>
  )
}
