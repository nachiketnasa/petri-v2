import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import Settings, {
  CookieNotice,
  COOKIE_NOTICE_TEXT,
  applyStoredTheme,
  getLandingPreference,
  getStoredTheme,
} from './Settings'
import { isSoundEnabled } from './sound'

function renderSettings() {
  return render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>,
  )
}

describe('Settings', () => {
  afterEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    cleanup()
  })

  it('renders exactly four theme options, with Petri Light selected by default', () => {
    renderSettings()

    expect(screen.getByRole('radio', { name: 'Petri light' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Petri dark' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'Solarized light' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'Solarized dark' })).not.toBeChecked()
    expect(screen.getAllByRole('radio')).toHaveLength(4)
  })

  it('does not render the deferred Other tasks, 2FA, or account deletion controls', () => {
    renderSettings()

    expect(screen.queryByText(/other tasks/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/two.factor|2fa/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/delete.*account|account.*delet/i)).not.toBeInTheDocument()
  })

  it('a first-time visitor has no stored theme, so applying it is a no-op', () => {
    expect(getStoredTheme()).toBeNull()
    applyStoredTheme()
    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
  })

  it('selecting a theme sets data-theme on <html> immediately and persists it to localStorage', () => {
    renderSettings()

    fireEvent.click(screen.getByRole('radio', { name: 'Solarized dark' }))

    expect(document.documentElement.getAttribute('data-theme')).toBe('solarized-dark')
    expect(localStorage.getItem('petri:theme')).toBe('solarized-dark')
  })

  it('a stored theme survives a reload: applyStoredTheme reads it back and re-applies it', () => {
    renderSettings()
    fireEvent.click(screen.getByRole('radio', { name: 'Petri dark' }))

    // Simulate a fresh page load.
    document.documentElement.removeAttribute('data-theme')
    applyStoredTheme()

    expect(document.documentElement.getAttribute('data-theme')).toBe('petri-dark')
  });

  it('exactly one theme option is selected at a time', () => {
    renderSettings()

    fireEvent.click(screen.getByRole('radio', { name: 'Solarized light' }))

    const checked = screen.getAllByRole('radio').filter((el) => el.getAttribute('aria-checked') === 'true')
    expect(checked).toHaveLength(1)
    expect(checked[0]).toHaveAccessibleName('Solarized light')
  })

  it('the sound effects toggle is off by default and persists when turned on', () => {
    renderSettings()

    const toggle = screen.getByRole('switch', { name: /Sound effects/ })
    expect(toggle).not.toBeChecked()
    expect(isSoundEnabled()).toBe(false)

    fireEvent.click(toggle)

    expect(toggle).toBeChecked()
    expect(isSoundEnabled()).toBe(true)
    expect(localStorage.getItem('petri:soundEffectsEnabled')).toBe('true')
  })

  it('the landing-screen preference is off by default and persists when turned on', () => {
    renderSettings()

    const toggle = screen.getByRole('switch', { name: /dashboard directly|greeting screen first/i })
    expect(toggle).not.toBeChecked()
    expect(getLandingPreference()).toBe('greeting')

    fireEvent.click(toggle)

    expect(toggle).toBeChecked()
    expect(getLandingPreference()).toBe('dashboard')
    expect(localStorage.getItem('petri:landingPreference')).toBe('dashboard')
  })

  it('shows the strictly-necessary cookie notice text', () => {
    renderSettings()

    expect(screen.getByText(COOKIE_NOTICE_TEXT)).toBeInTheDocument()
  })

  it('links back to the dashboard as an in-app route, not a full page reload', () => {
    renderSettings()

    const back = screen.getByRole('link', { name: 'Back to the dashboard' })
    expect(back).toHaveAttribute('href', '/dashboard')
  })
})

describe('CookieNotice', () => {
  afterEach(() => {
    localStorage.clear()
    cleanup()
  })

  it('is visible on first load, with only a single dismissal action, no category picker', () => {
    render(<CookieNotice />)

    expect(screen.getByText(COOKIE_NOTICE_TEXT)).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('stays dismissed, via localStorage, once the user dismisses it', () => {
    const { unmount } = render(<CookieNotice />)

    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(screen.queryByText(COOKIE_NOTICE_TEXT)).not.toBeInTheDocument()
    expect(localStorage.getItem('petri:cookieNoticeDismissed')).toBe('true')

    unmount()

    // Simulate a later visit: a fresh mount reading the same storage key.
    render(<CookieNotice />)
    expect(screen.queryByText(COOKIE_NOTICE_TEXT)).not.toBeInTheDocument()
  })
})
