import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Dashboard from './Dashboard'
import { AuthProvider } from './AuthContext'

// Dashboard reads its data from AuthContext (populated by AuthProvider's
// mount-time GET /experiments), so rendering it here also drives that
// provider's fetch rather than one of Dashboard's own.
function renderDashboard() {
  return render(
    <AuthProvider>
      <Dashboard />
    </AuthProvider>,
    { wrapper: MemoryRouter },
  )
}

function stubExperiments(experiments: unknown[]) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => experiments })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('Dashboard', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    cleanup()
  })

  it('fetches and renders multiple experiments as cards, defaulting the filter to Both', async () => {
    const fetchMock = stubExperiments([
      { id: '1', title: 'Cold showers', cadence_type: 'daily', status: 'Active', ended_early: false },
      { id: '2', title: 'No sugar', cadence_type: 'weekly', status: 'Archived', ended_early: false },
    ])

    renderDashboard()

    await waitFor(() => expect(screen.getByText('Cold showers')).toBeInTheDocument())
    expect(screen.getByText('daily')).toBeInTheDocument()
    expect(screen.getByText('No sugar')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Both' })).toBeChecked()
    // Goals empty state shows alongside experiment cards when the filter is Both.
    expect(screen.getByText('No goals yet.')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/experiments'),
      expect.objectContaining({ credentials: 'include' }),
    )
    // Exactly one GET /experiments call backs both the auth check and
    // Dashboard's data -- this is the double-fetch QA flagged.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('renders an empty state when there are no experiments, with no section headers', async () => {
    stubExperiments([])

    renderDashboard()

    await waitFor(() => expect(screen.getByText('No experiments yet.')).toBeInTheDocument())
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
    expect(screen.queryByText('Backlog')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'New experiment' })).toBeInTheDocument()
  })

  it('shows the backend error text alone on a failed fetch, with no grid or tiles', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Not authenticated' }),
      }),
    )

    renderDashboard()

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Not authenticated'))
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
    expect(screen.queryByText('Streak')).not.toBeInTheDocument()
  })

  it('shows a single loading indicator while the fetch is in flight, with no partial grid', async () => {
    let resolveFetch: (value: unknown) => void = () => {}
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve
        }),
      ),
    )

    renderDashboard()

    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()

    resolveFetch({ ok: true, json: async () => [] })
    await waitFor(() => expect(screen.getByText('No experiments yet.')).toBeInTheDocument())
  })

  it('computes the WIP tile from Active experiments and the static Goals placeholder', async () => {
    stubExperiments([
      { id: '1', title: 'A', cadence_type: 'daily', status: 'Active', ended_early: false },
      { id: '2', title: 'B', cadence_type: 'daily', status: 'Backlog', ended_early: false },
    ])

    renderDashboard()

    await waitFor(() => expect(screen.getByText('Experiments 1/2')).toBeInTheDocument())
    expect(screen.getByText('Goals 0/1')).toBeInTheDocument()
  })

  it('computes the completed vs abandoned ratio tile and a muted streak placeholder', async () => {
    stubExperiments([
      { id: '1', title: 'A', cadence_type: 'daily', status: 'Archived', ended_early: false },
      { id: '2', title: 'B', cadence_type: 'daily', status: 'Archived', ended_early: false },
      { id: '3', title: 'C', cadence_type: 'daily', status: 'Archived', ended_early: true },
    ])

    renderDashboard()

    await waitFor(() => expect(screen.getByText('2 completed · 1 abandoned')).toBeInTheDocument())
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('lists Backlog experiments separately from the active grid', async () => {
    stubExperiments([
      { id: '1', title: 'Active one', cadence_type: 'daily', status: 'Active', ended_early: false },
      { id: '2', title: 'Shelved idea', cadence_type: 'weekly', status: 'Backlog', ended_early: false },
    ])

    renderDashboard()

    await waitFor(() => expect(screen.getByText('Active one')).toBeInTheDocument())
    const backlogHeading = screen.getByRole('heading', { name: 'Backlog' })
    expect(backlogHeading).toBeInTheDocument()
    expect(screen.getByText('Shelved idea')).toBeInTheDocument()
  })

  it('filters to Experiments only, hiding the Goals empty state', async () => {
    stubExperiments([
      { id: '1', title: 'A', cadence_type: 'daily', status: 'Active', ended_early: false },
    ])

    renderDashboard()
    await waitFor(() => expect(screen.getByText('A')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('radio', { name: 'Experiments' }))

    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.queryByText('No goals yet.')).not.toBeInTheDocument()
  })

  it('filters to Goals only, hiding the experiment grid and showing the zero state', async () => {
    stubExperiments([
      { id: '1', title: 'A', cadence_type: 'daily', status: 'Active', ended_early: false },
    ])

    renderDashboard()
    await waitFor(() => expect(screen.getByText('A')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('radio', { name: 'Goals' }))

    expect(screen.queryByText('A')).not.toBeInTheDocument()
    expect(screen.getByText('No goals yet.')).toBeInTheDocument()
  })

  it('wraps 10+ experiments in the grid with no fixed per-row count', async () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      id: String(i),
      title: `Experiment ${i}`,
      cadence_type: 'daily',
      status: 'Active',
      ended_early: false,
    }))
    stubExperiments(many)

    renderDashboard()

    await waitFor(() => expect(screen.getByText('Experiment 0')).toBeInTheDocument())
    expect(screen.getByText('Experiment 11')).toBeInTheDocument()
  })

  it('truncates a long title with an ellipsis while keeping the full text available via title', async () => {
    const longTitle =
      'A very long experiment title that should truncate instead of breaking the card layout or pushing the tiles out of place'
    stubExperiments([
      { id: '1', title: longTitle, cadence_type: 'daily', status: 'Active', ended_early: false },
    ])

    renderDashboard()

    await waitFor(() => expect(screen.getByTitle(longTitle)).toBeInTheDocument())
    expect(screen.getByTitle(longTitle)).toHaveClass('card-title')
  })
})
