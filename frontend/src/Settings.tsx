import { useState } from 'react'
import { isSoundEnabled, setSoundEnabled } from './sound'
import './neumorphic.css'

// All preferences below use the same try/catch-wrapped localStorage pattern
// as Greeting.tsx's rememberDisplayName. This is browser-only for this pass;
// account-level persistence is #37's job (see _docs/schema.sql's users.theme,
// users.sound_effects_enabled, users.default_landing columns, unused today).

const THEME_KEY = 'petri:theme'
const LANDING_KEY = 'petri:landingPreference'
const COOKIE_KEY = 'petri:cookieNoticeDismissed'

export const THEMES = [
  { id: 'petri-light', label: 'Petri Light' },
  { id: 'petri-dark', label: 'Petri Dark' },
  { id: 'solarized-light', label: 'Solarized Light' },
  { id: 'solarized-dark', label: 'Solarized Dark' },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

export function getStoredTheme(): ThemeId | null {
  try {
    const value = localStorage.getItem(THEME_KEY)
    return THEMES.some((t) => t.id === value) ? (value as ThemeId) : null
  } catch {
    return null
  }
}

// Called once on app mount so a stored theme choice re-skins the whole app,
// not just the Settings screen. A first-time visitor has no stored value, so
// this is a no-op and today's existing look stays unchanged.
export function applyStoredTheme() {
  const theme = getStoredTheme()
  if (theme) document.documentElement.setAttribute('data-theme', theme)
}

function setTheme(theme: ThemeId) {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // Storage can be unavailable (private browsing); the theme just won't persist.
  }
  document.documentElement.setAttribute('data-theme', theme)
}

export type LandingPreference = 'greeting' | 'dashboard'

export function getLandingPreference(): LandingPreference {
  try {
    return localStorage.getItem(LANDING_KEY) === 'dashboard' ? 'dashboard' : 'greeting'
  } catch {
    return 'greeting'
  }
}

function setLandingPreference(pref: LandingPreference) {
  try {
    localStorage.setItem(LANDING_KEY, pref)
  } catch {
    // Storage can be unavailable (private browsing); the preference just won't persist.
  }
}

export function isCookieNoticeDismissed(): boolean {
  try {
    return localStorage.getItem(COOKIE_KEY) === 'true'
  } catch {
    return false
  }
}

function dismissCookieNotice() {
  try {
    localStorage.setItem(COOKIE_KEY, 'true')
  } catch {
    // Storage can be unavailable (private browsing); the notice will just show again next visit.
  }
}

export const COOKIE_NOTICE_TEXT =
  'This site uses cookies necessary for sign-in and security. Using the site means accepting this.'

// A small, non-blocking banner, not a full-page modal: strictly necessary
// cookies need no opt-in, just a single dismissal.
export function CookieNotice() {
  const [dismissed, setDismissed] = useState(isCookieNoticeDismissed)

  if (dismissed) return null

  return (
    <div className="neu-card cookie-notice" role="status">
      <p>{COOKIE_NOTICE_TEXT}</p>
      <button
        type="button"
        onClick={() => {
          dismissCookieNotice()
          setDismissed(true)
        }}
      >
        Got it
      </button>
    </div>
  )
}

function Settings() {
  const [theme, setThemeState] = useState<ThemeId>(() => getStoredTheme() ?? 'petri-light')
  const [sound, setSound] = useState(isSoundEnabled)
  const [landing, setLanding] = useState(getLandingPreference)

  return (
    <div className="settings-screen">
      <h2>Settings</h2>

      <section className="neu-card settings-section">
        <h3>Theme</h3>
        <div role="radiogroup" aria-label="Theme" className="settings-theme-options">
          {THEMES.map((option) => (
            <label key={option.id}>
              <input
                type="radio"
                name="theme"
                value={option.id}
                checked={theme === option.id}
                onChange={() => {
                  setTheme(option.id)
                  setThemeState(option.id)
                }}
              />
              {option.label}
            </label>
          ))}
        </div>
      </section>

      <section className="neu-card settings-section">
        <h3>Sound</h3>
        <label>
          <input
            type="checkbox"
            checked={sound}
            onChange={(e) => {
              setSoundEnabled(e.target.checked)
              setSound(e.target.checked)
            }}
          />
          Sound effects
        </label>
      </section>

      <section className="neu-card settings-section">
        <h3>After sign in</h3>
        <label>
          <input
            type="checkbox"
            checked={landing === 'dashboard'}
            onChange={(e) => {
              const pref: LandingPreference = e.target.checked ? 'dashboard' : 'greeting'
              setLandingPreference(pref)
              setLanding(pref)
            }}
          />
          Open the dashboard directly, skipping the greeting screen
        </label>
      </section>

      <section className="neu-card settings-section">
        <h3>Cookies</h3>
        <p>{COOKIE_NOTICE_TEXT}</p>
      </section>
    </div>
  )
}

export default Settings
