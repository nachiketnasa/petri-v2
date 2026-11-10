import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import HealthStatus from './HealthStatus'

describe('HealthStatus', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows success state when the backend responds ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'ok' }),
      }),
    )

    render(<HealthStatus />)

    await waitFor(() => expect(screen.getByText('Backend: ok')).toBeInTheDocument())
  })

  it('shows failure state when the backend call errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))

    render(<HealthStatus />)

    await waitFor(() =>
      expect(screen.getByText('Backend: unreachable')).toBeInTheDocument(),
    )
  })
})
