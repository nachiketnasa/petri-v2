import { useContext, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AuthContext } from './AuthContext'
import { playTone } from './sound'
import './neumorphic.css'

const BASE_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000'

const CADENCE_TYPE_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'custom', label: 'Custom' },
] as const

const CHECK_IN_KIND_OPTIONS = [
  { value: 'boolean', label: 'Boolean' },
  { value: 'rating', label: 'Rating' },
] as const

// Matches _docs/schema.sql's retros.decision CHECK constraint exactly --
// not free text, so the backend never 400s a value this UI could produce.
const DECISION_OPTIONS = [
  { value: 'continue', label: 'Continue' },
  { value: 'stop', label: 'Stop' },
  { value: 'pivot', label: 'Pivot' },
  { value: 'iterate', label: 'Iterate' },
] as const

type Milestone = {
  id: string
  goal_id: string
  order_index: number
  title: string
  cadence_type: string
  cadence_days: number | null
  check_in_kind: string
  target_date: string | null
  started_at: string | null
  status: string
}

type Goal = {
  id: string
  title: string
  why_text: string
  start_date: string
  target_date: string
  status: string
  ended_early: boolean
  milestones: Milestone[]
}

type CheckIn = {
  id: string
  milestone_id: string
  value_bool: boolean | null
  value_rating: number | null
  note: string | null
  checked_in_at: string
}

type ArchiveMode = 'retro' | 'abandon'

