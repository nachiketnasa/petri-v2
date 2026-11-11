import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ForgotPassword from './ForgotPassword'

function renderForgotPassword() {
  return render(<ForgotPassword />, { wrapper: MemoryRouter })
}

describe('ForgotPassword', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    cleanup()
  })

  it('submits the email and shows the generic confirmation on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ok' }) })
    vi.stubGlobal('fetch', fetchMock)

    renderForgotPassword()
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'foo@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }))

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/password reset link is on its way/i),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/forgot-password'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ email: 'foo@example.com' }),
      }),
    )
  })

  it('shows the exact same confirmation even when the backend call fails (no email enumeration)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({ detail: 'nope' }) }),
    )

    renderForgotPassword()
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'unknown@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }))

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/password reset link is on its way/i),
    )
  })

  it('links back to sign in', async () => {
    renderForgotPassword()
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/sign-in')
  })
})
