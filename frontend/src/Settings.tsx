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
  { id: 'petri-light', label: 'Petri light', swatch: '#eff1f5' },
  { id: 'petri-dark', label: 'Petri dark', swatch: '#30333d' },
  { id: 'solarized-light', label: 'Solarized light', swatch: '#fdf6e3' },
  { id: 'solarized-dark', label: 'Solarized dark', swatch: '#073642' },
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
    <div className="raised cookie-notice" role="status">
      <p>{COOKIE_NOTICE_TEXT}</p>
      <button
        type="button"
        className="btn btn-primary-exp"
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
      <div className="crumb">
        <a href="/dashboard">Back to the dashboard</a>
      </div>
      <h2>Settings</h2>

      <div className="raised settings-panel">
        <div>
          <div className="settings-row-title">Theme</div>
          <div className="settings-row-sub">Pick a look for the whole app.</div>
          <div className="theme-grid" role="radiogroup" aria-label="Theme">
            {THEMES.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={theme === option.id}
                className={`theme-opt${theme === option.id ? ' active' : ''}`}
                onClick={() => {
                  setTheme(option.id)
                  setThemeState(option.id)
                }}
              >
                <div
                  className={`theme-swatch${theme === option.id ? ' active' : ''}`}
                  style={{ background: option.swatch }}
                />
                <div className="theme-name">{option.label}</div>
              </button>
            ))}
          </div>
        </div>

        <hr className="settings-hr" />

        <div className="settings-row">
          <div>
            <div className="settings-row-title">Sound effects</div>
            <div className="settings-row-sub">Short tones when you open a wizard, submit it, or log a check in.</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={sound}
            aria-label={sound ? 'Sound effects are on' : 'Sound effects are off'}
            className={`ntoggle${sound ? ' on' : ''}`}
            onClick={() => {
              setSoundEnabled(!sound)
              setSound(!sound)
            }}
          >
            <span className="knob" />
          </button>
        </div>

        <hr className="settings-hr" />

        <div className="settings-row">
          <div>
            <div className="settings-row-title">After sign in</div>
            <div className="settings-row-sub">Open the dashboard directly, skipping the greeting screen.</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={landing === 'dashboard'}
            aria-label={
              landing === 'dashboard'
                ? 'Opening the dashboard directly'
                : 'Opening the greeting screen first'
            }
            className={`ntoggle${landing === 'dashboard' ? ' on' : ''}`}
            onClick={() => {
              const pref: LandingPreference = landing === 'dashboard' ? 'greeting' : 'dashboard'
              setLandingPreference(pref)
              setLanding(pref)
            }}
          >
            <span className="knob" />
          </button>
        </div>

        <hr className="settings-hr" />

        <div>
          <div className="settings-row-title">Cookies</div>
          <div className="settings-row-sub">{COOKIE_NOTICE_TEXT}</div>
        </div>
      </div>
    </div>
  )
}

export default Settings
