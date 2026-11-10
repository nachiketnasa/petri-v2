import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const BASE_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000'

function NewExperimentForm() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [hypothesis, setHypothesis] = useState('')
  const [cadenceType, setCadenceType] = useState('')
  const [targetDays, setTargetDays] = useState('')
  const [cadenceDays, setCadenceDays] = useState('')
  const [checkInKind, setCheckInKind] = useState('')
  const [startDate, setStartDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (title === '' || hypothesis === '' || cadenceType === '' || targetDays === '') {
      setError('Please fill in title, hypothesis, cadence type, and target days.')
      return
    }

    if (cadenceType === 'custom' && cadenceDays === '') {
      setError("cadence_days is required when cadence_type is 'custom'.")
      return
    }

    const body: Record<string, unknown> = {
      title,
      hypothesis,
      cadence_type: cadenceType,
      target_days: Number(targetDays),
    }
    if (cadenceDays !== '') body.cadence_days = Number(cadenceDays)
    if (checkInKind !== '') body.check_in_kind = checkInKind
    if (startDate !== '') body.start_date = startDate

    setSubmitting(true)

    fetch(`${BASE_URL}/experiments`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail)
        navigate('/dashboard')
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setSubmitting(false))
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>New experiment</h2>
      <input
        type="text"
        placeholder="Title"
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <input
        type="text"
        placeholder="Hypothesis"
        required
        value={hypothesis}
        onChange={(e) => setHypothesis(e.target.value)}
      />
      <input
        type="text"
        placeholder="Cadence type"
        required
        value={cadenceType}
        onChange={(e) => setCadenceType(e.target.value)}
      />
      <input
        type="number"
        placeholder="Target days"
        required
        value={targetDays}
        onChange={(e) => setTargetDays(e.target.value)}
      />
      <input
        type="number"
        placeholder="Cadence days"
        value={cadenceDays}
        onChange={(e) => setCadenceDays(e.target.value)}
      />
      <input
        type="text"
        placeholder="Check-in kind"
        value={checkInKind}
        onChange={(e) => setCheckInKind(e.target.value)}
      />
      <input
        type="date"
        placeholder="Start date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
      />
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={submitting}>
        Create experiment
      </button>
    </form>
  )
}

export default NewExperimentForm
