import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './neumorphic.css'

// No /auth/me endpoint exists yet (#31), so the display name only arrives
// via router state right after sign-in. Caching it locally lets a page
// refresh on this screen still show the right name instead of going blank.
const STORAGE_KEY = 'petri:lastDisplayName'

// Called from App.tsx's onAuthenticated callback, synchronously, before the
// post-sign-in navigate -- RequireAuth's signedIn check is still async at
// that point (it redirects through "/" until the refetch resolves), so the
// name has to be in storage before navigation starts, not passed as route
// state that redirect would drop.
export function rememberDisplayName(name: string) {
  try {
    localStorage.setItem(STORAGE_KEY, name)
  } catch {
    // Storage can be unavailable (private browsing); the greeting falls back to no name.
  }
}

export function getStoredDisplayName(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function salutationFor(date: Date): string {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function Greeting() {
  const navigate = useNavigate()

  const [displayName] = useState(getStoredDisplayName)

  const salutation = salutationFor(new Date())
  const greetingText = displayName ? `${salutation}, ${displayName}.` : `${salutation}.`

  return (
    <div className="greeting-screen">
      <p className="greeting-text">{greetingText}</p>
      <p className="greeting-due">Nothing due today.</p>
      <button type="button" className="btn btn-primary-exp" onClick={() => navigate('/dashboard')}>
        Open dashboard
      </button>
    </div>
  )
}

export default Greeting
