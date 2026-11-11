import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { playTone } from './sound'

const BASE_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000'

type Experiment = {
  id: string
  user_id: string
  title: string
  hypothesis: string
  cadence_type: string
  cadence_days: number | null
  check_in_kind: string
  start_date: string
  target_days: number
  status: string
  ended_early: boolean
  abandon_reason: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
}

type CheckIn = {
  id: string
  experiment_id: string
  value_bool: boolean | null
  value_rating: number | null
  note: string | null
  checked_in_at: string
}

type ArchiveMode = 'retro' | 'abandon'

function ExperimentDetail() {
  const { id: experimentId } = useParams<{ id: string }>()
  const [experiment, setExperiment] = useState<Experiment | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [valueBool, setValueBool] = useState(false)
  const [valueRating, setValueRating] = useState('')
  const [note, setNote] = useState('')
  const [checkedInAt, setCheckedInAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [lastCheckIn, setLastCheckIn] = useState<CheckIn | null>(null)

  const [archiveMode, setArchiveMode] = useState<ArchiveMode>('retro')
  const [whatWorked, setWhatWorked] = useState('')
  const [whatDidnt, setWhatDidnt] = useState('')
  const [decision, setDecision] = useState('')
  const [abandonReason, setAbandonReason] = useState('')
  const [archiving, setArchiving] = useState(false)
  const [archiveError, setArchiveError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${BASE_URL}/experiments/${experimentId}`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail)
        setExperiment(data)
      })
      .catch((err: Error) => setLoadError(err.message))
  }, [experimentId])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError(null)

    const body: Record<string, unknown> = {}
    if (valueBool) body.value_bool = valueBool
    if (valueRating !== '') body.value_rating = Number(valueRating)
    if (note !== '') body.note = note
    if (checkedInAt !== '') body.checked_in_at = checkedInAt

    fetch(`${BASE_URL}/experiments/${experimentId}/check-ins`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail)
        playTone('check-in-log')
        setLastCheckIn(data)
        setValueBool(false)
        setValueRating('')
        setNote('')
        setCheckedInAt('')
      })
      .catch((err: Error) => setSubmitError(err.message))
      .finally(() => setSubmitting(false))
  }

  function toggleArchiveMode() {
    setArchiveMode((m) => (m === 'retro' ? 'abandon' : 'retro'))
    setWhatWorked('')
    setWhatDidnt('')
    setDecision('')
    setAbandonReason('')
    setArchiveError(null)
  }

  function handleArchiveSubmit(e: React.FormEvent) {
    e.preventDefault()
    setArchiveError(null)

    if (archiveMode === 'retro') {
      if (whatWorked === '' || whatDidnt === '' || decision === '') {
        setArchiveError('Please fill in what worked, what didn\'t, and the decision.')
        return
      }
    } else {
      if (abandonReason === '') {
        setArchiveError('Please provide a reason for abandoning early.')
        return
      }
    }

    setArchiving(true)

    const body: Record<string, unknown> =
      archiveMode === 'retro'
        ? { what_worked: whatWorked, what_didnt: whatDidnt, decision }
        : { abandon_reason: abandonReason }

    fetch(`${BASE_URL}/experiments/${experimentId}/archive`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail)
        setExperiment(data)
      })
      .catch((err: Error) => setArchiveError(err.message))
      .finally(() => setArchiving(false))
  }

  if (loadError) return <p role="alert">{loadError}</p>
  if (!experiment) return <p>Loading…</p>

  return (
    <div>
      <h2>{experiment.title}</h2>
      <p>{experiment.hypothesis}</p>
      <p>
        Cadence: {experiment.cadence_type}
        {experiment.cadence_days != null && ` (every ${experiment.cadence_days} days)`}
      </p>
      <p>Check-in kind: {experiment.check_in_kind}</p>
      <p>Start date: {experiment.start_date}</p>
      <p>Target days: {experiment.target_days}</p>
      <p>Status: {experiment.status}</p>
      {experiment.abandon_reason != null && <p>Abandon reason: {experiment.abandon_reason}</p>}
      <p>
        <Link to={`/calendar/${experiment.id}`}>View on calendar</Link>
      </p>

      {experiment.status === 'active' ? (
        <form onSubmit={handleSubmit}>
          <h3>Log a check-in</h3>
          <label>
            <input
              type="checkbox"
              checked={valueBool}
              onChange={(e) => setValueBool(e.target.checked)}
            />
            Value (bool)
          </label>
          <input
            type="number"
            placeholder="Rating"
            value={valueRating}
            onChange={(e) => setValueRating(e.target.value)}
          />
          <input
            type="text"
            placeholder="Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <input
            type="datetime-local"
            placeholder="Checked in at"
            value={checkedInAt}
            onChange={(e) => setCheckedInAt(e.target.value)}
          />
          {submitError && <p role="alert">{submitError}</p>}
          <button type="submit" disabled={submitting}>
            Log check-in
          </button>
        </form>
      ) : (
        <p>
          Check-ins can only be logged while this experiment is Active — current status:{' '}
          {experiment.status}
        </p>
      )}

      {lastCheckIn && <p>Last check-in logged: {lastCheckIn.checked_in_at}</p>}

      {(experiment.status === 'active' || experiment.status === 'reflect') && (
        <form onSubmit={handleArchiveSubmit}>
          <h3>Archive this experiment</h3>
          <button type="button" onClick={toggleArchiveMode} disabled={archiving}>
            {archiveMode === 'retro' ? 'Switch to abandon early' : 'Switch to retro'}
          </button>
          {archiveMode === 'retro' ? (
            <>
              <input
                type="text"
                placeholder="What worked"
                value={whatWorked}
                onChange={(e) => setWhatWorked(e.target.value)}
              />
              <input
                type="text"
                placeholder="What didn't"
                value={whatDidnt}
                onChange={(e) => setWhatDidnt(e.target.value)}
              />
              <input
                type="text"
                placeholder="Decision"
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
              />
            </>
          ) : (
            <input
              type="text"
              placeholder="Abandon reason"
              value={abandonReason}
              onChange={(e) => setAbandonReason(e.target.value)}
            />
          )}
          {archiveError && <p role="alert">{archiveError}</p>}
          <button type="submit" disabled={archiving}>
            Archive
          </button>
        </form>
      )}
    </div>
  )
}

export default ExperimentDetail
