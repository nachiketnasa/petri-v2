import { useState } from 'react'
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
    <div className="auth-screen">
      <form onSubmit={handleSubmit} className="auth-form neu-card">
        <h2>{mode === 'signup' ? 'Sign up' : 'Sign in'}</h2>
        <input
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="neu-input"
        />
        <input
          type="password"
          placeholder="Password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="neu-input"
        />
        {mode === 'signup' && (
          <input
            type="text"
            placeholder="Display name"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="neu-input"
          />
        )}
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={loading} className="neu-button">
          {mode === 'signup' ? 'Sign up' : 'Sign in'}
        </button>
        <button type="button" onClick={toggleMode} disabled={loading} className="neu-button-ghost">
          {mode === 'signup' ? 'Switch to sign in' : 'Switch to sign up'}
        </button>
      </form>
    </div>
  )
}

export default AuthForm
