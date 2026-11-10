import { useEffect, useState } from 'react'

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

  if (error) return <p role="alert">{error}</p>
  if (!experiments) return <p>Loading…</p>
  if (experiments.length === 0) return <p>No experiments yet.</p>

  return (
    <ul>
      {experiments.map((experiment) => (
        <li key={experiment.id}>
          <p>{experiment.title}</p>
          <p>{experiment.cadence_type}</p>
          <p>{experiment.status}</p>
        </li>
      ))}
    </ul>
  )
}

export default Dashboard
