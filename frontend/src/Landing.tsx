import { useNavigate } from 'react-router-dom'
import './neumorphic.css'

function Landing() {
  const navigate = useNavigate()

  return (
    <div className="landing-screen">
      <h1 className="landing-title">Petri</h1>
      <p className="landing-copy">
        Start with a tiny experiment, not a big resolution. Each one follows the PACT
        shape, so it stays small enough to actually run.
      </p>
      <p className="landing-copy">
        A work in progress limit keeps you focused on a few things at a time instead of
        a long list you never finish.
      </p>
      <p className="landing-copy">
        A tiny experiment that grows can become a goal with its own milestones. One
        that gets abandoned or fails is still tracked honestly, never hidden.
      </p>
      <button type="button" className="landing-action" onClick={() => navigate('/sign-in')}>
        Sign in
      </button>
    </div>
  )
}

export default Landing
