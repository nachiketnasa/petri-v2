import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth, type Experiment, type Goal } from './AuthContext'
import { getStoredDisplayName } from './Greeting'
import './neumorphic.css'

type Filter = 'Both' | 'Experiments' | 'Goals'

const FILTERS: Filter[] = ['Experiments', 'Both', 'Goals']
const EXPERIMENT_WIP_CAP = 2
const GOAL_WIP_CAP = 1

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '·'
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

function ExperimentCard({
  experiment,
  variant = 'active',
}: {
  experiment: Experiment
  variant?: 'active' | 'backlog'
}) {
  return (
    <Link
      to={`/experiments/${experiment.id}`}
      aria-label={experiment.title}
      className="raised card"
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <div>
        <span className={variant === 'backlog' ? 'badge badge-muted' : 'badge badge-exp'}>
          {variant === 'backlog' ? 'Backlog' : `Experiment, ${experiment.status}`}
        </span>
        <div className="card-title" title={experiment.title}>
          {experiment.title}
        </div>
      </div>
      {experiment.hypothesis && <div className="card-sub">{experiment.hypothesis}</div>}
      {variant === 'active' && (
        <div className="card-foot">
          <div className="streak mono">— streak</div>
          {experiment.check_in_due && <span className="badge badge-exp">due today</span>}
        </div>
      )}
    </Link>
  )
}

function GoalCard({ goal, variant = 'active' }: { goal: Goal; variant?: 'active' | 'backlog' }) {
  return (
    <div className="raised card">
      <div>
        <span className={variant === 'backlog' ? 'badge badge-muted' : 'badge badge-goal'}>
          {variant === 'backlog' ? 'Backlog' : `Goal, ${goal.status}`}
        </span>
        <div className="card-title" title={goal.title}>
          {goal.title}
        </div>
      </div>
      {goal.why_text && <div className="card-sub">{goal.why_text}</div>}
      <div className="card-foot">
        <div className="streak mono">{goal.milestones.length} milestone{goal.milestones.length === 1 ? '' : 's'}</div>
      </div>
    </div>
  )
}

