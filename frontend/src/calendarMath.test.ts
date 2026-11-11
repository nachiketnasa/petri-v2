import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  dayStatus,
  getMonthGridDays,
  getWeekDays,
  isCadenceDay,
  isSameDay,
  localDate,
  startOfWeekMonday,
  toLocalDateKey,
} from './calendarMath'

describe('getWeekDays', () => {
  it('returns Monday through Sunday for a date mid-week', () => {
    // 2026-11-11 is a Wednesday.
    const days = getWeekDays(localDate(2026, 10, 11))
    expect(days).toHaveLength(7)
    expect(days[0].getDay()).toBe(1) // Monday
    expect(days[6].getDay()).toBe(0) // Sunday
    expect(days[0].getDate()).toBe(9)
    expect(days[6].getDate()).toBe(15)
  })

  it('stays within its own 7-day span, not a slice of the month grid', () => {
    const days = getWeekDays(localDate(2026, 10, 11))
    const dates = days.map((d) => d.getDate())
    expect(dates).toEqual([9, 10, 11, 12, 13, 14, 15])
  })
})

describe('startOfWeekMonday', () => {
  it('treats Sunday as the last day of its own week, not week 1', () => {
    const sunday = localDate(2026, 10, 15)
    const monday = startOfWeekMonday(sunday)
    expect(monday.getDay()).toBe(1)
    expect(monday.getDate()).toBe(9)
  })
})

describe('getMonthGridDays', () => {
  it('starts on the Monday of the week containing the 1st and ends on the Sunday closing the last week', () => {
    // November 2026: 1st is a Sunday, 30th is a Monday.
    const grid = getMonthGridDays(localDate(2026, 10, 15))
    const first = grid[0]
    const last = grid[grid.length - 1]

    expect(first.date.getDay()).toBe(1)
    expect(last.date.getDay()).toBe(0)
    expect(grid.length % 7).toBe(0)

    // Every day of November appears and is marked in-month.
    const novemberDays = grid.filter((d) => d.inCurrentMonth)
    expect(novemberDays).toHaveLength(30)
    expect(novemberDays[0].date.getDate()).toBe(1)
    expect(novemberDays[29].date.getDate()).toBe(30)
  })

  it('fades leading/trailing adjacent-month days', () => {
    const grid = getMonthGridDays(localDate(2026, 10, 15))
    const leading = grid.filter((d) => !d.inCurrentMonth && d.date < localDate(2026, 10, 1))
    const trailing = grid.filter((d) => !d.inCurrentMonth && d.date > localDate(2026, 10, 30))

    // Nov 1 2026 is a Sunday, so 6 leading October days complete that week.
    expect(leading).toHaveLength(6)
    expect(leading.every((d) => d.date.getMonth() === 9)).toBe(true)

    // Nov 30 2026 is a Monday, so 6 trailing December days close that week.
    expect(trailing).toHaveLength(6)
    expect(trailing.every((d) => d.date.getMonth() === 11)).toBe(true)
  })

  it('produces no duplicate or missing days across the grid', () => {
    const grid = getMonthGridDays(localDate(2026, 10, 15))
    const timestamps = grid.map((d) => d.date.getTime())
    expect(new Set(timestamps).size).toBe(timestamps.length)
    for (let i = 1; i < grid.length; i++) {
      expect(grid[i].date.getTime() - grid[i - 1].date.getTime()).toBe(86_400_000)
    }
  })
})

describe('navigation math (prev/next by week/month, multi-year)', () => {
  it('moves by exactly one week with addDays(±7)', () => {
    const anchor = localDate(2026, 10, 11)
    expect(isSameDay(addDays(anchor, 7), localDate(2026, 10, 18))).toBe(true)
    expect(isSameDay(addDays(anchor, -7), localDate(2026, 10, 4))).toBe(true)
  })

  it('moves by exactly one month with addMonths(±1), crossing year boundaries', () => {
    const dec2026 = localDate(2026, 11, 15)
    const jan2027 = addMonths(dec2026, 1)
    expect(jan2027.getFullYear()).toBe(2027)
    expect(jan2027.getMonth()).toBe(0)

    const dec2026Again = addMonths(jan2027, -1)
    expect(dec2026Again.getFullYear()).toBe(2026)
    expect(dec2026Again.getMonth()).toBe(11)
  })

  it('stays correct after 12+ repeated month navigations in both directions', () => {
    let anchor = localDate(2026, 10, 1)
    for (let i = 0; i < 14; i++) anchor = addMonths(anchor, 1)
    expect(anchor.getFullYear()).toBe(2028)
    expect(anchor.getMonth()).toBe(0) // Nov 2026 + 14 months = Jan 2028

    for (let i = 0; i < 14; i++) anchor = addMonths(anchor, -1)
    expect(anchor.getFullYear()).toBe(2026)
    expect(anchor.getMonth()).toBe(10)
  })
})

