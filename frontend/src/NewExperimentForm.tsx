import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import './neumorphic.css'

const BASE_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000'

type Step = 0 | 1 | 2

const STEP_NAMES = ['Details', 'Cadence', 'Review'] as const

function NewExperimentForm() {
  const navigate = useNavigate()
  const { refetch } = useAuth()

  // Wizard position. `furthest` tracks the deepest step reached so far, so
  // the rail can tell "completed" (already validated past it) apart from
  // "not yet reached" (not clickable) even after stepping back.
  const [step, setStep] = useState<Step>(0)
  const [furthest, setFurthest] = useState<Step>(0)

  // Wizard state lives here, above the per-step views, so it survives
  // stepping back and forward within the wizard.
  const [title, setTitle] = useState('')
  const [hypothesis, setHypothesis] = useState('')
  const [cadenceType, setCadenceType] = useState('')
  const [targetDays, setTargetDays] = useState('')
  const [cadenceDays, setCadenceDays] = useState('')
  const [checkInKind, setCheckInKind] = useState('')
  const [startDate, setStartDate] = useState('')

  const [stepError, setStepError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

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
    if (title === '' || hypothesis === '') {
      setStepError('Please fill in title and hypothesis.')
      return
    }
    setStepError(null)
    setStep(1)
    setFurthest((f) => (f < 1 ? 1 : f))
  }

  function handleCadenceNext(e: React.FormEvent) {
    e.preventDefault()
    if (cadenceType === '' || targetDays === '') {
      setStepError('Please fill in cadence type and target days.')
      return
    }
    if (cadenceType === 'custom' && cadenceDays === '') {
      setStepError("cadence_days is required when cadence_type is 'custom'.")
      return
    }
    setStepError(null)
    setStep(2)
    setFurthest((f) => (f < 2 ? 2 : f))
  }

  function handleSubmit() {
    setSubmitError(null)

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
        refetch()
        navigate('/dashboard')
      })
      .catch((err: Error) => setSubmitError(err.message))
      .finally(() => setSubmitting(false))
  }

  return (
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
          <form onSubmit={handleDetailsNext}>
            <h2>Details</h2>
            <input
              type="text"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <input
              type="text"
              placeholder="Hypothesis"
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
            />
            {stepError && <p role="alert">{stepError}</p>}
            <button type="submit">Next</button>
          </form>
        )}

        {step === 1 && (
          <form onSubmit={handleCadenceNext}>
            <h2>Cadence</h2>
            <input
              type="text"
              placeholder="Cadence type"
              value={cadenceType}
              onChange={(e) => setCadenceType(e.target.value)}
            />
            <input
              type="number"
              placeholder="Target days"
              value={targetDays}
              onChange={(e) => setTargetDays(e.target.value)}
            />
            {cadenceType === 'custom' && (
              <input
                type="number"
                placeholder="Cadence days"
                value={cadenceDays}
                onChange={(e) => setCadenceDays(e.target.value)}
              />
            )}
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
            {stepError && <p role="alert">{stepError}</p>}
            <button type="button" onClick={handleBack}>
              Back
            </button>
            <button type="submit">Next</button>
          </form>
        )}

        {step === 2 && (
          <div>
            <h2>Review</h2>
            <p>Title: {title}</p>
            <p>Hypothesis: {hypothesis}</p>
            <p>
              Cadence: {cadenceType}
              {cadenceDays !== '' ? ` every ${cadenceDays} days` : ''}
            </p>
            <p>Target days: {targetDays}</p>
            {checkInKind !== '' && <p>Check-in kind: {checkInKind}</p>}
            {startDate !== '' && <p>Start date: {startDate}</p>}
            {submitError && <p role="alert">{submitError}</p>}
            <button type="button" onClick={handleBack}>
              Back
            </button>
            <button type="button" onClick={handleSubmit} disabled={submitting}>
              Create experiment
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default NewExperimentForm
