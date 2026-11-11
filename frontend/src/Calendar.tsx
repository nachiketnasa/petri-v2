import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from './AuthContext'
import {
  addDays,
  addMonths,
  dayDiff,
  dayStatus,
  getMonthGridDays,
  getWeekDays,
  isCadenceDay,
  isSameDay,
  type DayStatus,
  toLocalDateKey,
} from './calendarMath'
import './neumorphic.css'

const BASE_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000'

type Marker = { key: string; label: string; status: DayStatus; kind: 'experiment' | 'goal' }

type ViewMode = 'week' | 'month'
type Scope = 'cadence' | 'all'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function monthLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

function weekLabel(days: Date[]): string {
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return `${fmt(days[0])} – ${fmt(days[6])}, ${days[6].getFullYear()}`
}

const STATUS_LABEL: Record<DayStatus, string> = {
  upcoming: 'scheduled',
  completed: 'completed',
  missed: 'missed',
}

function DayCell({
  date,
  faded,
  isToday,
  markers,
}: {
  date: Date
  faded: boolean
  isToday: boolean
  markers: Marker[]
}) {
  const classes = [isToday ? 'raised' : 'inset', 'calendar-day']
  if (faded) classes.push('calendar-day-faded')
  if (isToday) classes.push('calendar-day-today')

  return (
    <div className={classes.join(' ')}>
      <span className="calendar-day-number">{date.getDate()}</span>
      {markers.length > 0 && (
        <div className="calendar-day-markers">
          {markers.map(({ key, label, status, kind }) => (
            <span
              key={key}
              className={`calendar-marker calendar-marker-${status}${kind === 'goal' ? ' calendar-marker-goal' : ''}`}
              title={label}
              aria-label={`${label} ${STATUS_LABEL[status]}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Calendar() {
  const { experiments, goals } = useAuth()
  const { experimentId } = useParams<{ experimentId?: string }>()
  const [view, setView] = useState<ViewMode>('month')
  const [anchor, setAnchor] = useState(() => new Date())
  const [scope, setScope] = useState<Scope>(experimentId ? 'cadence' : 'all')

  const contextExperiment = useMemo(
    () => experiments?.find((e) => e.id === experimentId) ?? null,
    [experiments, experimentId],
  )

  const scopedExperiments = useMemo(() => {
    if (!experiments) return []
    if (scope === 'cadence') return contextExperiment ? [contextExperiment] : []
    return experiments.filter((e) => e.status === 'active')
  }, [experiments, scope, contextExperiment])

  // Goals don't have a "this cadence only" view of their own (that scope is
  // an experiment concept) -- they only ever show up under "all active".
  const scopedGoals = useMemo(() => {
    if (scope !== 'all' || !goals) return []
    return goals.filter((g) => g.status === 'active')
  }, [goals, scope])

  // Real completed-vs-missed marking (#35) needs each scoped experiment's
  // persisted check-in history (#28), not just same-session state -- keyed
  // by experiment id so a day's status survives a reload or a different
  // device/session, per #35's own acceptance criteria.
  const [checkInDatesByExperiment, setCheckInDatesByExperiment] = useState<
    Record<string, Set<string>>
  >({})

  useEffect(() => {
    scopedExperiments.forEach((experiment) => {
      fetch(`${BASE_URL}/experiments/${experiment.id}/check-ins`, { credentials: 'include' })
        .then(async (res) => {
          if (!res.ok) return
          const checkIns: { checked_in_at: string }[] = await res.json()
          const dates = new Set(checkIns.map((c) => toLocalDateKey(new Date(c.checked_in_at))))
          setCheckInDatesByExperiment((prev) => ({ ...prev, [experiment.id]: dates }))
        })
        .catch(() => {})
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedExperiments.map((e) => e.id).join(',')])

  const today = new Date()

  const weekDays = useMemo(() => getWeekDays(anchor), [anchor])
  const monthDays = useMemo(() => getMonthGridDays(anchor), [anchor])

  function markersFor(date: Date): Marker[] {
    const dateKey = toLocalDateKey(date)

    const experimentMarkers: Marker[] = scopedExperiments
      .filter((e) => isCadenceDay(e, date))
      .map((experiment) => ({
        key: `exp-${experiment.id}`,
        label: experiment.title,
        status: dayStatus(date, today, checkInDatesByExperiment[experiment.id] ?? new Set()),
        kind: 'experiment' as const,
      }))

    // Goals/milestones have no recurring cadence of their own in the data
    // (no stored "milestone started on" date) -- what's real is the goal's
    // own target_date and each milestone's optional target_date, so those
    // are what get marked: a due-date marker, not a cadence occurrence.
    const goalMarkers: Marker[] = scopedGoals
      .filter((goal) => goal.target_date === dateKey || goal.milestones.some((m) => m.target_date === dateKey))
      .map((goal) => ({
        key: `goal-${goal.id}`,
        label: goal.title,
        status: dayDiff(today, date) >= 0 ? 'upcoming' : 'missed',
        kind: 'goal' as const,
      }))

    return [...experimentMarkers, ...goalMarkers]
  }

  function goPrev() {
    setAnchor((current) => (view === 'week' ? addDays(current, -7) : addMonths(current, -1)))
  }

  function goNext() {
    setAnchor((current) => (view === 'week' ? addDays(current, 7) : addMonths(current, 1)))
  }

  return (
    <div className="calendar-screen">
      <div className="crumb">
        <Link to="/dashboard">Back to the dashboard</Link>
      </div>

      <div className="calendar-controls">
        <div className="raised-sm segmented" role="radiogroup" aria-label="Scope">
          <button
            type="button"
            role="radio"
            aria-checked={scope === 'cadence'}
            className={`seg-btn${scope === 'cadence' ? ' active' : ''}`}
            onClick={() => setScope('cadence')}
            disabled={!contextExperiment}
          >
            This cadence only
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={scope === 'all'}
            className={`seg-btn${scope === 'all' ? ' active' : ''}`}
            onClick={() => setScope('all')}
          >
            All active
          </button>
        </div>

        <div className="raised-sm segmented" role="radiogroup" aria-label="Calendar view">
          <button
            type="button"
            role="radio"
            aria-checked={view === 'week'}
            className={`seg-btn${view === 'week' ? ' active' : ''}`}
            onClick={() => setView('week')}
          >
            Week
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={view === 'month'}
            className={`seg-btn${view === 'month' ? ' active' : ''}`}
            onClick={() => setView('month')}
          >
            Month
          </button>
        </div>
      </div>

      <div className="calendar-nav">
        <button type="button" className="btn btn-text btn-icon" aria-label="Previous" onClick={goPrev}>
          ‹
        </button>
        <span className="calendar-nav-label">
          {view === 'week' ? weekLabel(weekDays) : monthLabel(anchor)}
        </span>
        <button type="button" className="btn btn-text btn-icon" aria-label="Next" onClick={goNext}>
          ›
        </button>
      </div>

      {experiments && experiments.filter((e) => e.status === 'active').length === 0 && (
        <p className="calendar-empty-state">No active experiments yet.</p>
      )}

      <div className="raised" style={{ padding: 26 }}>
        <div className="calendar-weekday-header">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="calendar-weekday-label">
              {label}
            </div>
          ))}
        </div>

        {view === 'week' ? (
          <div className="calendar-grid calendar-grid-week">
            {weekDays.map((date) => (
              <DayCell
                key={date.toISOString()}
                date={date}
                faded={false}
                isToday={isSameDay(date, today)}
                markers={markersFor(date)}
              />
            ))}
          </div>
        ) : (
          <div className="calendar-grid calendar-grid-month">
            {monthDays.map(({ date, inCurrentMonth }) => (
              <DayCell
                key={date.toISOString()}
                date={date}
                faded={!inCurrentMonth}
                isToday={isSameDay(date, today)}
                markers={markersFor(date)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Calendar
