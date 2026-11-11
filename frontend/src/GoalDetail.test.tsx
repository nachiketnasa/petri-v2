import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import GoalDetail from './GoalDetail'
import { playTone } from './sound'

vi.mock('./sound', () => ({ playTone: vi.fn() }))

function renderDetail(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/goals/${id}`]}>
      <Routes>
        <Route path="/goals/:id" element={<GoalDetail />} />
      </Routes>
    </MemoryRouter>,
  )
}

const backlogGoal = {
  id: 'goal-1',
  title: 'Run a 10k',
  why_text: 'Build a running habit',
  start_date: '2026-01-01',
  target_date: '2026-06-01',
  status: 'backlog',
  milestones: [
    { id: 'm1', goal_id: 'goal-1', order_index: 0, title: 'Run 5k', cadence_type: 'weekly', cadence_days: null, check_in_kind: 'boolean', target_date: null, started_at: null, status: 'backlog' },
    { id: 'm2', goal_id: 'goal-1', order_index: 1, title: 'Run 10k', cadence_type: 'weekly', cadence_days: null, check_in_kind: 'boolean', target_date: null, started_at: null, status: 'backlog' },
  ],
}

const activeGoal = {
  ...backlogGoal,
  status: 'active',
  milestones: [
    { ...backlogGoal.milestones[0], status: 'active', started_at: '2026-01-01T00:00:00Z' },
    backlogGoal.milestones[1],
  ],
}

function stubFetch(goal: unknown, checkIns: unknown[] = []) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url.includes('/check-ins') && init?.method === 'POST') {
      return Promise.resolve({ ok: true, status: 201, json: async () => ({ id: 'c1', ...JSON.parse(init.body as string) }) })
    }
    if (url.includes('/check-ins')) {
      return Promise.resolve({ ok: true, json: async () => checkIns })
    }
    return Promise.resolve({ ok: true, json: async () => goal })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('GoalDetail', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    cleanup()
  })

  it('shows the locked, ordered milestone list', async () => {
    stubFetch(backlogGoal)
    renderDetail('goal-1')

    await waitFor(() => expect(screen.getByText('Run a 10k')).toBeInTheDocument())
    expect(screen.getByText(/1\./)).toBeInTheDocument()
    expect(screen.getByText(/Run 5k — weekly/)).toBeInTheDocument()
    expect(screen.getByText(/Run 10k — weekly/)).toBeInTheDocument()
  })

  it('shows an Activate button for a backlog goal, and no check-in form yet', async () => {
    stubFetch(backlogGoal)
    renderDetail('goal-1')

    await waitFor(() => expect(screen.getByText('Run a 10k')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Activate' })).toBeInTheDocument()
    expect(screen.queryByText(/Log a check in/)).not.toBeInTheDocument()
    expect(screen.getByText(/Activate this goal/)).toBeInTheDocument()
  })

  it('activating a goal swaps in the check-in form for its newly active first milestone', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/activate')) return Promise.resolve({ ok: true, json: async () => activeGoal })
      if (url.includes('/check-ins')) return Promise.resolve({ ok: true, json: async () => [] })
      return Promise.resolve({ ok: true, json: async () => backlogGoal })
    })
    vi.stubGlobal('fetch', fetchMock)
    renderDetail('goal-1')

    await waitFor(() => expect(screen.getByRole('button', { name: 'Activate' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Activate' }))

    await waitFor(() => expect(screen.getByText(/Log a check in for "Run 5k"/)).toBeInTheDocument())
  })

  it('logs a boolean check in against the active milestone and refreshes history', async () => {
    const fetchMock = stubFetch(activeGoal)
    renderDetail('goal-1')

    await waitFor(() => expect(screen.getByText(/Log a check in for "Run 5k"/)).toBeInTheDocument())
    fireEvent.click(screen.getByLabelText('Done today'))
    fireEvent.click(screen.getByRole('button', { name: 'Save check in' }))

    await waitFor(() => expect(playTone).toHaveBeenCalledWith('check-in-log'))
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/milestones/m1/check-ins'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ value_bool: true }),
      }),
    )
  })

  it('uses a rating input instead of a checkbox when the active milestone is check_in_kind rating', async () => {
    const ratingGoal = {
      ...activeGoal,
      milestones: [{ ...activeGoal.milestones[0], check_in_kind: 'rating' }, activeGoal.milestones[1]],
    }
    stubFetch(ratingGoal)
    renderDetail('goal-1')

    await waitFor(() => expect(screen.getByLabelText('Rating (1 to 5)')).toBeInTheDocument())
    expect(screen.queryByLabelText('Done today')).not.toBeInTheDocument()
  })

  it('adds a milestone to a backlog goal and appends it to the list', async () => {
    const withThirdMilestone = {
      ...backlogGoal,
      milestones: [
        ...backlogGoal.milestones,
        { id: 'm3', goal_id: 'goal-1', order_index: 2, title: 'Run a half marathon', cadence_type: 'weekly', cadence_days: null, check_in_kind: 'boolean', target_date: null, started_at: null, status: 'backlog' },
      ],
    }
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('/milestones') && init?.method === 'POST') {
        return Promise.resolve({ ok: true, status: 201, json: async () => withThirdMilestone })
      }
      return Promise.resolve({ ok: true, json: async () => backlogGoal })
    })
    vi.stubGlobal('fetch', fetchMock)
    renderDetail('goal-1')

    await waitFor(() => expect(screen.getByText('Add a milestone')).toBeInTheDocument())
    fireEvent.change(screen.getByPlaceholderText('Milestone title'), { target: { value: 'Run a half marathon' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Weekly' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add milestone' }))

    await waitFor(() => expect(screen.getByText(/Run a half marathon — weekly/)).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/goals/goal-1/milestones'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ title: 'Run a half marathon', cadence_type: 'weekly' }),
      }),
    )
  })

  it('blocks adding a milestone when title or cadence type is missing', async () => {
    stubFetch(backlogGoal)
    renderDetail('goal-1')

    await waitFor(() => expect(screen.getByText('Add a milestone')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Add milestone' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Please fill in title and cadence type.')
  })

  it('does not offer to add a milestone once the goal is active, and says they are locked', async () => {
    stubFetch(activeGoal)
    renderDetail('goal-1')

    await waitFor(() => expect(screen.getByText(/Log a check in for "Run 5k"/)).toBeInTheDocument())
    expect(screen.queryByText('Add a milestone')).not.toBeInTheDocument()
    expect(screen.getByText('Milestones are locked now that this goal is active.')).toBeInTheDocument()
  })

  it('completes the active milestone via retro, advancing to the next milestone', async () => {
    const afterComplete = {
      ...activeGoal,
      milestones: [
        { ...activeGoal.milestones[0], status: 'archived' },
        { ...activeGoal.milestones[1], status: 'active', started_at: '2026-02-01T00:00:00Z' },
      ],
    }
    let completed = false
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/milestones/m1/archive')) {
        completed = true
        return Promise.resolve({ ok: true, json: async () => ({ ...afterComplete.milestones[0] }) })
      }
      if (url.includes('/check-ins')) return Promise.resolve({ ok: true, json: async () => [] })
      return Promise.resolve({ ok: true, json: async () => (completed ? afterComplete : activeGoal) })
    })
    vi.stubGlobal('fetch', fetchMock)
    renderDetail('goal-1')

    await waitFor(() => expect(screen.getByText('Complete "Run 5k"')).toBeInTheDocument())
    // Both the milestone and goal completion forms show retro fields; the
    // milestone one renders first.
    fireEvent.change(screen.getAllByPlaceholderText('What worked')[0], { target: { value: 'Consistency' } })
    fireEvent.change(screen.getAllByPlaceholderText("What didn't")[0], { target: { value: 'Mornings' } })
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Milestone decision' })).getByRole('radio', { name: 'Continue' }))
    fireEvent.click(screen.getByRole('button', { name: 'Complete milestone' }))

    await waitFor(() => expect(screen.getByText('Complete "Run 10k"')).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/milestones/m1/archive'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ what_worked: 'Consistency', what_didnt: 'Mornings', decision: 'continue' }),
      }),
    )
  })

  it('blocks completing a milestone via retro when a field is missing', async () => {
    stubFetch(activeGoal)
    renderDetail('goal-1')

    await waitFor(() => expect(screen.getByText('Complete "Run 5k"')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Complete milestone' }))

    expect(screen.getByRole('alert')).toHaveTextContent("Please fill in what worked, what didn't, and the decision.")
  })

  it('abandons the active milestone early with a reason', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('/milestones/m1/archive')) {
        expect(JSON.parse(init!.body as string)).toEqual({ abandon_reason: 'Lost interest' })
        return Promise.resolve({ ok: true, json: async () => ({ ...activeGoal.milestones[0], status: 'archived' }) })
      }
      if (url.includes('/check-ins')) return Promise.resolve({ ok: true, json: async () => [] })
      return Promise.resolve({ ok: true, json: async () => activeGoal })
    })
    vi.stubGlobal('fetch', fetchMock)
    renderDetail('goal-1')

    await waitFor(() => expect(screen.getByText('Complete "Run 5k"')).toBeInTheDocument())
    // Both the milestone and goal completion forms offer this toggle; the
    // milestone one renders first.
    fireEvent.click(screen.getAllByRole('button', { name: 'Switch to abandon early' })[0])
    fireEvent.change(screen.getByPlaceholderText('Abandon reason'), { target: { value: 'Lost interest' } })
    fireEvent.click(screen.getByRole('button', { name: 'Complete milestone' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/milestones/m1/archive'), expect.anything()),
    )
  })

  it('offers to complete the goal itself while active, via retro', async () => {
    const archivedGoal = { ...activeGoal, status: 'archived', ended_early: false }
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/goals/goal-1/archive')) {
        return Promise.resolve({ ok: true, json: async () => archivedGoal })
      }
      if (url.includes('/check-ins')) return Promise.resolve({ ok: true, json: async () => [] })
      return Promise.resolve({ ok: true, json: async () => activeGoal })
    })
    vi.stubGlobal('fetch', fetchMock)
    renderDetail('goal-1')

    await waitFor(() => expect(screen.getByText('Complete this goal')).toBeInTheDocument())

    // Disambiguate the goal-level retro inputs from the milestone-level ones.
    const whatWorkedInputs = screen.getAllByPlaceholderText('What worked')
    const whatDidntInputs = screen.getAllByPlaceholderText("What didn't")
    fireEvent.change(whatWorkedInputs[whatWorkedInputs.length - 1], { target: { value: 'Good habit' } })
    fireEvent.change(whatDidntInputs[whatDidntInputs.length - 1], { target: { value: 'Slow start' } })
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Goal decision' })).getByRole('radio', { name: 'Iterate' }))
    fireEvent.click(screen.getByRole('button', { name: 'Archive goal' }))

    await waitFor(() => expect(screen.getByText('Goal, archived')).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/goals/goal-1/archive'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ what_worked: 'Good habit', what_didnt: 'Slow start', decision: 'iterate' }),
      }),
    )
  })

  it('does not offer to complete the goal while it is still in backlog', async () => {
    stubFetch(backlogGoal)
    renderDetail('goal-1')

    await waitFor(() => expect(screen.getByText('Run a 10k')).toBeInTheDocument())
    expect(screen.queryByText('Complete this goal')).not.toBeInTheDocument()
  })

  it('shows the backend error text when the goal fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({ detail: 'Goal not found.' }) }),
    )
    renderDetail('missing')

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Goal not found.'))
  })
})
