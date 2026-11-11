import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth, type Experiment } from './AuthContext'
import {
  addDays,
  addMonths,
  getMonthGridDays,
  getWeekDays,
  isCadenceDay,
  isSameDay,
} from './calendarMath'
import './neumorphic.css'

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

function DayCell({
  date,
  faded,
  isToday,
  markers,
}: {
  date: Date
  faded: boolean
  isToday: boolean
  markers: Experiment[]
}) {
  const classes = [isToday ? 'raised' : 'inset', 'calendar-day']
  if (faded) classes.push('calendar-day-faded')
  if (isToday) classes.push('calendar-day-today')

  return (
    <div className={classes.join(' ')}>
      <span className="calendar-day-number">{date.getDate()}</span>
      {markers.length > 0 && (
        <div className="calendar-day-markers">
          {markers.map((experiment) => (
            <span
              key={experiment.id}
              className="calendar-marker"
              title={experiment.title}
              aria-label={`${experiment.title} scheduled`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Calendar() {
  const { experiments } = useAuth()
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

  const today = new Date()

  const weekDays = useMemo(() => getWeekDays(anchor), [anchor])
  const monthDays = useMemo(() => getMonthGridDays(anchor), [anchor])

  function markersFor(date: Date): Experiment[] {
    return scopedExperiments.filter((e) => isCadenceDay(e, date))
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
