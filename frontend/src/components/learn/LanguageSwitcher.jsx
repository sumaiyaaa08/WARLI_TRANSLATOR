// LanguageSwitcher.jsx — EN / हिंदी / मराठी medium-of-instruction toggle.
// Reads/writes uiLang from ProgressContext (persisted in localStorage).

import { useProgress } from '../../context/ProgressContext'

const LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'mr', label: 'मराठी' },
]

export default function LanguageSwitcher({ compact = false }) {
  const { uiLang, setUiLang } = useProgress()

  return (
    <div
      className="inline-flex rounded-full p-1 gap-1"
      style={{ backgroundColor: '#f5f5f4', border: '1px solid #e7e5e4' }}
      role="group"
      aria-label="Choose language"
    >
      {LANGS.map(l => {
        const active = uiLang === l.code
        return (
          <button
            key={l.code}
            onClick={() => setUiLang(l.code)}
            aria-pressed={active}
            className={compact ? 'px-2 py-1 rounded-full text-xs font-bold' : 'px-3 py-1 rounded-full text-xs font-bold'}
            style={{
              backgroundColor: active ? '#f97316' : 'transparent',
              color: active ? 'white' : '#78716c',
            }}
          >
            {l.label}
          </button>
        )
      })}
    </div>
  )
}