function GoalDetail() {
  const { id: goalId } = useParams<{ id: string }>()
  // Optional: same reasoning as ExperimentDetail -- a status change here
  // (activate) can refresh the Dashboard's shared goals list, but this
  // component must still render standalone in tests without an AuthProvider.
  const authCtx = useContext(AuthContext)
  const [goal, setGoal] = useState<Goal | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [valueBool, setValueBool] = useState(false)
  const [valueRating, setValueRating] = useState('')
  const [note, setNote] = useState('')
  const [checkedInAt, setCheckedInAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [checkIns, setCheckIns] = useState<CheckIn[] | null>(null)

  const [activating, setActivating] = useState(false)
  const [activateError, setActivateError] = useState<string | null>(null)

  const [newTitle, setNewTitle] = useState('')
  const [newCadenceType, setNewCadenceType] = useState('')
  const [newCadenceDays, setNewCadenceDays] = useState('')
  const [newCheckInKind, setNewCheckInKind] = useState('')
  const [newTargetDate, setNewTargetDate] = useState('')
  const [addingMilestone, setAddingMilestone] = useState(false)
  const [addMilestoneError, setAddMilestoneError] = useState<string | null>(null)

  const [milestoneArchiveMode, setMilestoneArchiveMode] = useState<ArchiveMode>('retro')
  const [milestoneWhatWorked, setMilestoneWhatWorked] = useState('')
  const [milestoneWhatDidnt, setMilestoneWhatDidnt] = useState('')
  const [milestoneDecision, setMilestoneDecision] = useState('')
  const [milestoneAbandonReason, setMilestoneAbandonReason] = useState('')
  const [archivingMilestone, setArchivingMilestone] = useState(false)
  const [milestoneArchiveError, setMilestoneArchiveError] = useState<string | null>(null)

  const [goalArchiveMode, setGoalArchiveMode] = useState<ArchiveMode>('retro')
  const [goalWhatWorked, setGoalWhatWorked] = useState('')
  const [goalWhatDidnt, setGoalWhatDidnt] = useState('')
  const [goalDecision, setGoalDecision] = useState('')
  const [goalAbandonReason, setGoalAbandonReason] = useState('')
  const [archivingGoal, setArchivingGoal] = useState(false)
  const [goalArchiveError, setGoalArchiveError] = useState<string | null>(null)

  const activeMilestone = goal?.milestones.find((m) => m.status === 'active') ?? null

  function fetchGoal() {
    fetch(`${BASE_URL}/goals/${goalId}`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail)
        setGoal(data)
      })
      .catch((err: Error) => setLoadError(err.message))
  }

  function fetchCheckIns(milestoneId: string) {
    fetch(`${BASE_URL}/milestones/${milestoneId}/check-ins`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return
        setCheckIns(await res.json())
      })
      .catch(() => {})
  }

  useEffect(() => {
    fetchGoal()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalId])

  useEffect(() => {
    if (activeMilestone) fetchCheckIns(activeMilestone.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMilestone?.id])

  function handleActivate() {
    setActivating(true)
    setActivateError(null)

    fetch(`${BASE_URL}/goals/${goalId}/activate`, { method: 'POST', credentials: 'include' })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail)
        setGoal(data)
        authCtx?.refetch()
      })
      .catch((err: Error) => setActivateError(err.message))
      .finally(() => setActivating(false))
  }

  function handleAddMilestone(e: React.FormEvent) {
    e.preventDefault()
    if (newTitle === '' || newCadenceType === '') {
      setAddMilestoneError('Please fill in title and cadence type.')
      return
    }
    if (newCadenceType === 'custom' && newCadenceDays === '') {
      setAddMilestoneError("cadence_days is required when cadence_type is 'custom'.")
      return
    }
    setAddingMilestone(true)
    setAddMilestoneError(null)

    const body: Record<string, unknown> = { title: newTitle, cadence_type: newCadenceType }
    if (newCadenceDays !== '') body.cadence_days = Number(newCadenceDays)
    if (newCheckInKind !== '') body.check_in_kind = newCheckInKind
    if (newTargetDate !== '') body.target_date = newTargetDate

    fetch(`${BASE_URL}/goals/${goalId}/milestones`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail)
        setGoal(data)
        authCtx?.refetch()
        setNewTitle('')
        setNewCadenceType('')
        setNewCadenceDays('')
        setNewCheckInKind('')
        setNewTargetDate('')
      })
      .catch((err: Error) => setAddMilestoneError(err.message))
      .finally(() => setAddingMilestone(false))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!activeMilestone) return
    setSubmitting(true)
    setSubmitError(null)

    const body: Record<string, unknown> = {}
    if (activeMilestone.check_in_kind === 'rating') {
      body.value_rating = Number(valueRating)
    } else {
      body.value_bool = valueBool
    }
    if (note !== '') body.note = note
    if (checkedInAt !== '') body.checked_in_at = checkedInAt

    fetch(`${BASE_URL}/milestones/${activeMilestone.id}/check-ins`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail)
        playTone('check-in-log')
        fetchCheckIns(activeMilestone.id)
        setValueBool(false)
        setValueRating('')
        setNote('')
        setCheckedInAt('')
      })
      .catch((err: Error) => setSubmitError(err.message))
      .finally(() => setSubmitting(false))
  }

  function toggleMilestoneArchiveMode() {
    setMilestoneArchiveMode((m) => (m === 'retro' ? 'abandon' : 'retro'))
    setMilestoneWhatWorked('')
    setMilestoneWhatDidnt('')
    setMilestoneDecision('')
    setMilestoneAbandonReason('')
    setMilestoneArchiveError(null)
  }

  function handleMilestoneArchiveSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!activeMilestone) return
    setMilestoneArchiveError(null)

    if (milestoneArchiveMode === 'retro') {
      if (milestoneWhatWorked === '' || milestoneWhatDidnt === '' || milestoneDecision === '') {
        setMilestoneArchiveError("Please fill in what worked, what didn't, and the decision.")
        return
      }
    } else if (milestoneAbandonReason === '') {
      setMilestoneArchiveError('Please provide a reason for abandoning early.')
      return
    }

    setArchivingMilestone(true)

    const body: Record<string, unknown> =
      milestoneArchiveMode === 'retro'
        ? { what_worked: milestoneWhatWorked, what_didnt: milestoneWhatDidnt, decision: milestoneDecision }
        : { abandon_reason: milestoneAbandonReason }

    fetch(`${BASE_URL}/milestones/${activeMilestone.id}/archive`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail)
        // The response is the archived milestone alone; re-fetch the goal
        // so the next milestone (now active) or the goal's own reflect
        // transition (if that was the last one) shows up here.
        fetchGoal()
        authCtx?.refetch()
      })
      .catch((err: Error) => setMilestoneArchiveError(err.message))
      .finally(() => setArchivingMilestone(false))
  }

  function toggleGoalArchiveMode() {
    setGoalArchiveMode((m) => (m === 'retro' ? 'abandon' : 'retro'))
    setGoalWhatWorked('')
    setGoalWhatDidnt('')
    setGoalDecision('')
    setGoalAbandonReason('')
    setGoalArchiveError(null)
  }

  function handleGoalArchiveSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGoalArchiveError(null)

    if (goalArchiveMode === 'retro') {
      if (goalWhatWorked === '' || goalWhatDidnt === '' || goalDecision === '') {
        setGoalArchiveError("Please fill in what worked, what didn't, and the decision.")
        return
      }
    } else if (goalAbandonReason === '') {
      setGoalArchiveError('Please provide a reason for abandoning early.')
      return
    }

    setArchivingGoal(true)

    const body: Record<string, unknown> =
      goalArchiveMode === 'retro'
        ? { what_worked: goalWhatWorked, what_didnt: goalWhatDidnt, decision: goalDecision }
        : { abandon_reason: goalAbandonReason }

    fetch(`${BASE_URL}/goals/${goalId}/archive`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail)
        setGoal(data)
        authCtx?.refetch()
      })
      .catch((err: Error) => setGoalArchiveError(err.message))
      .finally(() => setArchivingGoal(false))
  }

  if (loadError) return <p role="alert">{loadError}</p>
  if (!goal) return <p>Loading…</p>

  return (
    <div className="detail-wrap">
      <div className="crumb">
        <Link to="/dashboard">Back to the dashboard</Link>
      </div>

      <div className="detail-layout">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="raised head-card">
            <div className="htop">
              <div>
                <span className="badge badge-goal">Goal, {goal.status}</span>
              </div>
              <Link to="/calendar" className="btn btn-text">
                View on calendar
              </Link>
            </div>
            <h2 className="card-title" style={{ marginTop: 10 }}>
              {goal.title}
            </h2>
            <p className="hyp">{goal.why_text}</p>
            <div className="meta-row">
              <div className="meta">
                <div className="meta-val">{goal.start_date}</div>
                <div className="meta-lbl">Start date</div>
              </div>
              <div className="meta">
                <div className="meta-val">{goal.target_date}</div>
                <div className="meta-lbl">Target date</div>
              </div>
              <div className="meta">
                <div className="meta-val">{goal.milestones.length}</div>
                <div className="meta-lbl">Milestones</div>
              </div>
            </div>
            {goal.status === 'backlog' && (
              <div style={{ marginTop: 14 }}>
                <button
                  type="button"
                  onClick={handleActivate}
                  disabled={activating}
                  className="btn btn-primary-goal"
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

          <div className="raised" style={{ padding: 22 }}>
            <div className="checkin-title" style={{ marginBottom: 14 }}>
              Milestones
            </div>
            <div className="history">
              {goal.milestones
                .slice()
                .sort((a, b) => a.order_index - b.order_index)
                .map((milestone) => (
                  <div className="hist-row" key={milestone.id}>
                    <div className={`hist-dot${milestone.status === 'active' ? '' : ' skip'}`} />
                    <div className="hist-date">{milestone.order_index + 1}.</div>
                    <div className="hist-note">
                      {milestone.title} — {milestone.cadence_type}
                      {milestone.cadence_days != null ? ` every ${milestone.cadence_days} days` : ''}
                      {' · '}
                      {milestone.status}
                    </div>
                  </div>
                ))}
            </div>

            {goal.status !== 'backlog' && (
              <p className="card-sub" style={{ marginTop: 14 }}>
                Milestones are locked now that this goal is {goal.status}.
              </p>
            )}

            {goal.status === 'backlog' && (
              <form
                onSubmit={handleAddMilestone}
                style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                <div className="checkin-title">Add a milestone</div>
                <input
                  type="text"
                  placeholder="Milestone title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="input"
                />
                <div className="auth-field">
                  <label className="label">Cadence type</label>
                  <div className="raised-sm segmented" role="radiogroup" aria-label="New milestone cadence type">
                    {CADENCE_TYPE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={newCadenceType === option.value}
                        className={`seg-btn${newCadenceType === option.value ? ' active' : ''}`}
                        onClick={() => setNewCadenceType(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                {newCadenceType === 'custom' && (
                  <input
                    type="number"
                    placeholder="Cadence days"
                    value={newCadenceDays}
                    onChange={(e) => setNewCadenceDays(e.target.value)}
                    className="input"
                  />
                )}
                <div className="auth-field">
                  <label className="label">Check-in kind</label>
                  <div className="raised-sm segmented" role="radiogroup" aria-label="New milestone check-in kind">
                    {CHECK_IN_KIND_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={newCheckInKind === option.value}
                        className={`seg-btn${newCheckInKind === option.value ? ' active' : ''}`}
                        onClick={() => setNewCheckInKind(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="auth-field">
                  <label className="label" htmlFor="new-milestone-target-date">
                    Target date (optional)
                  </label>
                  <input
                    id="new-milestone-target-date"
                    type="date"
                    value={newTargetDate}
                    onChange={(e) => setNewTargetDate(e.target.value)}
                    className="input"
                  />
                </div>
                {addMilestoneError && <p role="alert">{addMilestoneError}</p>}
                <button type="submit" disabled={addingMilestone} className="btn btn-primary-goal">
                  Add milestone
                </button>
              </form>
            )}
          </div>

          {activeMilestone && (
            <div className="raised" style={{ padding: 22 }}>
              <div className="checkin-title" style={{ marginBottom: 14 }}>
                Check in history
              </div>
              {checkIns === null && <p className="card-sub">Loading…</p>}
              {checkIns !== null && checkIns.length === 0 && (
                <p className="card-sub">No check-ins logged yet.</p>
              )}
              {checkIns !== null && checkIns.length > 0 && (
                <div className="history">
                  {checkIns.map((checkIn) => {
                    const done = checkIn.value_bool !== false
                    return (
                      <div className="hist-row" key={checkIn.id}>
                        <div className={`hist-dot${done ? '' : ' skip'}`} />
                        <div className="hist-date">
                          {new Date(checkIn.checked_in_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                        <div className="hist-note">
                          {checkIn.value_rating != null && `Rating: ${checkIn.value_rating}. `}
                          {checkIn.note ?? (checkIn.value_bool === false ? 'Skipped.' : 'Done.')}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {activeMilestone ? (
            <form onSubmit={handleSubmit} className="raised checkin-card">
              <div className="checkin-title">Log a check in for "{activeMilestone.title}"</div>
              {activeMilestone.check_in_kind === 'rating' ? (
                <div className="auth-field">
                  <label className="label" htmlFor="milestone-value-rating">
                    Rating (1 to 5)
                  </label>
                  <input
                    id="milestone-value-rating"
                    type="number"
                    min={1}
                    max={5}
                    required
                    value={valueRating}
                    onChange={(e) => setValueRating(e.target.value)}
                    className="input"
                  />
                </div>
              ) : (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={valueBool}
                    onChange={(e) => setValueBool(e.target.checked)}
                  />
                  Done today
                </label>
              )}
              <div className="auth-field">
                <label className="label" htmlFor="milestone-checkin-note">
                  Note, this part is optional
                </label>
                <textarea
                  id="milestone-checkin-note"
                  rows={2}
                  placeholder="Anything worth remembering?"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="input"
                />
              </div>
              <div className="auth-field">
                <label className="label" htmlFor="milestone-checked-in-at">
                  Checked in at
                </label>
                <input
                  id="milestone-checked-in-at"
                  type="datetime-local"
                  value={checkedInAt}
                  onChange={(e) => setCheckedInAt(e.target.value)}
                  className="input"
                />
              </div>
              {submitError && <p role="alert">{submitError}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary-goal"
                style={{ justifyContent: 'center' }}
              >
                Save check in
              </button>
            </form>
          ) : (
            <div className="raised" style={{ padding: 22 }}>
              <p className="card-sub">
                {goal.status === 'backlog'
                  ? 'Activate this goal to start its first milestone and check in.'
                  : 'No milestone is currently active.'}
              </p>
            </div>
          )}

          {activeMilestone && (activeMilestone.status === 'active' || activeMilestone.status === 'reflect') && (
            <form onSubmit={handleMilestoneArchiveSubmit} className="raised checkin-card">
              <div className="checkin-title">Complete "{activeMilestone.title}"</div>
              <button
                type="button"
                onClick={toggleMilestoneArchiveMode}
                disabled={archivingMilestone}
                className="btn btn-text"
              >
                {milestoneArchiveMode === 'retro' ? 'Switch to abandon early' : 'Switch to retro'}
              </button>
              {milestoneArchiveMode === 'retro' ? (
                <>
                  <input
                    type="text"
                    placeholder="What worked"
                    value={milestoneWhatWorked}
                    onChange={(e) => setMilestoneWhatWorked(e.target.value)}
                    className="input"
                  />
                  <input
                    type="text"
                    placeholder="What didn't"
                    value={milestoneWhatDidnt}
                    onChange={(e) => setMilestoneWhatDidnt(e.target.value)}
                    className="input"
                  />
                  <div className="auth-field">
                    <label className="label">Decision</label>
                    <div className="raised-sm segmented" role="radiogroup" aria-label="Milestone decision">
                      {DECISION_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={milestoneDecision === option.value}
                          className={`seg-btn${milestoneDecision === option.value ? ' active' : ''}`}
                          onClick={() => setMilestoneDecision(option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <input
                  type="text"
                  placeholder="Abandon reason"
                  value={milestoneAbandonReason}
                  onChange={(e) => setMilestoneAbandonReason(e.target.value)}
                  className="input"
                />
              )}
              {milestoneArchiveError && <p role="alert">{milestoneArchiveError}</p>}
              <div className="footer-actions">
                <button
                  type="submit"
                  disabled={archivingMilestone}
                  className="btn btn-text"
                  style={{ color: 'var(--danger)' }}
                >
                  Complete milestone
                </button>
              </div>
            </form>
          )}

          {(goal.status === 'active' || goal.status === 'reflect') && (
            <form onSubmit={handleGoalArchiveSubmit} className="raised checkin-card">
              <div className="checkin-title">Complete this goal</div>
              <button type="button" onClick={toggleGoalArchiveMode} disabled={archivingGoal} className="btn btn-text">
                {goalArchiveMode === 'retro' ? 'Switch to abandon early' : 'Switch to retro'}
              </button>
              {goalArchiveMode === 'retro' ? (
                <>
                  <input
                    type="text"
                    placeholder="What worked"
                    value={goalWhatWorked}
                    onChange={(e) => setGoalWhatWorked(e.target.value)}
                    className="input"
                  />
                  <input
                    type="text"
                    placeholder="What didn't"
                    value={goalWhatDidnt}
                    onChange={(e) => setGoalWhatDidnt(e.target.value)}
                    className="input"
                  />
                  <div className="auth-field">
                    <label className="label">Decision</label>
                    <div className="raised-sm segmented" role="radiogroup" aria-label="Goal decision">
                      {DECISION_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={goalDecision === option.value}
                          className={`seg-btn${goalDecision === option.value ? ' active' : ''}`}
                          onClick={() => setGoalDecision(option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <input
                  type="text"
                  placeholder="Abandon reason"
                  value={goalAbandonReason}
                  onChange={(e) => setGoalAbandonReason(e.target.value)}
                  className="input"
                />
              )}
              {goalArchiveError && <p role="alert">{goalArchiveError}</p>}
              <div className="footer-actions">
                <button
                  type="submit"
                  disabled={archivingGoal}
                  className="btn btn-text"
                  style={{ color: 'var(--danger)' }}
                >
                  Archive goal
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default GoalDetail
