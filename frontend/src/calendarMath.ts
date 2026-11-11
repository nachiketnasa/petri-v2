// Pure date math for the Calendar screen (#11). Everything here works on
// local-date-only values (year/month/day, no time-of-day, no timezone
// conversion) per the issue's "browser's local date only" constraint.

/** Local midnight for the given y/m/d, avoiding UTC-string parsing pitfalls. */
export function localDate(year: number, monthIndex: number, day: number): Date {
  return new Date(year, monthIndex, day)
}

/** Parses a 'YYYY-MM-DD' string as a local date (not UTC, unlike `new Date(str)`). */
export function parseLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number)
  return localDate(y, m - 1, d)
}

export function addDays(date: Date, days: number): Date {
  return localDate(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

export function addMonths(date: Date, months: number): Date {
  return localDate(date.getFullYear(), date.getMonth() + months, 1)
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** Monday (ISO) of the week containing `date`. */
export function startOfWeekMonday(date: Date): Date {
  const jsDay = date.getDay() // 0 = Sunday .. 6 = Saturday
  const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay
  return addDays(date, mondayOffset)
}

/** The 7 days, Monday through Sunday, of the week containing `anchor`. */
export function getWeekDays(anchor: Date): Date[] {
  const monday = startOfWeekMonday(anchor)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

export type MonthGridDay = { date: Date; inCurrentMonth: boolean }

/**
 * Days for the month containing `anchor`: starts the Monday of the week
 * containing the 1st, ends the Sunday closing the week containing the last
 * day, so the grid is always a whole number of 7-day weeks.
 */
export function getMonthGridDays(anchor: Date): MonthGridDay[] {
  const year = anchor.getFullYear()
  const month = anchor.getMonth()
  const firstOfMonth = localDate(year, month, 1)
  const lastOfMonth = localDate(year, month + 1, 0)

  const gridStart = startOfWeekMonday(firstOfMonth)
  const lastDayWeekMonday = startOfWeekMonday(lastOfMonth)
  const gridEnd = addDays(lastDayWeekMonday, 6)

  const days: MonthGridDay[] = []
  let cursor = gridStart
  while (cursor <= gridEnd) {
    days.push({ date: cursor, inCurrentMonth: cursor.getMonth() === month })
    cursor = addDays(cursor, 1)
  }
  return days
}

export type CadenceExperiment = {
  cadence_type: string
  cadence_days?: number | null
  start_date?: string | null
  target_days?: number | null
  // A milestone has no target_days (day count); it has an optional
  // target_date instead. Both bounds are independent and optional so the
  // same function covers experiments and milestones.
  target_date?: string | null
}

/** Whole-day difference between two local dates (b - a), ignoring time-of-day. */
export function dayDiff(a: Date, b: Date): number {
  const ms = localDate(b.getFullYear(), b.getMonth(), b.getDate()).getTime() -
    localDate(a.getFullYear(), a.getMonth(), a.getDate()).getTime()
  return Math.round(ms / 86_400_000)
}

/** 'YYYY-MM-DD' for a local date, matching parseLocalDate's input format. */
export function toLocalDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export type DayStatus = 'upcoming' | 'completed' | 'missed'

/**
 * A scheduled day's real status (#35), given the set of local date keys
 * (toLocalDateKey) this experiment actually has a check-in logged on.
 * Only meaningful when isCadenceDay(experiment, date) is already true.
 */
export function dayStatus(date: Date, today: Date, checkedInDates: Set<string>): DayStatus {
  if (dayDiff(today, date) > 0) return 'upcoming'
  return checkedInDates.has(toLocalDateKey(date)) ? 'completed' : 'missed'
}

/**
 * Pure schedule math: does `date` fall on a cadence occurrence for this
 * experiment? Not a completion check (#35 is out of scope here).
 */
export function isCadenceDay(experiment: CadenceExperiment, date: Date): boolean {
  if (!experiment.start_date) return false
  const start = parseLocalDate(experiment.start_date)
  const diff = dayDiff(start, date)
  if (diff < 0) return false
  if (experiment.target_days != null && diff >= experiment.target_days) return false
  if (experiment.target_date && dayDiff(date, parseLocalDate(experiment.target_date)) < 0) return false

  switch (experiment.cadence_type) {
    case 'daily':
      return true
    case 'weekly':
      return diff % 7 === 0
    case 'custom':
      return !!experiment.cadence_days && experiment.cadence_days > 0 && diff % experiment.cadence_days === 0
    default:
      return false
  }
}
