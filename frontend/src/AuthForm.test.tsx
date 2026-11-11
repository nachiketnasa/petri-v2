import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AuthForm from './AuthForm'

function renderAuthForm(onAuthenticated = vi.fn()) {
  return render(<AuthForm onAuthenticated={onAuthenticated} />, { wrapper: MemoryRouter })
}

describe('AuthForm', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    cleanup()
  })

  it('signs up successfully and goes straight to the verify-code step, not onAuthenticated', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: '1',
        email: 'new@x.com',
        display_name: 'New',
        timezone: 'UTC',
        created_at: '2026-01-01T00:00:00Z',
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const onAuthenticated = vi.fn()
    renderAuthForm(onAuthenticated)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@x.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } })
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'New' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Verify your email' })).toBeInTheDocument())
    expect(screen.getByText('new@x.com')).toBeInTheDocument()
    expect(onAuthenticated).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/signup'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          email: 'new@x.com',
          password: 'secret123',
          display_name: 'New',
        }),
      }),
    )
  })

  it('completes onAuthenticated with the signup user once the code is verified, with no extra login call', async () => {
    const signedUpUser = {
      id: '1',
      email: 'new@x.com',
      display_name: 'New',
      timezone: 'UTC',
      created_at: '2026-01-01T00:00:00Z',
    }
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/auth/signup')) return Promise.resolve({ ok: true, json: async () => signedUpUser })
      if (url.includes('/auth/verify-email')) return Promise.resolve({ ok: true, json: async () => ({ status: 'ok' }) })
      throw new Error(`unexpected fetch to ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const onAuthenticated = vi.fn()
    renderAuthForm(onAuthenticated)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@x.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } })
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'New' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Verify your email' })).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('Verification code'), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }))

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledWith(signedUpUser))
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/auth/login'), expect.anything())
  })

  it('signs in successfully and shows confirmation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: '1',
          email: 'foo@x.com',
          display_name: 'Foo',
          timezone: 'UTC',
          created_at: '2026-01-01T00:00:00Z',
        }),
      }),
    )

    const onAuthenticated = vi.fn()
    renderAuthForm(onAuthenticated)
    fireEvent.click(screen.getByRole('button', { name: 'Switch to sign in' }))
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'foo@x.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() =>
      expect(onAuthenticated).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'foo@x.com' }),
      ),
    )
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/login'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ email: 'foo@x.com', password: 'secret123' }),
      }),
    )
  })

  it('shows the backend error text on a failed sign up', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ detail: 'Email already registered' }),
      }),
    )

    renderAuthForm()
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@x.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } })
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'New' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))

    await waitFor(() =>
      expect(screen.getByText('Email already registered')).toBeInTheDocument(),
    )
  })

  it('shows the backend error text on a failed sign in', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Invalid email or password' }),
      }),
    )

    renderAuthForm()
    fireEvent.click(screen.getByRole('button', { name: 'Switch to sign in' }))
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'foo@x.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() =>
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument(),
    )
  })

  it('drops into a verify-code step on a 403 Email not verified sign in, then signs in after verifying', async () => {
    let verified = false
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('/auth/login')) {
        if (!verified) {
          return Promise.resolve({ ok: false, status: 403, json: async () => ({ detail: 'Email not verified.' }) })
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: '1',
            email: 'foo@x.com',
            display_name: 'Foo',
            timezone: 'UTC',
            created_at: '2026-01-01T00:00:00Z',
          }),
        })
      }
      if (url.includes('/auth/verify-email')) {
        const body = JSON.parse(init?.body as string)
        expect(body).toEqual({ code: '123456' })
        verified = true
        return Promise.resolve({ ok: true, json: async () => ({ status: 'ok' }) })
      }
      throw new Error(`unexpected fetch to ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const onAuthenticated = vi.fn()
    renderAuthForm(onAuthenticated)
    fireEvent.click(screen.getByRole('button', { name: 'Switch to sign in' }))
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'foo@x.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Verify your email' })).toBeInTheDocument())
    expect(screen.getByText('foo@x.com')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Verification code'), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }))

    await waitFor(() =>
      expect(onAuthenticated).toHaveBeenCalledWith(expect.objectContaining({ email: 'foo@x.com' })),
    )
  })

  it('resends a verification code from the verify step', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/auth/login')) {
        return Promise.resolve({ ok: false, status: 403, json: async () => ({ detail: 'Email not verified.' }) })
      }
      if (url.includes('/auth/resend-verification')) {
        return Promise.resolve({ ok: true, json: async () => ({ status: 'ok' }) })
      }
      throw new Error(`unexpected fetch to ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderAuthForm()
    fireEvent.click(screen.getByRole('button', { name: 'Switch to sign in' }))
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'foo@x.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Verify your email' })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Resend code' }))

    await waitFor(() => expect(screen.getByText(/new code has been sent/i)).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/resend-verification'),
      expect.objectContaining({ body: JSON.stringify({ email: 'foo@x.com' }) }),
    )
  })

  it('an invalid verification code shows an error and stays on the verify step', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/auth/login')) {
        return Promise.resolve({ ok: false, status: 403, json: async () => ({ detail: 'Email not verified.' }) })
      }
      if (url.includes('/auth/verify-email')) {
        return Promise.resolve({ ok: false, status: 400, json: async () => ({ detail: 'Invalid or expired code.' }) })
      }
      throw new Error(`unexpected fetch to ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderAuthForm()
    fireEvent.click(screen.getByRole('button', { name: 'Switch to sign in' }))
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'foo@x.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Verify your email' })).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('Verification code'), { target: { value: '000000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }))

    await waitFor(() => expect(screen.getByText('Invalid or expired code.')).toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Verify your email' })).toBeInTheDocument()
  })

  it('clears fields and error when toggling mode', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Invalid email or password' }),
      }),
    )

    renderAuthForm()
    fireEvent.click(screen.getByRole('button', { name: 'Switch to sign in' }))
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'foo@x.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() =>
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument(),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Switch to sign up' }))

    expect(screen.queryByText('Invalid email or password')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveValue('')
    expect(screen.getByLabelText('Password')).toHaveValue('')
  })
})