describe('isCadenceDay', () => {
  it('daily cadence lands every day from start_date onward, never before', () => {
    const experiment = { cadence_type: 'daily', start_date: '2026-11-05' }
    expect(isCadenceDay(experiment, localDate(2026, 10, 4))).toBe(false)
    expect(isCadenceDay(experiment, localDate(2026, 10, 5))).toBe(true)
    expect(isCadenceDay(experiment, localDate(2026, 10, 6))).toBe(true)
    expect(isCadenceDay(experiment, localDate(2026, 11, 1))).toBe(true)
  })

  it('weekly cadence lands every 7th day from start_date', () => {
    const experiment = { cadence_type: 'weekly', start_date: '2026-11-02' } // Monday
    expect(isCadenceDay(experiment, localDate(2026, 10, 2))).toBe(true)
    expect(isCadenceDay(experiment, localDate(2026, 10, 3))).toBe(false)
    expect(isCadenceDay(experiment, localDate(2026, 10, 9))).toBe(true)
    expect(isCadenceDay(experiment, localDate(2026, 10, 16))).toBe(true)
  })

  it('custom cadence (non-weekly-aligned, e.g. every 3 days) lands correctly across two weeks', () => {
    const experiment = { cadence_type: 'custom', cadence_days: 3, start_date: '2026-11-01' }
    const marked = Array.from({ length: 14 }, (_, i) => i).filter((offset) =>
      isCadenceDay(experiment, addDays(localDate(2026, 10, 1), offset)),
    )
    // Day 0, 3, 6, 9, 12 across a 14-day (two-week) span: 5 marked days,
    // not aligned to the 7-day week boundary.
    expect(marked).toEqual([0, 3, 6, 9, 12])
  })

  it('custom cadence without cadence_days never matches (defensive, not expected in real data)', () => {
    const experiment = { cadence_type: 'custom', start_date: '2026-11-01' }
    expect(isCadenceDay(experiment, localDate(2026, 10, 4))).toBe(false)
  })

  it('returns false when start_date is missing', () => {
    expect(isCadenceDay({ cadence_type: 'daily' }, localDate(2026, 10, 5))).toBe(false)
  })

  it('stops matching once target_days have elapsed from start_date', () => {
    const experiment = { cadence_type: 'daily', start_date: '2026-11-01', target_days: 5 }
    expect(isCadenceDay(experiment, localDate(2026, 10, 1))).toBe(true) // day 0
    expect(isCadenceDay(experiment, localDate(2026, 10, 5))).toBe(true) // day 4, last day
    expect(isCadenceDay(experiment, localDate(2026, 10, 6))).toBe(false) // day 5, past the run
  })
})

describe('dayStatus', () => {
  const today = localDate(2026, 10, 11) // Nov 11 2026

  it('is upcoming for a day after today, regardless of check-ins', () => {
    const future = addDays(today, 2)
    expect(dayStatus(future, today, new Set())).toBe('upcoming')
  })

  it('is completed for today or a past day with a matching check-in', () => {
    expect(dayStatus(today, today, new Set([toLocalDateKey(today)]))).toBe('completed')
    const past = addDays(today, -2)
    expect(dayStatus(past, today, new Set([toLocalDateKey(past)]))).toBe('completed')
  })

  it('is missed for today or a past day with no matching check-in', () => {
    expect(dayStatus(today, today, new Set())).toBe('missed')
    const past = addDays(today, -2)
    expect(dayStatus(past, today, new Set())).toBe('missed')
  })
})

describe('toLocalDateKey', () => {
  it('formats as YYYY-MM-DD, zero-padded', () => {
    expect(toLocalDateKey(localDate(2026, 0, 5))).toBe('2026-01-05')
  })
})
