import { useNavigate } from 'react-router-dom'
import './neumorphic.css'

const PACT = [
  { title: 'Purposeful', body: 'Rooted in something that actually matters to you, not a generic goal.' },
  { title: 'Actionable', body: 'A concrete, doable step, not a vague wish to do better.' },
  { title: 'Continuous', body: 'Small enough to repeat, so you learn from a pattern instead of one data point.' },
  { title: 'Trackable', body: "A quick check in captures what happened, so the result is not just a feeling." },
]

function Landing() {
  const navigate = useNavigate()

  return (
    <div className="landing-screen">
      <div className="landing-topbar">
        <div className="wordmark">Petri</div>
      </div>

      <div className="landing-hero">
        <span className="badge badge-exp">Inspired by Tiny Experiments</span>
        <h1 className="landing-title">Start with a tiny experiment, not a big resolution</h1>
        <p className="landing-copy">
          Each one follows the PACT shape, so it stays small enough to actually run, and a
          tiny experiment that grows can become a goal with its own milestones.
        </p>
        <div className="landing-action">
          <button type="button" className="btn btn-primary-exp" onClick={() => navigate('/sign-in')}>
            Sign in
          </button>
        </div>
      </div>

      <div className="landing-pact">
        <h2>Every experiment follows PACT</h2>
        <div className="pact-grid">
          {PACT.map((p) => (
            <div key={p.title} className="raised pact-card">
              <div className="pact-title">{p.title}</div>
              <div className="pact-body">{p.body}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="landing-features">
        <div className="raised" style={{ padding: 22 }}>
          <div className="feature-title">A work in progress limit</div>
          <div className="feature-body">
            A work in progress limit keeps you focused on a few things at a time instead of a
            long list you never finish.
          </div>
        </div>
        <div className="raised" style={{ padding: 22 }}>
          <div className="feature-title">Transparent endings</div>
          <div className="feature-body">
            A tiny experiment that gets abandoned or fails is still tracked honestly, never
            hidden.
          </div>
        </div>
      </div>

      <div className="landing-foot">
        Petri, a personal planner for tiny experiments and goals, inspired by Tiny Experiments.
      </div>
    </div>
  )
}

export default Landing
