import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import './neumorphic.css'

const BASE_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000'

function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [token, setToken] = useState(searchParams.get('token') ?? '')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    fetch(`${BASE_URL}/auth/reset-password`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail)
        // Does not sign the user in -- the backend invalidates every
        // existing session for this account on a successful reset, so
        // landing on a protected page here would be a dead end anyway.
        setDone(true)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setSubmitting(false))
  }

  if (done) {
    return (
      <div className="auth-wrap">
        <div className="raised auth-panel">
          <div className="wordmark">Petri</div>
          <p role="status">Your password has been changed. Sign in with your new password.</p>
          <button
            type="button"
            className="btn btn-primary-exp"
            style={{ justifyContent: 'center' }}
            onClick={() => navigate('/sign-in')}
          >
            Go to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-wrap">
      <form onSubmit={handleSubmit} className="raised auth-panel">
        <div>
          <div className="wordmark">Petri</div>
          <h2 className="auth-tagline">Reset password</h2>
        </div>
        <div className="auth-field">
          <label className="label" htmlFor="reset-token">
            Reset token
          </label>
          <input
            id="reset-token"
            type="text"
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="input"
          />
        </div>
        <div className="auth-field">
          <label className="label" htmlFor="reset-password">
            New password
          </label>
          <input
            id="reset-password"
            type="password"
            placeholder="••••••••"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
        </div>
        {error && <p role="alert">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="btn btn-primary-exp"
          style={{ justifyContent: 'center' }}
        >
          Set new password
        </button>
        <div className="auth-foot">
          <Link to="/sign-in">Back to sign in</Link>
        </div>
      </form>
    </div>
  )
}

export default ResetPassword
