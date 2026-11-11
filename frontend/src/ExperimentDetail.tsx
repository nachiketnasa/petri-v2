import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { playTone } from './sound'
import './neumorphic.css'

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

  const [activating, setActivating] = useState(false)
  const [activateError, setActivateError] = useState<string | null>(null)

  function handleActivate() {
    setActivating(true)
    setActivateError(null)

    fetch(`${BASE_URL}/experiments/${experimentId}/activate`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail)
        setExperiment(data)
      })
      .catch((err: Error) => setActivateError(err.message))
      .finally(() => setActivating(false))
  }

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
    <div className="detail-wrap">
      <div className="crumb">
        <Link to="/dashboard">Back to the dashboard</Link>
      </div>

      <div className="detail-layout">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="raised head-card">
            <div className="htop">
              <span className="badge badge-exp">Experiment, {experiment.status}</span>
              <Link to={`/calendar/${experiment.id}`} className="btn btn-text">
                View on calendar
              </Link>
            </div>
            <h2 className="card-title" style={{ marginTop: 10 }}>
              {experiment.title}
            </h2>
            <p className="hyp">{experiment.hypothesis}</p>
            <div className="meta-row">
              <div className="meta">
                <div className="meta-val">{experiment.cadence_type}</div>
                <div className="meta-lbl">Cadence</div>
              </div>
              <div className="meta">
                <div className="meta-val">{experiment.check_in_kind}</div>
                <div className="meta-lbl">Check in kind</div>
              </div>
              <div className="meta">
                <div className="meta-val">{experiment.target_days} days</div>
                <div className="meta-lbl">Target</div>
              </div>
            </div>
            {experiment.abandon_reason != null && (
              <p className="hyp">Abandon reason: {experiment.abandon_reason}</p>
            )}
            {experiment.status === 'backlog' && (
              <div style={{ marginTop: 14 }}>
                <button
                  type="button"
                  onClick={handleActivate}
                  disabled={activating}
                  className="btn btn-primary-exp"
                >
                  Activate
                </button>
                {activateError && (
                  <p role="alert" style={{ marginTop: 8 }}>
                    {activateError}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {experiment.status === 'active' ? (
            <form onSubmit={handleSubmit} className="raised checkin-card">
              <div className="checkin-title">Log a check in</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={valueBool}
                  onChange={(e) => setValueBool(e.target.checked)}
                />
                Value (bool)
              </label>
              <div className="auth-field">
                <label className="label" htmlFor="value-rating">
                  Rating
                </label>
                <input
                  id="value-rating"
                  type="number"
                  value={valueRating}
                  onChange={(e) => setValueRating(e.target.value)}
                  className="input"
                />
              </div>
              <div className="auth-field">
                <label className="label" htmlFor="checkin-note">
                  Note, this part is optional
                </label>
                <textarea
                  id="checkin-note"
                  rows={2}
                  placeholder="Anything worth remembering?"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="input"
                />
              </div>
              <div className="auth-field">
                <label className="label" htmlFor="checked-in-at">
                  Checked in at
                </label>
                <input
                  id="checked-in-at"
                  type="datetime-local"
                  value={checkedInAt}
                  onChange={(e) => setCheckedInAt(e.target.value)}
                  className="input"
                />
              </div>
              {submitError && <p role="alert">{submitError}</p>}
              <button type="submit" disabled={submitting} className="btn btn-primary-exp" style={{ justifyContent: 'center' }}>
                Save check in
              </button>
              {lastCheckIn && (
                <div className="card-sub">Last check in logged: {lastCheckIn.checked_in_at}</div>
              )}
            </form>
          ) : (
            <div className="raised" style={{ padding: 22 }}>
              <p className="card-sub">
                Check ins can only be logged while this experiment is active, current status:{' '}
                {experiment.status}
              </p>
            </div>
          )}

          {(experiment.status === 'active' || experiment.status === 'reflect') && (
            <form onSubmit={handleArchiveSubmit} className="raised checkin-card">
              <div className="checkin-title">Archive this experiment</div>
              <button type="button" onClick={toggleArchiveMode} disabled={archiving} className="btn btn-text">
                {archiveMode === 'retro' ? 'Switch to abandon early' : 'Switch to retro'}
              </button>
              {archiveMode === 'retro' ? (
                <>
                  <input
                    type="text"
                    placeholder="What worked"
                    value={whatWorked}
                    onChange={(e) => setWhatWorked(e.target.value)}
                    className="input"
                  />
                  <input
                    type="text"
                    placeholder="What didn't"
                    value={whatDidnt}
                    onChange={(e) => setWhatDidnt(e.target.value)}
                    className="input"
                  />
                  <input
                    type="text"
                    placeholder="Decision"
                    value={decision}
                    onChange={(e) => setDecision(e.target.value)}
                    className="input"
                  />
                </>
              ) : (
                <input
                  type="text"
                  placeholder="Abandon reason"
                  value={abandonReason}
                  onChange={(e) => setAbandonReason(e.target.value)}
                  className="input"
                />
              )}
              {archiveError && <p role="alert">{archiveError}</p>}
              <div className="footer-actions">
                <button type="submit" disabled={archiving} className="btn btn-text" style={{ color: 'var(--danger)' }}>
                  Archive
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default ExperimentDetail
