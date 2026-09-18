// Navbar.jsx — Top navigation bar.
// Logo, Learn/Words/Translate links, account chip (login/logout),
// language switcher, and Teacher Mode toggle.

import { Link, useLocation, useNavigate } from 'react-router-dom'
import LanguageSwitcher from '../learn/LanguageSwitcher'
import { useAuth } from '../../context/AuthContext'

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const isTeacher = location.pathname === '/teacher'

  function handleTeacherToggle() {
    navigate(isTeacher ? '/' : '/teacher')
  }

  function handleLogout() {
    logout()
    navigate('/')
  }

  const initial = ((user?.display_name || user?.username || '?') + '').charAt(0).toUpperCase()

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-y-2 px-4 py-3 border-b border-stone-200"
      style={{ backgroundColor: '#fef9f0' }}
    >
      {/* Logo */}
      <Link
        to="/"
        className="text-xl font-bold no-underline"
        style={{
          color: '#f97316',
          fontFamily: '"Baloo 2", system-ui, sans-serif',
        }}
      >
        🎨 Linguify
      </Link>

      {/* Centre nav links */}
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="text-sm font-semibold no-underline transition-colors"
          style={{
            color: location.pathname === '/' ? '#f97316' : '#78716c',
          }}
        >
          Learn
        </Link>
        <Link
          to="/words"
          className="text-sm font-semibold no-underline transition-colors"
          style={{
            color: location.pathname === '/words' ? '#f97316' : '#78716c',
          }}
        >
          Words
        </Link>
        <Link
          to="/translate"
          className="text-sm font-semibold no-underline transition-colors"
          style={{
            color: location.pathname === '/translate' ? '#f97316' : '#78716c',
          }}
        >
          Translate
        </Link>
      </div>

      {/* Right cluster: language, account, teacher mode */}
      <div className="flex items-center gap-2">
        <LanguageSwitcher compact />
        {user ? (
          <>
            <span
              className="w-8 h-8 rounded-full hidden sm:flex items-center justify-center text-sm font-bold text-white"
              style={{ backgroundColor: '#c2571b' }}
              title={user.display_name || user.username}
              aria-label={`Logged in as ${user.display_name || user.username}`}
            >
              {initial}
            </span>
            <button
              onClick={handleLogout}
              className="rounded-full px-3 py-1 text-sm font-semibold transition-colors"
              style={{ color: '#78716c', border: '1px solid #e7e5e4', background: 'white' }}
            >
              Logout
            </button>
          </>
        ) : (
          <Link
            to="/login"
            className="rounded-full px-3 py-1 text-sm font-semibold text-white no-underline"
            style={{ backgroundColor: '#22c55e' }}
          >
            Login
          </Link>
        )}
        <button
          onClick={handleTeacherToggle}
          className="rounded-full px-3 py-1 text-sm font-semibold text-white transition-colors"
          style={{ backgroundColor: isTeacher ? '#22c55e' : '#f97316' }}
          aria-pressed={isTeacher}
        >
          {isTeacher ? '← Teacher' : 'Teacher'}
        </button>
      </div>
    </nav>
  )
}
