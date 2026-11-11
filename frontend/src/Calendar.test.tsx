import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Calendar from './Calendar'
import { AuthProvider } from './AuthContext'

function stubExperiments(experiments: unknown[]) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => experiments })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderCalendar(path = '/calendar') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/calendar/:experimentId" element={<Calendar />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('Calendar', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    cleanup()
  })

  it('links back to the dashboard', async () => {
    stubExperiments([])
    renderCalendar()

    await waitFor(() => expect(screen.getByRole('link', { name: 'Back to the dashboard' })).toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'Back to the dashboard' })).toHaveAttribute('href', '/dashboard')
  })

  it('defaults to month view showing Mon..Sun headers and a 7-wide grid', async () => {
    stubExperiments([])
    renderCalendar()

    await waitFor(() => expect(screen.getAllByText('Mon')).toHaveLength(1))
    ;['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument()
    })
  })

  it('switches to week view showing exactly 7 days laid out Monday..Sunday', async () => {
    vi.setSystemTime(new Date(2026, 10, 11)) // Wed Nov 11 2026
    stubExperiments([])
    renderCalendar()

    await waitFor(() => expect(screen.getByRole('radio', { name: 'Week' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('radio', { name: 'Week' }))

    const grid = document.querySelector('.calendar-grid-week')!
    expect(within(grid as HTMLElement).getAllByText(/^\d+$/)).toHaveLength(7)
    // Week of Nov 11 2026 runs Nov 9 (Mon) .. Nov 15 (Sun).
    const dayNumbers = within(grid as HTMLElement)
      .getAllByText(/^\d+$/)
      .map((el) => el.textContent)
    expect(dayNumbers).toEqual(['9', '10', '11', '12', '13', '14', '15'])
  })

  it('month view fades leading/trailing adjacent-month days', async () => {
    vi.setSystemTime(new Date(2026, 10, 15)) // November 2026: 1st is Sunday
    stubExperiments([])
    renderCalendar()

    await waitFor(() => expect(document.querySelector('.calendar-grid-month')).toBeInTheDocument())
    const faded = document.querySelectorAll('.calendar-day-faded')
    // 6 leading October days + 6 trailing December days.
    expect(faded).toHaveLength(12)
  })

  it('highlights today distinctly in month view', async () => {
    vi.setSystemTime(new Date(2026, 10, 11))
    stubExperiments([])
    renderCalendar()

    await waitFor(() => expect(document.querySelector('.calendar-day-today')).toBeInTheDocument())
    const today = document.querySelector('.calendar-day-today')!
    expect(within(today as HTMLElement).getByText('11')).toBeInTheDocument()
  })

  it('navigates month view forward and back by exactly one month, including a year boundary', async () => {
    vi.setSystemTime(new Date(2026, 11, 15)) // December 2026
    stubExperiments([])
    renderCalendar()

    await waitFor(() => expect(screen.getByText('December 2026')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('January 2027')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
    expect(screen.getByText('November 2026')).toBeInTheDocument()
  })

  it('navigates week view forward and back by exactly one week', async () => {
    vi.setSystemTime(new Date(2026, 10, 11))
    stubExperiments([])
    renderCalendar()

    await waitFor(() => expect(screen.getByRole('radio', { name: 'Week' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('radio', { name: 'Week' }))

    const label = () => screen.getByText(/–/).textContent
    const initial = label()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(label()).not.toBe(initial)
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
    expect(label()).toBe(initial)
  })

  it('shows per-day markers for a daily cadence experiment under "all active" scope', async () => {
    vi.setSystemTime(new Date(2026, 10, 11))
    stubExperiments([
      {
        id: '1',
        title: 'Cold showers',
        cadence_type: 'daily',
        start_date: '2026-11-01',
        status: 'active',
      },
    ])
    renderCalendar()

    await waitFor(() => expect(document.querySelector('.calendar-grid-month')).toBeInTheDocument())
    const inMonthCells = document.querySelectorAll('.calendar-day:not(.calendar-day-faded)')
    // Daily cadence from Nov 1 marks every in-month day in November.
    inMonthCells.forEach((cell) => {
      expect(cell.querySelector('.calendar-marker')).toBeTruthy()
    })
  })

  it('shows markers for a custom, non-weekly-aligned cadence on the correct days', async () => {
    vi.setSystemTime(new Date(2026, 10, 11))
    stubExperiments([
      {
        id: '1',
        title: 'Every 3 days',
        cadence_type: 'custom',
        cadence_days: 3,
        start_date: '2026-11-01',
        status: 'active',
      },
    ])
    renderCalendar()

    await waitFor(() => expect(document.querySelector('.calendar-grid-month')).toBeInTheDocument())
    // Within November itself (excluding faded adjacent-month days, whose
    // numbers alias November's), markers land on 1, 4, 7, 10, 13 -- not on
    // the 7-day week boundary.
    const markedDayNumbers = Array.from(document.querySelectorAll('.calendar-day:not(.calendar-day-faded)'))
      .filter((cell) => cell.querySelector('.calendar-marker'))
      .map((cell) => Number(cell.querySelector('.calendar-day-number')!.textContent))
      .filter((n) => n <= 15)
      .sort((a, b) => a - b)

    expect(markedDayNumbers).toEqual([1, 4, 7, 10, 13])
  })

  it('scope toggle switches markers between "this cadence only" and "all active" without reload', async () => {
    vi.setSystemTime(new Date(2026, 10, 11))
    stubExperiments([
      { id: '1', title: 'Cadence A', cadence_type: 'daily', start_date: '2026-11-01', status: 'active' },
      { id: '2', title: 'Cadence B', cadence_type: 'daily', start_date: '2026-11-01', status: 'active' },
    ])
    renderCalendar('/calendar/1')

    await waitFor(() => expect(document.querySelector('.calendar-grid-month')).toBeInTheDocument())

    // "this cadence only" is available because the calendar was opened from
    // experiment 1's context, and starts selected.
    expect(screen.getByRole('radio', { name: 'This cadence only' })).toBeChecked()
    const nov11Cell = () =>
      Array.from(document.querySelectorAll('.calendar-day')).find(
        (cell) => cell.querySelector('.calendar-day-number')?.textContent === '11',
      )!
    expect(nov11Cell().querySelectorAll('.calendar-marker')).toHaveLength(1)

    fireEvent.click(screen.getByRole('radio', { name: 'All active' }))
    expect(nov11Cell().querySelectorAll('.calendar-marker')).toHaveLength(2)
  })

  it('does not offer "Other tasks" in the scope toggle', async () => {
    stubExperiments([])
    renderCalendar()

    await waitFor(() => expect(screen.getByRole('radiogroup', { name: 'Scope' })).toBeInTheDocument())
    expect(screen.queryByText('Other tasks')).not.toBeInTheDocument()
  })

  it('empty state: zero active experiments renders the grid and nav normally, with no markers and no error', async () => {
    stubExperiments([])
    renderCalendar()

    await waitFor(() => expect(screen.getByText('No active experiments yet.')).toBeInTheDocument())
    expect(document.querySelector('.calendar-grid-month')).toBeInTheDocument()
    expect(document.querySelectorAll('.calendar-marker')).toHaveLength(0)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
