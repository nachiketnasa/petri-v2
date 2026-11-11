import { useState } from 'react'
import { Link } from 'react-router-dom'
import './neumorphic.css'

const BASE_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000'

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    fetch(`${BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
      .finally(() => {
        // Same confirmation whether or not the email is registered or the
        // request even succeeded -- the backend's own response is already
        // identical either way, so there is nothing else to branch on here.
        setSubmitting(false)
        setSubmitted(true)
      })
  }

  if (submitted) {
    return (
      <div className="auth-wrap">
        <div className="raised auth-panel">
          <div className="wordmark">Petri</div>
          <p role="status">
            If an account exists for that email, a password reset link is on its way.
          </p>
          <div className="auth-foot">
            <Link to="/sign-in">Back to sign in</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-wrap">
      <form onSubmit={handleSubmit} className="raised auth-panel">
        <div>
          <div className="wordmark">Petri</div>
          <h2 className="auth-tagline">Forgot password</h2>
        </div>
        <div className="auth-field">
          <label className="label" htmlFor="forgot-email">
            Email
          </label>
          <input
            id="forgot-email"
            type="email"
            placeholder="you@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="btn btn-primary-exp"
          style={{ justifyContent: 'center' }}
        >
          Send reset link
        </button>
        <div className="auth-foot">
          <Link to="/sign-in">Back to sign in</Link>
        </div>
      </form>
    </div>
  )
}

export default ForgotPassword
