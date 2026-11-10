import { Link } from 'react-router-dom'
import { useAuth } from './AuthContext'

function Dashboard() {
  const { experiments, experimentsError: error } = useAuth()

  return (
    <div>
      <Link to="/experiments/new">New experiment</Link>
      {error && <p role="alert">{error}</p>}
      {!error && !experiments && <p>Loading…</p>}
      {!error && experiments && experiments.length === 0 && <p>No experiments yet.</p>}
      {!error && experiments && experiments.length > 0 && (
        <ul>
          {experiments.map((experiment) => (
            <li key={experiment.id}>
              <Link to={`/experiments/${experiment.id}`}>{experiment.title}</Link>
              <p>{experiment.cadence_type}</p>
              <p>{experiment.status}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default Dashboard
