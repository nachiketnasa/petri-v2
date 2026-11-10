import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const BASE_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000'

type Experiment = {
  id: string
  title: string
  cadence_type: string
  status: string
}

function Dashboard() {
  const [experiments, setExperiments] = useState<Experiment[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${BASE_URL}/experiments`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail)
        setExperiments(data)
      })
      .catch((err: Error) => setError(err.message))
  }, [])

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
