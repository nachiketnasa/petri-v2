import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Calendar from './Calendar'
import { AuthProvider } from './AuthContext'

function stubExperiments(experiments: unknown[], goals: unknown[] = []) {
  const fetchMock = vi.fn((url: string) => {
    if (url.includes('/goals')) return Promise.resolve({ ok: true, json: async () => goals })
    return Promise.resolve({ ok: true, json: async () => experiments })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

// URL-aware: experiments list on the base GET /experiments call,
// per-experiment check-in history keyed by id on GET .../check-ins.
function stubExperimentsWithCheckIns(
  experiments: Array<{ id: string } & Record<string, unknown>>,
  checkInsById: Record<string, Array<{ checked_in_at: string }>>,
) {
  const fetchMock = vi.fn((url: string) => {
    const checkInsMatch = url.match(/\/experiments\/([^/]+)\/check-ins/)
    if (checkInsMatch) {
      return Promise.resolve({ ok: true, json: async () => checkInsById[checkInsMatch[1]] ?? [] })
    }
    if (url.includes('/goals')) return Promise.resolve({ ok: true, json: async () => [] })
    return Promise.resolve({ ok: true, json: async () => experiments })
  })
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

  it('shows per-day markers for a daily cadence experiment', async () => {
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

  it('shows per-day markers for an active milestone, anchored at its started_at, like an experiment', async () => {
    vi.setSystemTime(new Date(2026, 10, 11))
    stubExperiments(
      [],
      [
        {
          id: 'g1',
          title: 'Run a 10k',
          start_date: '2026-01-01',
          target_date: '2026-12-01',
          status: 'active',
          milestones: [
            {
              id: 'm1',
              title: 'Run 5k',
              cadence_type: 'daily',
              check_in_kind: 'boolean',
              started_at: '2026-11-01T00:00:00Z',
              status: 'active',
            },
          ],
        },
      ],
    )
    renderCalendar()

    await waitFor(() => expect(document.querySelector('.calendar-grid-month')).toBeInTheDocument())
    const inMonthCells = document.querySelectorAll('.calendar-day:not(.calendar-day-faded)')
    inMonthCells.forEach((cell) => {
      expect(cell.querySelector('.calendar-marker-goal')).toBeTruthy()
    })
  })

  it('does not mark anything for an active goal whose active milestone has no started_at yet (defensive)', async () => {
    vi.setSystemTime(new Date(2026, 10, 11))
    stubExperiments(
      [],
      [
        {
          id: 'g1',
          title: 'Run a 10k',
          start_date: '2026-01-01',
          target_date: '2026-12-01',
          status: 'active',
          milestones: [
            { id: 'm1', title: 'Run 5k', cadence_type: 'daily', check_in_kind: 'boolean', status: 'active' },
          ],
        },
      ],
    )
    renderCalendar()

    await waitFor(() => expect(document.querySelector('.calendar-grid-month')).toBeInTheDocument())
    expect(document.querySelectorAll('.calendar-marker-goal')).toHaveLength(0)
  })

  it('does not offer a scope toggle', async () => {
    stubExperiments([])
    renderCalendar()

    await waitFor(() => expect(document.querySelector('.calendar-grid-month')).toBeInTheDocument())
    expect(screen.queryByRole('radiogroup', { name: 'Scope' })).not.toBeInTheDocument()
    expect(screen.queryByText('This cadence only')).not.toBeInTheDocument()
  })

  it('marks a past scheduled day with a real check-in as completed (#35)', async () => {
    vi.setSystemTime(new Date(2026, 10, 11))
    stubExperimentsWithCheckIns(
      [{ id: '1', title: 'Cold showers', cadence_type: 'daily', start_date: '2026-11-01', status: 'active' }],
      { '1': [{ checked_in_at: '2026-11-05T09:00:00Z' }] },
    )
    renderCalendar()

    await waitFor(() => expect(document.querySelector('.calendar-marker')).toBeInTheDocument())
    const day5 = Array.from(document.querySelectorAll('.calendar-day')).find(
      (cell) => cell.querySelector('.calendar-day-number')?.textContent === '5',
    )!
    await waitFor(() => expect(day5.querySelector('.calendar-marker-completed')).toBeTruthy())
  })

  it('marks a past scheduled day with no check-in as missed, distinct from completed (#35)', async () => {
    vi.setSystemTime(new Date(2026, 10, 11))
    stubExperimentsWithCheckIns(
      [{ id: '1', title: 'Cold showers', cadence_type: 'daily', start_date: '2026-11-01', status: 'active' }],
      { '1': [] },
    )
    renderCalendar()

    await waitFor(() => expect(document.querySelector('.calendar-marker')).toBeInTheDocument())
    const day5 = Array.from(document.querySelectorAll('.calendar-day')).find(
      (cell) => cell.querySelector('.calendar-day-number')?.textContent === '5',
    )!
    await waitFor(() => expect(day5.querySelector('.calendar-marker-missed')).toBeTruthy())
  })

  it('marks a future scheduled day as upcoming, not missed, even with no check-in', async () => {
    vi.setSystemTime(new Date(2026, 10, 11))
    stubExperimentsWithCheckIns(
      [{ id: '1', title: 'Cold showers', cadence_type: 'daily', start_date: '2026-11-01', status: 'active' }],
      { '1': [] },
    )
    renderCalendar()

    await waitFor(() => expect(document.querySelector('.calendar-marker')).toBeInTheDocument())
    const day20 = Array.from(document.querySelectorAll('.calendar-day')).find(
      (cell) => cell.querySelector('.calendar-day-number')?.textContent === '20',
    )!
    await waitFor(() => expect(day20.querySelector('.calendar-marker-upcoming')).toBeTruthy())
  })

  it('empty state: zero active experiments or goals renders the grid and nav normally, with no markers and no error', async () => {
    stubExperiments([])
    renderCalendar()

    await waitFor(() => expect(screen.getByText('No active experiments or goals yet.')).toBeInTheDocument())
    expect(document.querySelector('.calendar-grid-month')).toBeInTheDocument()
    expect(document.querySelectorAll('.calendar-marker')).toHaveLength(0)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not show the empty state when there are zero active experiments but an active goal milestone exists', async () => {
    vi.setSystemTime(new Date(2026, 10, 11))
    stubExperiments(
      [],
      [
        {
          id: 'g1',
          title: 'Run a 10k',
          start_date: '2026-01-01',
          target_date: '2026-12-01',
          status: 'active',
          milestones: [
            {
              id: 'm1',
              title: 'Run 5k',
              cadence_type: 'daily',
              check_in_kind: 'boolean',
              started_at: '2026-11-01T00:00:00Z',
              status: 'active',
            },
          ],
        },
      ],
    )
    renderCalendar()

    await waitFor(() => expect(document.querySelector('.calendar-marker-goal')).toBeInTheDocument())
    expect(screen.queryByText('No active experiments or goals yet.')).not.toBeInTheDocument()
  })
})