function Dashboard() {
  const { experiments, experimentsError: error, goals, signOut } = useAuth()
  const [filter, setFilter] = useState<Filter>('Both')
  const navigate = useNavigate()
  const displayName = getStoredDisplayName()

  function handleSignOut() {
    signOut()
    navigate('/')
  }

  // Real backend status values are lowercase ('active', 'archived', 'backlog',
  // and 'reflect') -- the groomed AC used capitalized strings, a casing typo
  // confirmed against _docs/schema.sql and backend/src/petri_backend/app.py.
  // 'reflect' experiments aren't called out by any tile, but they still show
  // up in the main grid below rather than silently disappearing.
  const wip = experiments ? experiments.filter((e) => e.status === 'active').length : 0
  const completed = experiments
    ? experiments.filter((e) => e.status === 'archived' && !e.ended_early).length
    : 0
  const abandoned = experiments ? experiments.filter((e) => e.ended_early === true).length : 0
  const backlog = experiments ? experiments.filter((e) => e.status === 'backlog') : []
  const gridExperiments = experiments ? experiments.filter((e) => e.status !== 'backlog') : []

  const goalWip = goals ? goals.filter((g) => g.status === 'active').length : 0
  const goalBacklog = goals ? goals.filter((g) => g.status === 'backlog') : []
  const gridGoals = goals ? goals.filter((g) => g.status !== 'backlog') : []

  const showExperiments = filter === 'Both' || filter === 'Experiments'
  const showGoals = filter === 'Both' || filter === 'Goals'

  return (
    <div>
      <div className="topbar">
        <div className="wordmark">Petri</div>
        <div className="raised-sm segmented" role="radiogroup" aria-label="Filter">
          {FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={filter === option}
              className={`seg-btn${filter === option ? ' active' : ''}`}
              onClick={() => setFilter(option)}
            >
              {option}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link to="/calendar" className="btn btn-text">
            Calendar
          </Link>
          <Link to="/settings" className="btn btn-text btn-icon" aria-label="Settings">
            <svg className="icon" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3" />
            </svg>
          </Link>
          <button type="button" onClick={handleSignOut} className="btn btn-text">
            Sign out
          </button>
          <div
            className="raised-sm"
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 13,
              color: 'var(--accent-exp-ink)',
            }}
          >
            {initialsFor(displayName)}
          </div>
        </div>
      </div>

      <div className="main-wrap">
        {error && <p role="alert">{error}</p>}

        {!error && !experiments && <p>Loading…</p>}

        {!error && experiments && experiments.length === 0 && (
          <>
            <p>No experiments yet.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <Link to="/experiments/new" className="btn btn-exp">
                New experiment
              </Link>
              <Link to="/goals/new" className="btn btn-goal">
                New goal
              </Link>
            </div>
          </>
        )}

        {!error && experiments && experiments.length > 0 && (
          <>
            <div className="stats-row">
              <div className="raised stat-tile">
                <div className="stat-num">
                  {wip} / {EXPERIMENT_WIP_CAP}
                </div>
                <div className="stat-label">Experiments running right now</div>
              </div>
              <div className="raised stat-tile">
                <div className="stat-num">
                  {goalWip} / {GOAL_WIP_CAP}
                </div>
                <div className="stat-label">Goals running right now</div>
              </div>
              <div className="raised stat-tile">
                <div className="stat-num">
                  <span style={{ color: 'var(--accent-exp-ink)' }}>{completed}</span>
                  <span style={{ color: 'var(--ink-faint)' }}> / </span>
                  <span style={{ color: 'var(--danger)' }}>{abandoned}</span>
                </div>
                <div className="stat-label">Finished compared with abandoned, all time</div>
              </div>
            </div>

            {showExperiments && (
              <>
                <div className="section-head">
                  <h3 className="section-title">Active</h3>
                </div>
                <div className="card-grid">
                  {gridExperiments.map((experiment) => (
                    <ExperimentCard key={experiment.id} experiment={experiment} />
                  ))}
                </div>

                <div className="section-head">
                  <h3 className="section-title">Backlog</h3>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <Link to="/experiments/new" className="btn btn-exp">
                      New experiment
                    </Link>
                    <Link to="/goals/new" className="btn btn-goal">
                      New goal
                    </Link>
                  </div>
                </div>
                {backlog.length === 0 ? (
                  <div className="card-grid">
                    <div className="raised-sm card empty-slot">
                      <div className="empty-text">Nothing waiting here yet</div>
                    </div>
                  </div>
                ) : (
                  <div className="card-grid">
                    {backlog.map((experiment) => (
                      <ExperimentCard key={experiment.id} experiment={experiment} variant="backlog" />
                    ))}
                  </div>
                )}
              </>
            )}

            {showGoals && (
              <section className="goals-section">
                <div className="section-head">
                  <h3 className="section-title">Goals</h3>
                  {gridGoals.length === 0 && goalBacklog.length === 0 && (
                    <Link to="/goals/new" className="btn btn-goal">
                      New goal
                    </Link>
                  )}
                </div>
                {gridGoals.length === 0 && goalBacklog.length === 0 ? (
                  <p>No goals yet.</p>
                ) : (
                  <>
                    <div className="card-grid">
                      {gridGoals.map((goal) => (
                        <GoalCard key={goal.id} goal={goal} />
                      ))}
                    </div>
                    {goalBacklog.length > 0 && (
                      <>
                        <div className="section-head">
                          <h3 className="section-title">Goals backlog</h3>
                          <Link to="/goals/new" className="btn btn-goal">
                            New goal
                          </Link>
                        </div>
                        <div className="card-grid">
                          {goalBacklog.map((goal) => (
                            <GoalCard key={goal.id} goal={goal} variant="backlog" />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default Dashboard
