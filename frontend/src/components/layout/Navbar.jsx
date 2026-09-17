// Navbar.jsx — Top navigation bar.
// Shows logo, Learn/Translate links, and Teacher Mode toggle.

import { Link, useLocation, useNavigate } from 'react-router-dom'
import LanguageSwitcher from '../learn/LanguageSwitcher'

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const isTeacher = location.pathname === '/teacher'

  function handleTeacherToggle() {
    navigate(isTeacher ? '/' : '/teacher')
  }

  return (
    <nav
      className="flex items-center justify-between px-4 py-3 border-b border-stone-200"
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
        🎨 Warli Seekho
      </Link>

      {/* Centre nav links */}
      <div className="flex items-center gap-4">
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
          to="/translate"
          className="text-sm font-semibold no-underline transition-colors"
          style={{
            color: location.pathname === '/translate' ? '#f97316' : '#78716c',
          }}
        >
          Translate
        </Link>
      </div>

      {/* Teacher Mode toggle */}
      <div className="flex items-center gap-2">
        <LanguageSwitcher compact />
        <button
          onClick={handleTeacherToggle}
          className="rounded-full px-3 py-1 text-sm font-semibold text-white transition-colors"
          style={{ backgroundColor: isTeacher ? '#22c55e' : '#f97316' }}
          aria-pressed={isTeacher}
        >
          {isTeacher ? '← Exit Teacher Mode' : 'Teacher Mode'}
        </button>
      </div>
    </nav>
  )
}
