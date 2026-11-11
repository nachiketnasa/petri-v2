import { useState } from 'react'
import { Link } from 'react-router-dom'
import './neumorphic.css'

const BASE_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000'

type Mode = 'signup' | 'signin' | 'verify'

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
  const [code, setCode] = useState('')
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  // Set only when verify-mode was entered right after signup (session
  // already exists from signup itself -- #33 -- so finishing verification
  // just needs to hand that same user back, not log in again).
  const [pendingSignupUser, setPendingSignupUser] = useState<User | null>(null)

  function toggleMode() {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'))
    setEmail('')
    setPassword('')
    setDisplayName('')
    setCode('')
    setError(null)
    setResendMessage(null)
    setPendingSignupUser(null)
  }

  function attemptLogin() {
    setLoading(true)
    setError(null)

    return fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) {
          if (res.status === 403) {
            // Signed up but never verified -- drop into the verify-code
            // step instead of just showing the error (there was previously
            // no way at all to get unstuck here once past signup, since
            // verifying doesn't sign the user in on its own).
            setMode('verify')
            setError(null)
            return
          }
          throw new Error(data.detail)
        }
        onAuthenticated(data)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (mode === 'signin') {
      attemptLogin()
      return
    }

    setLoading(true)
    setError(null)

    fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, display_name: displayName }),
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail)
        // Signup already set a session cookie (#33) regardless of
        // verification status, but that must not be a back door around
        // #23's verification requirement -- hold the account here and make
        // the user verify before onAuthenticated ever fires.
        setPendingSignupUser(data)
        setMode('verify')
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  function handleVerifySubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    fetch(`${BASE_URL}/auth/verify-email`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail)
        if (pendingSignupUser) {
          // Already signed in from signup -- just hand that user back.
          onAuthenticated(pendingSignupUser)
          setLoading(false)
          return
        }
        // Reached verify via a blocked sign-in: verifying doesn't sign the
        // user in on its own, so finish with the login already attempted.
        return attemptLogin()
      })
      .catch((err: Error) => {
        setError(err.message)
        setLoading(false)
      })
  }

  function handleResend() {
    setLoading(true)
    setError(null)
    setResendMessage(null)

    fetch(`${BASE_URL}/auth/resend-verification`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
      .then(() => setResendMessage('A new code has been sent, if that account exists and needs one.'))
      .catch(() => setResendMessage('A new code has been sent, if that account exists and needs one.'))
      .finally(() => setLoading(false))
  }

  if (mode === 'verify') {
    return (
      <div className="auth-wrap">
        <form onSubmit={handleVerifySubmit} className="raised auth-panel">
          <div>
            <div className="wordmark">Petri</div>
            <h2 className="auth-tagline">Verify your email</h2>
          </div>
          <p>
            Enter the verification code sent to <strong>{email}</strong>.
          </p>
          <div className="auth-field">
            <label className="label" htmlFor="auth-code">
              Verification code
            </label>
            <input
              id="auth-code"
              type="text"
              placeholder="123456"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="input"
            />
          </div>
          {error && <p role="alert">{error}</p>}
          {resendMessage && <p>{resendMessage}</p>}
          <button type="submit" disabled={loading} className="btn btn-primary-exp" style={{ justifyContent: 'center' }}>
            Verify
          </button>
          <div className="auth-foot" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button type="button" onClick={handleResend} disabled={loading} className="btn btn-text">
              Resend code
            </button>
            <button type="button" onClick={toggleMode} disabled={loading} className="btn btn-text">
              Back to sign in
            </button>
          </div>
        </form>
      </div>
    )
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
