import { useState } from 'react'
import { Link } from 'react-router-dom'
import './neumorphic.css'

const BASE_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000'

type Mode = 'signup' | 'signin'

type User = {
  id: string
  email: string
  display_name: string
  timezone: string
  created_at: string
}

type Props = {
  onAuthenticated: (user: User) => void
}

function AuthForm({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<Mode>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleMode() {
    setMode((m) => (m === 'signup' ? 'signin' : 'signup'))
    setEmail('')
    setPassword('')
    setDisplayName('')
    setError(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const path = mode === 'signup' ? '/auth/signup' : '/auth/login'
    const body =
      mode === 'signup'
        ? { email, password, display_name: displayName }
        : { email, password }

    fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail)
        onAuthenticated(data)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  return (
    <div className="auth-wrap">
      <form onSubmit={handleSubmit} className="raised auth-panel">
        <div>
          <div className="wordmark">Petri</div>
          <h2 className="auth-tagline">{mode === 'signup' ? 'Sign up' : 'Sign in'}</h2>
        </div>
        <div className="auth-field">
          <label className="label" htmlFor="auth-email">
            Email
          </label>
          <input
            id="auth-email"
            type="email"
            placeholder="you@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
        </div>
        <div className="auth-field">
          <label className="label" htmlFor="auth-password">
            Password
          </label>
          <input
            id="auth-password"
            type="password"
            placeholder="••••••••"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
        </div>
        {mode === 'signup' && (
          <div className="auth-field">
            <label className="label" htmlFor="auth-display-name">
              Display name
            </label>
            <input
              id="auth-display-name"
              type="text"
              placeholder="Your name"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="input"
            />
          </div>
        )}
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={loading} className="btn btn-primary-exp" style={{ justifyContent: 'center' }}>
          {mode === 'signup' ? 'Sign up' : 'Sign in'}
        </button>
        {mode === 'signin' && (
          <div style={{ textAlign: 'center' }}>
            <Link to="/forgot-password">Forgot password?</Link>
          </div>
        )}
        <div className="auth-foot">
          <button type="button" onClick={toggleMode} disabled={loading} className="btn btn-text">
            {mode === 'signup' ? 'Switch to sign in' : 'Switch to sign up'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default AuthForm
