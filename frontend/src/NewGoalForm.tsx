import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { playTone } from './sound'
import './neumorphic.css'

const BASE_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000'

type Step = 0 | 1 | 2

const STEP_NAMES = ['Details', 'Milestones', 'Review'] as const

const CADENCE_TYPE_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'custom', label: 'Custom' },
] as const

const CHECK_IN_KIND_OPTIONS = [
  { value: 'boolean', label: 'Boolean' },
  { value: 'rating', label: 'Rating' },
] as const

let nextMilestoneKey = 0

type MilestoneDraft = {
  key: number
  title: string
  cadenceType: string
  cadenceDays: string
  checkInKind: string
  targetDate: string
}

function newMilestoneDraft(): MilestoneDraft {
  return {
    key: nextMilestoneKey++,
    title: '',
    cadenceType: '',
    cadenceDays: '',
    checkInKind: '',
    targetDate: '',
  }
}

function NewGoalForm() {
  const navigate = useNavigate()
  const { refetch } = useAuth()

  const [step, setStep] = useState<Step>(0)
  const [furthest, setFurthest] = useState<Step>(0)

  const [title, setTitle] = useState('')
  const [whyText, setWhyText] = useState('')
  const [startDate, setStartDate] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([newMilestoneDraft()])

  const [stepError, setStepError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    playTone('wizard-open')
  }, [])

  function goToStep(target: Step) {
    if (target > furthest) return
    setStepError(null)
    setStep(target)
  }

  function handleBack() {
    setStepError(null)
    setStep((s) => (s - 1) as Step)
  }

  function handleDetailsNext(e: React.FormEvent) {
    e.preventDefault()
    if (title === '' || whyText === '' || startDate === '' || targetDate === '') {
      setStepError('Please fill in title, why this goal, start date, and target date.')
      return
    }
    setStepError(null)
    setStep(1)
    setFurthest((f) => (f < 1 ? 1 : f))
  }

  function updateMilestone(key: number, fields: Partial<MilestoneDraft>) {
    setMilestones((list) => list.map((m) => (m.key === key ? { ...m, ...fields } : m)))
  }

  function addMilestone() {
    setMilestones((list) => [...list, newMilestoneDraft()])
  }

  function removeMilestone(key: number) {
    setMilestones((list) => list.filter((m) => m.key !== key))
  }

  function moveMilestone(key: number, direction: -1 | 1) {
    setMilestones((list) => {
      const index = list.findIndex((m) => m.key === key)
      const target = index + direction
      if (index === -1 || target < 0 || target >= list.length) return list
      const next = [...list]
      const [entry] = next.splice(index, 1)
      next.splice(target, 0, entry)
      return next
    })
  }

  function handleMilestonesNext(e: React.FormEvent) {
    e.preventDefault()
    if (milestones.length === 0) {
      setStepError('At least one milestone is required.')
      return
    }
    for (const m of milestones) {
      if (m.title === '' || m.cadenceType === '') {
        setStepError('Every milestone needs a title and a cadence type.')
        return
      }
      if (m.cadenceType === 'custom' && m.cadenceDays === '') {
        setStepError("cadence_days is required when a milestone's cadence_type is 'custom'.")
        return
      }
    }
    setStepError(null)
    setStep(2)
    setFurthest((f) => (f < 2 ? 2 : f))
  }

  function handleSubmit() {
    setSubmitError(null)

    const body = {
      title,
      why_text: whyText,
      start_date: startDate,
      target_date: targetDate,
      milestones: milestones.map((m) => {
        const spec: Record<string, unknown> = { title: m.title, cadence_type: m.cadenceType }
        if (m.cadenceDays !== '') spec.cadence_days = Number(m.cadenceDays)
        if (m.checkInKind !== '') spec.check_in_kind = m.checkInKind
        if (m.targetDate !== '') spec.target_date = m.targetDate
        return spec
      }),
    }

    setSubmitting(true)

    fetch(`${BASE_URL}/goals`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail)
        playTone('wizard-submit')
        refetch()
        navigate('/dashboard')
      })
      .catch((err: Error) => setSubmitError(err.message))
      .finally(() => setSubmitting(false))
  }

  return (
    <>
      <div className="wizard-crumb-wrap">
        <div className="crumb">
          <Link to="/dashboard">Back to the dashboard</Link>
        </div>
      </div>
      <div className="wizard">
      <nav className="wizard-rail" aria-label="Wizard steps">
        <ol>
          {STEP_NAMES.map((name, index) => {
            const isCurrent = index === step
            const isCompleted = index < furthest && !isCurrent
            const isReached = (index as Step) <= furthest
            const classNames = ['wizard-step-button']
            if (isCurrent) classNames.push('current')
            if (isCompleted) classNames.push('completed')
            return (
              <li key={name}>
                <button
                  type="button"
                  className={classNames.join(' ')}
                  disabled={!isReached || isCurrent}
                  onClick={() => goToStep(index as Step)}
                >
                  {isCompleted && <span aria-hidden="true">✓ </span>}
                  {name}
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      <div className="wizard-content">
        {step === 0 && (
          <form onSubmit={handleDetailsNext} className="raised" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2>Details</h2>
            <input
              type="text"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
            />
            <input
              type="text"
              placeholder="Why this goal"
              value={whyText}
              onChange={(e) => setWhyText(e.target.value)}
              className="input"
            />
            <div className="auth-field">
              <label className="label" htmlFor="goal-start-date">
                Start date
              </label>
              <input
                id="goal-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input"
              />
            </div>
            <div className="auth-field">
              <label className="label" htmlFor="goal-target-date">
                Target date
              </label>
              <input
                id="goal-target-date"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="input"
              />
            </div>
            {stepError && <p role="alert">{stepError}</p>}
            <button type="submit" className="btn btn-primary-goal">
              Next
            </button>
          </form>
        )}

        {step === 1 && (
          <form onSubmit={handleMilestonesNext} className="raised" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2>Milestones</h2>
            {milestones.map((m, index) => (
              <div key={m.key} className="raised-sm" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="label" style={{ margin: 0 }}>
                    Milestone {index + 1}
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-text btn-icon"
                      aria-label={`Move milestone ${index + 1} up`}
                      disabled={index === 0}
                      onClick={() => moveMilestone(m.key, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn btn-text btn-icon"
                      aria-label={`Move milestone ${index + 1} down`}
                      disabled={index === milestones.length - 1}
                      onClick={() => moveMilestone(m.key, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="btn btn-text"
                      aria-label={`Remove milestone ${index + 1}`}
                      disabled={milestones.length === 1}
                      onClick={() => removeMilestone(m.key)}
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  placeholder="Milestone title"
                  value={m.title}
                  onChange={(e) => updateMilestone(m.key, { title: e.target.value })}
                  className="input"
                />

                <div className="auth-field">
                  <label className="label">Cadence type</label>
                  <div className="raised-sm segmented" role="radiogroup" aria-label={`Milestone ${index + 1} cadence type`}>
                    {CADENCE_TYPE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={m.cadenceType === option.value}
                        className={`seg-btn${m.cadenceType === option.value ? ' active' : ''}`}
                        onClick={() => updateMilestone(m.key, { cadenceType: option.value })}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {m.cadenceType === 'custom' && (
                  <input
                    type="number"
                    placeholder="Cadence days"
                    value={m.cadenceDays}
                    onChange={(e) => updateMilestone(m.key, { cadenceDays: e.target.value })}
                    className="input"
                  />
                )}

                <div className="auth-field">
                  <label className="label">Check-in kind</label>
                  <div className="raised-sm segmented" role="radiogroup" aria-label={`Milestone ${index + 1} check-in kind`}>
                    {CHECK_IN_KIND_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={m.checkInKind === option.value}
                        className={`seg-btn${m.checkInKind === option.value ? ' active' : ''}`}
                        onClick={() => updateMilestone(m.key, { checkInKind: option.value })}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="auth-field">
                  <label className="label" htmlFor={`milestone-target-date-${m.key}`}>
                    Target date (optional)
                  </label>
                  <input
                    id={`milestone-target-date-${m.key}`}
                    type="date"
                    value={m.targetDate}
                    onChange={(e) => updateMilestone(m.key, { targetDate: e.target.value })}
                    className="input"
                  />
                </div>
              </div>
            ))}

            <button type="button" onClick={addMilestone} className="btn btn-goal">
              Add milestone
            </button>

            {stepError && <p role="alert">{stepError}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={handleBack} className="btn btn-text">
                Back
              </button>
              <button type="submit" className="btn btn-primary-goal">
                Next
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <div className="raised" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2>Review</h2>
            <p>Title: {title}</p>
            <p>Why this goal: {whyText}</p>
            <p>Start date: {startDate}</p>
            <p>Target date: {targetDate}</p>
            <p>Milestones:</p>
            <ol style={{ margin: 0, paddingLeft: 20 }}>
              {milestones.map((m) => (
                <li key={m.key}>
                  {m.title} — {CADENCE_TYPE_OPTIONS.find((o) => o.value === m.cadenceType)?.label ?? m.cadenceType}
                  {m.cadenceDays !== '' ? ` every ${m.cadenceDays} days` : ''}
                  {m.checkInKind !== ''
                    ? `, ${CHECK_IN_KIND_OPTIONS.find((o) => o.value === m.checkInKind)?.label ?? m.checkInKind} check-ins`
                    : ''}
                  {m.targetDate !== '' ? `, target ${m.targetDate}` : ''}
                </li>
              ))}
            </ol>
            {submitError && <p role="alert">{submitError}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={handleBack} className="btn btn-text">
                Back
              </button>
              <button type="button" onClick={handleSubmit} disabled={submitting} className="btn btn-primary-goal">
                Create goal
              </button>
            </div>
          </div>
        )}
      </div>
      </div>
    </>
  )
}

export default NewGoalForm
