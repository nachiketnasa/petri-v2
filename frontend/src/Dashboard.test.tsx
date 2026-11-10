import { cleanup, render, screen, waitFor } from '@testing-library/react'
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

describe('Dashboard', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    cleanup()
  })

  it('fetches and renders multiple experiments', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { id: '1', title: 'Cold showers', cadence_type: 'daily', status: 'active' },
        { id: '2', title: 'No sugar', cadence_type: 'weekly', status: 'reflect' },
      ],
    })
    vi.stubGlobal('fetch', fetchMock)

    renderDashboard()

    await waitFor(() => expect(screen.getByText('Cold showers')).toBeInTheDocument())
    expect(screen.getByText('daily')).toBeInTheDocument()
    expect(screen.getByText('active')).toBeInTheDocument()
    expect(screen.getByText('No sugar')).toBeInTheDocument()
    expect(screen.getByText('weekly')).toBeInTheDocument()
    expect(screen.getByText('reflect')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/experiments'),
      expect.objectContaining({ credentials: 'include' }),
    )
    // Exactly one GET /experiments call backs both the auth check and
    // Dashboard's data -- this is the double-fetch QA flagged.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('renders an empty state when there are no experiments', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      }),
    )

    renderDashboard()

    await waitFor(() =>
      expect(screen.getByText('No experiments yet.')).toBeInTheDocument(),
    )
  })

  it('shows the backend error text on a failed fetch', async () => {
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
  })
})
