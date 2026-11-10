import { useEffect, useState } from 'react'

const BASE_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000'

type Status = 'loading' | 'ok' | 'error'

function HealthStatus() {
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    fetch(`${BASE_URL}/health`)
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return res.json()
      })
      .then(() => setStatus('ok'))
      .catch(() => setStatus('error'))
  }, [])

  if (status === 'loading') return <p>Backend: checking…</p>
  if (status === 'ok') return <p>Backend: ok</p>
  return <p>Backend: unreachable</p>
}

export default HealthStatus
