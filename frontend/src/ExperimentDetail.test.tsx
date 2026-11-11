import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ExperimentDetail from './ExperimentDetail'
import { AuthProvider } from './AuthContext'
import { playTone } from './sound'

vi.mock('./sound', () => ({ playTone: vi.fn() }))

function renderDetailWithAuth(id: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[`/experiments/${id}`]}>
        <Routes>
          <Route path="/experiments/:id" element={<ExperimentDetail />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

function renderDetail(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/experiments/${id}`]}>
      <Routes>
        <Route path="/experiments/:id" element={<ExperimentDetail />} />
      </Routes>
    </MemoryRouter>,
  )
}

const experiment = {
  id: 'exp-1',
  user_id: 'user-1',
  title: 'Drink more water',
  hypothesis: 'I will feel better',
  cadence_type: 'daily',
  cadence_days: null,
  check_in_kind: 'boolean',
  start_date: '2026-01-01',
  target_days: 30,
  status: 'active',
  ended_early: false,
  abandon_reason: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  archived_at: null,
}

type Resp = { ok: boolean; status?: number; json: () => Promise<unknown> }

// A URL-aware fetch mock: GET .../check-ins always resolves to an empty
// history unless a test overrides it, so every test doesn't have to care
// about the history fetch fired alongside the main GET on mount. `routes`
// maps a URL substring to either a fixed response or a one-shot queue of
// responses (consumed in order, last entry sticks).
function mockFetch(routes: Record<string, Resp | Resp[]>) {
  const queues = new Map(
    Object.entries(routes).map(([key, value]) => [key, Array.isArray(value) ? [...value] : value]),
  )
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const fn = vi.fn((url: string, init?: RequestInit) => {
    calls.push({ url, init })
    for (const [key, value] of queues) {
      if (!url.includes(key)) continue
      if (Array.isArray(value)) {
        const next = value.length > 1 ? value.shift()! : value[0]
        return Promise.resolve(next)
      }
      return Promise.resolve(value)
    }
    if (url.includes('/check-ins') && (!init || init.method === undefined)) {
      return Promise.resolve({ ok: true, json: async () => [] })
    }
    throw new Error(`mockFetch: no route configured for ${url}`)
  })
  return { fn, calls }
}

describe('ExperimentDetail', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    cleanup()
  })

  it('fetches and renders the experiment on mount', async () => {
    const { fn } = mockFetch({
      '/experiments/exp-1': { ok: true, json: async () => experiment },
    })
    vi.stubGlobal('fetch', fn)

    renderDetail('exp-1')

    await waitFor(() => expect(screen.getByText('Drink more water')).toBeInTheDocument())
    expect(screen.getByText('I will feel better')).toBeInTheDocument()
    expect(screen.getByText('Experiment, active')).toBeInTheDocument()
    expect(fn).toHaveBeenCalledWith(
      expect.stringContaining('/experiments/exp-1'),
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('shows the backend error text when the fetch on mount fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ detail: 'Experiment not found' }),
      }),
    )

    renderDetail('missing')

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Experiment not found'),
    )
  })

  it('shows the real check-in history fetched from the backend, newest first', async () => {
    const history = [
      {
        id: 'ci-2',
        experiment_id: 'exp-1',
        value_bool: false,
        value_rating: null,
        note: 'skipped',
        checked_in_at: '2026-01-02T09:00:00Z',
      },
      {
        id: 'ci-1',
        experiment_id: 'exp-1',
        value_bool: true,
        value_rating: null,
        note: 'felt good',
        checked_in_at: '2026-01-01T09:00:00Z',
      },
    ]
    const { fn } = mockFetch({
      '/experiments/exp-1/check-ins': { ok: true, json: async () => history },
      '/experiments/exp-1': { ok: true, json: async () => experiment },
    })
    vi.stubGlobal('fetch', fn)

    renderDetail('exp-1')

    await waitFor(() => expect(screen.getByText('skipped')).toBeInTheDocument())
    expect(screen.getByText('felt good')).toBeInTheDocument()
  })

  it('logs a check-in and refetches history to show it (not just the POST response)', async () => {
    const checkIn = {
      id: 'ci-1',
      experiment_id: 'exp-1',
      value_bool: true,
      value_rating: null,
      note: 'felt good',
      checked_in_at: '2026-01-02T09:00:00Z',
    }
    const { fn, calls } = mockFetch({
      '/experiments/exp-1/check-ins': [
        { ok: true, json: async () => [] },
        { ok: true, status: 201, json: async () => checkIn },
        { ok: true, json: async () => [checkIn] },
      ],
      '/experiments/exp-1': { ok: true, json: async () => experiment },
    })
    vi.stubGlobal('fetch', fn)

    renderDetail('exp-1')
    await waitFor(() => expect(screen.getByText('Drink more water')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('checkbox', { name: 'Done today' }))
    fireEvent.change(screen.getByLabelText(/Note/), { target: { value: 'felt good' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save check in' }))

    await waitFor(() => expect(screen.getByText('felt good')).toBeInTheDocument())
    expect(playTone).toHaveBeenCalledWith('check-in-log')
    const postCall = calls.find((c) => c.init?.method === 'POST')
    expect(postCall?.init?.body).toBe(JSON.stringify({ value_bool: true, note: 'felt good' }))
  })

  it('sends value_bool: false (not omitted) when logging an unchecked boolean day', async () => {
    const checkIn = {
      id: 'ci-2',
      experiment_id: 'exp-1',
      value_bool: false,
      value_rating: null,
      note: null,
      checked_in_at: '2026-01-02T09:00:00Z',
    }
    const { fn, calls } = mockFetch({
      '/experiments/exp-1/check-ins': [
        { ok: true, json: async () => [] },
        { ok: true, status: 201, json: async () => checkIn },
      ],
      '/experiments/exp-1': { ok: true, json: async () => experiment },
    })
    vi.stubGlobal('fetch', fn)

    renderDetail('exp-1')
    await waitFor(() => expect(screen.getByText('Drink more water')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Save check in' }))

    await waitFor(() => expect(calls.some((c) => c.init?.method === 'POST')).toBe(true))
    const postCall = calls.find((c) => c.init?.method === 'POST')
    expect(postCall?.init?.body).toBe(JSON.stringify({ value_bool: false }))
  })

  it('sends value_rating instead of value_bool for a rating-kind experiment', async () => {
    const ratingExperiment = { ...experiment, check_in_kind: 'rating' }
    const checkIn = {
      id: 'ci-3',
      experiment_id: 'exp-1',
      value_bool: null,
      value_rating: 4,
      note: null,
      checked_in_at: '2026-01-02T09:00:00Z',
    }
    const { fn, calls } = mockFetch({
      '/experiments/exp-1/check-ins': [
        { ok: true, json: async () => [] },
        { ok: true, status: 201, json: async () => checkIn },
      ],
      '/experiments/exp-1': { ok: true, json: async () => ratingExperiment },
    })
    vi.stubGlobal('fetch', fn)

    renderDetail('exp-1')
    await waitFor(() => expect(screen.getByText('Drink more water')).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText(/Rating/), { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save check in' }))

    await waitFor(() => expect(calls.some((c) => c.init?.method === 'POST')).toBe(true))
    const postCall = calls.find((c) => c.init?.method === 'POST')
    expect(postCall?.init?.body).toBe(JSON.stringify({ value_rating: 4 }))
  })

  it('does not show the check-in form and shows the status when not active', async () => {
    const { fn } = mockFetch({
      '/experiments/exp-1': { ok: true, json: async () => ({ ...experiment, status: 'backlog' }) },
    })
    vi.stubGlobal('fetch', fn)

    renderDetail('exp-1')

    await waitFor(() => expect(screen.getByText('Drink more water')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Save check in' })).not.toBeInTheDocument()
    expect(
      screen.getByText(/Check ins can only be logged while this experiment is active/),
    ).toBeInTheDocument()
  })

  it('shows the backend error text on a rejected check-in', async () => {
    const { fn } = mockFetch({
      '/experiments/exp-1/check-ins': [
        { ok: true, json: async () => [] },
        { ok: false, status: 400, json: async () => ({ detail: 'Experiment is not active' }) },
      ],
      '/experiments/exp-1': { ok: true, json: async () => experiment },
    })
    vi.stubGlobal('fetch', fn)

    renderDetail('exp-1')
    await waitFor(() => expect(screen.getByText('Drink more water')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Save check in' }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Experiment is not active'),
    )
    expect(playTone).not.toHaveBeenCalled()
  })

  it('archives via the retro path and hides both forms on success', async () => {
    const archived = { ...experiment, status: 'archived' }
    const { fn, calls } = mockFetch({
      '/experiments/exp-1/archive': { ok: true, status: 200, json: async () => archived },
      '/experiments/exp-1': { ok: true, json: async () => experiment },
    })
    vi.stubGlobal('fetch', fn)

    renderDetail('exp-1')
    await waitFor(() => expect(screen.getByText('Drink more water')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('What worked'), { target: { value: 'consistency' } })
    fireEvent.change(screen.getByPlaceholderText("What didn't"), { target: { value: 'mornings' } })
    fireEvent.change(screen.getByPlaceholderText('Decision'), { target: { value: 'continue' } })
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))

    await waitFor(() => expect(screen.getByText('Experiment, archived')).toBeInTheDocument())
    const archiveCall = calls.find((c) => c.url.includes('/archive'))
    expect(archiveCall?.init).toEqual(
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ what_worked: 'consistency', what_didnt: 'mornings', decision: 'continue' }),
      }),
    )
    expect(screen.queryByRole('button', { name: 'Save check in' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument()
  })

  it('archives via the abandon-early path and hides both forms on success', async () => {
    const archived = { ...experiment, status: 'archived', abandon_reason: 'lost interest' }
    const { fn, calls } = mockFetch({
      '/experiments/exp-1/archive': { ok: true, status: 200, json: async () => archived },
      '/experiments/exp-1': { ok: true, json: async () => experiment },
    })
    vi.stubGlobal('fetch', fn)

    renderDetail('exp-1')
    await waitFor(() => expect(screen.getByText('Drink more water')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Switch to abandon early' }))
    fireEvent.change(screen.getByPlaceholderText('Abandon reason'), { target: { value: 'lost interest' } })
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))

    await waitFor(() => expect(screen.getByText('Experiment, archived')).toBeInTheDocument())
    const archiveCall = calls.find((c) => c.url.includes('/archive'))
    expect(archiveCall?.init).toEqual(
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ abandon_reason: 'lost interest' }),
      }),
    )
  })

  it('blocks an incomplete archive submission client-side with no fetch call', async () => {
    const { fn } = mockFetch({
      '/experiments/exp-1': { ok: true, json: async () => experiment },
    })
    vi.stubGlobal('fetch', fn)

    renderDetail('exp-1')
    await waitFor(() => expect(screen.getByText('Drink more water')).toBeInTheDocument())
    const callsBefore = fn.mock.calls.length

    fireEvent.change(screen.getByPlaceholderText('What worked'), { target: { value: 'consistency' } })
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))

    expect(fn.mock.calls.length).toBe(callsBefore)
    expect(screen.getByRole('alert')).toHaveTextContent(/fill in what worked/i)
  })

  it('activates a backlog experiment and shows the result status', async () => {
    const backlogExperiment = { ...experiment, status: 'backlog' }
    const activated = { ...experiment, status: 'active' }
    const { fn, calls } = mockFetch({
      '/experiments/exp-1/activate': { ok: true, json: async () => activated },
      '/experiments/exp-1': { ok: true, json: async () => backlogExperiment },
    })
    vi.stubGlobal('fetch', fn)

    renderDetail('exp-1')
    await waitFor(() => expect(screen.getByText('Drink more water')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Activate' }))

    await waitFor(() => expect(screen.getByText('Experiment, active')).toBeInTheDocument())
    const activateCall = calls.find((c) => c.url.includes('/activate'))
    expect(activateCall?.init).toEqual(expect.objectContaining({ method: 'POST', credentials: 'include' }))
  })

  it('refetches the shared experiments list after activating, so the Dashboard is not stale', async () => {
    const backlogExperiment = { ...experiment, status: 'backlog' }
    const activated = { ...experiment, status: 'active' }
    const listCalls: string[] = []
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/activate')) {
        return Promise.resolve({ ok: true, json: async () => activated })
      }
      if (url.endsWith('/experiments/exp-1')) {
        return Promise.resolve({ ok: true, json: async () => backlogExperiment })
      }
      if (url.includes('/check-ins')) {
        return Promise.resolve({ ok: true, json: async () => [] })
      }
      // AuthProvider's own GET /experiments (the list Dashboard reads).
      listCalls.push(url)
      return Promise.resolve({ ok: true, json: async () => [] })
    })
    vi.stubGlobal('fetch', fetchMock)

    renderDetailWithAuth('exp-1')
    await waitFor(() => expect(screen.getByText('Drink more water')).toBeInTheDocument())
    const listCallsBeforeActivate = listCalls.length

    fireEvent.click(screen.getByRole('button', { name: 'Activate' }))

    await waitFor(() => expect(screen.getByText('Experiment, active')).toBeInTheDocument())
    await waitFor(() => expect(listCalls.length).toBeGreaterThan(listCallsBeforeActivate))
  })

  it('shows the backend error when activating fails (e.g. WIP cap already reached)', async () => {
    const backlogExperiment = { ...experiment, status: 'backlog' }
    const { fn } = mockFetch({
      '/experiments/exp-1/activate': {
        ok: false,
        status: 400,
        json: async () => ({ detail: 'You already have 2 active experiments.' }),
      },
      '/experiments/exp-1': { ok: true, json: async () => backlogExperiment },
    })
    vi.stubGlobal('fetch', fn)

    renderDetail('exp-1')
    await waitFor(() => expect(screen.getByText('Drink more water')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Activate' }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('You already have 2 active experiments.'),
    )
  })

  it('shows the backend error text on a rejected archive submission', async () => {
    const { fn } = mockFetch({
      '/experiments/exp-1/archive': {
        ok: false,
        status: 400,
        json: async () => ({ detail: 'Experiment is not active or reflect' }),
      },
      '/experiments/exp-1': { ok: true, json: async () => experiment },
    })
    vi.stubGlobal('fetch', fn)

    renderDetail('exp-1')
    await waitFor(() => expect(screen.getByText('Drink more water')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('What worked'), { target: { value: 'consistency' } })
    fireEvent.change(screen.getByPlaceholderText("What didn't"), { target: { value: 'mornings' } })
    fireEvent.change(screen.getByPlaceholderText('Decision'), { target: { value: 'continue' } })
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Experiment is not active or reflect'),
    )
  })
})
