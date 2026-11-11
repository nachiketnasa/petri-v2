import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ResetPassword from './ResetPassword'

function renderResetPassword(path = '/reset-password') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/sign-in" element={<p>Sign-in page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ResetPassword', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    cleanup()
  })

  it('pre-fills the token from a ?token= query param', () => {
    renderResetPassword('/reset-password?token=abc123')
    expect(screen.getByLabelText('Reset token')).toHaveValue('abc123')
  })

  it('submits token + new password and shows a success message, without signing in', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ok' }) })
    vi.stubGlobal('fetch', fetchMock)

    renderResetPassword('/reset-password?token=abc123')
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpass123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Set new password' }))

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/password has been changed/i),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/reset-password'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ token: 'abc123', password: 'newpass123' }),
      }),
    )
    // Confirms success and offers to go sign in -- it does not land on a
    // protected page or claim the user is now signed in.
    expect(screen.queryByText('Sign-in page')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Go to sign in' })).toBeInTheDocument()
  })

  it('shows the backend error text on an invalid or expired token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ detail: 'Invalid or expired token.' }),
      }),
    )

    renderResetPassword('/reset-password?token=stale')
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpass123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Set new password' }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid or expired token.'),
    )
  })

  it('links back to sign in', () => {
    renderResetPassword()
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/sign-in')
  })
})
