import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Dashboard from './Dashboard'

describe('Dashboard', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    cleanup()
  })

  it('fetches and renders multiple experiments', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { id: '1', title: 'Cold showers', cadence_type: 'daily', status: 'active' },
          { id: '2', title: 'No sugar', cadence_type: 'weekly', status: 'reflect' },
        ],
      }),
    )

    render(<Dashboard />, { wrapper: MemoryRouter })

    await waitFor(() => expect(screen.getByText('Cold showers')).toBeInTheDocument())
    expect(screen.getByText('daily')).toBeInTheDocument()
    expect(screen.getByText('active')).toBeInTheDocument()
    expect(screen.getByText('No sugar')).toBeInTheDocument()
    expect(screen.getByText('weekly')).toBeInTheDocument()
    expect(screen.getByText('reflect')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/experiments'),
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('renders an empty state when there are no experiments', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      }),
    )

    render(<Dashboard />, { wrapper: MemoryRouter })

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

    render(<Dashboard />, { wrapper: MemoryRouter })

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Not authenticated'))
  })
})
