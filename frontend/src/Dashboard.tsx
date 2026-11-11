import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, type Experiment } from './AuthContext'
import './neumorphic.css'

type Filter = 'Both' | 'Experiments' | 'Goals'

const FILTERS: Filter[] = ['Both', 'Experiments', 'Goals']
const EXPERIMENT_WIP_CAP = 2
const GOAL_WIP_CAP = 1

function ExperimentCard({
  experiment,
  showStatus = true,
}: {
  experiment: Experiment
  showStatus?: boolean
}) {
  return (
    <div className="neu-card">
      <Link to={`/experiments/${experiment.id}`} className="card-title" title={experiment.title}>
        {experiment.title}
      </Link>
      <p className="card-meta">{experiment.cadence_type}</p>
      {showStatus && <p className="card-meta">{experiment.status}</p>}
    </div>
  )
}

function Dashboard() {
  const { experiments, experimentsError: error } = useAuth()
  const [filter, setFilter] = useState<Filter>('Both')

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

  const showExperiments = filter === 'Both' || filter === 'Experiments'
  const showGoals = filter === 'Both' || filter === 'Goals'

  return (
    <div className="dashboard">
      <Link to="/experiments/new">New experiment</Link>

      {error && <p role="alert">{error}</p>}

      {!error && !experiments && <p>Loading…</p>}

      {!error && experiments && experiments.length === 0 && <p>No experiments yet.</p>}

      {!error && experiments && experiments.length > 0 && (
        <>
          <div className="dashboard-filter" role="radiogroup" aria-label="Filter">
            {FILTERS.map((option) => (
              <label key={option}>
                <input
                  type="radio"
                  name="dashboard-filter"
                  value={option}
                  checked={filter === option}
                  onChange={() => setFilter(option)}
                />
                {option}
              </label>
            ))}
          </div>

          <div className="dashboard-tiles">
            <div className="neu-tile">
              <h4>Experiments</h4>
              <p className="tile-value">
                Experiments {wip}/{EXPERIMENT_WIP_CAP}
              </p>
            </div>
            <div className="neu-tile">
              <h4>Goals</h4>
              <p className="tile-value">
                Goals 0/{GOAL_WIP_CAP}
              </p>
            </div>
            <div className="neu-tile">
              <h4>Completed vs abandoned</h4>
              <p className="tile-value">
                {completed} completed · {abandoned} abandoned
              </p>
            </div>
            <div className="neu-tile streak-tile">
              <h4>Streak</h4>
              <p className="tile-value">—</p>
            </div>
          </div>

          {showExperiments && (
            <>
              <div className="dashboard-grid">
                {gridExperiments.map((experiment) => (
                  <ExperimentCard key={experiment.id} experiment={experiment} />
                ))}
              </div>

              <section className="backlog-section">
                <h3>Backlog</h3>
                {backlog.length === 0 ? (
                  <p>Nothing in the backlog.</p>
                ) : (
                  <div className="dashboard-grid">
                    {backlog.map((experiment) => (
                      <ExperimentCard key={experiment.id} experiment={experiment} showStatus={false} />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {showGoals && (
            <section className="goals-section">
              <h3>Goals</h3>
              <p>No goals yet.</p>
            </section>
          )}
        </>
      )}
    </div>
  )
}

export default Dashboard
