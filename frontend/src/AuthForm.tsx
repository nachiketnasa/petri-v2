import { useState } from 'react'

const BASE_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000'

type Mode = 'signup' | 'signin'

type User = {
  id: string
  email: string
  display_name: string
  timezone: string
  created_at: string
}

function AuthForm() {
  const [mode, setMode] = useState<Mode>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)

  function toggleMode() {
    setMode((m) => (m === 'signup' ? 'signin' : 'signup'))
    setEmail('')
    setPassword('')
    setDisplayName('')
    setError(null)
    setUser(null)
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
        setUser(data)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  if (user) {
    return <p>Signed in as {user.email}</p>
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>{mode === 'signup' ? 'Sign up' : 'Sign in'}</h2>
      <input
        type="email"
        placeholder="Email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {mode === 'signup' && (
        <input
          type="text"
          placeholder="Display name"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      )}
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={loading}>
        {mode === 'signup' ? 'Sign up' : 'Sign in'}
      </button>
      <button type="button" onClick={toggleMode} disabled={loading}>
        {mode === 'signup' ? 'Switch to sign in' : 'Switch to sign up'}
      </button>
    </form>
  )
}

export default AuthForm
