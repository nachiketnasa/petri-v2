import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AuthForm from './AuthForm'

describe('AuthForm', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    cleanup()
  })

  it('signs up successfully and shows confirmation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: '1',
          email: 'new@x.com',
          display_name: 'New',
          timezone: 'UTC',
          created_at: '2026-01-01T00:00:00Z',
        }),
      }),
    )

    render(<AuthForm />)
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'new@x.com' } })
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'secret123' } })
    fireEvent.change(screen.getByPlaceholderText('Display name'), { target: { value: 'New' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))

    await waitFor(() =>
      expect(screen.getByText('Signed in as new@x.com')).toBeInTheDocument(),
    )
    expect(fetch).toHaveBeenCalledWith(
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

    render(<AuthForm />)
    fireEvent.click(screen.getByRole('button', { name: 'Switch to sign in' }))
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'foo@x.com' } })
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() =>
      expect(screen.getByText('Signed in as foo@x.com')).toBeInTheDocument(),
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

    render(<AuthForm />)
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'new@x.com' } })
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'secret123' } })
    fireEvent.change(screen.getByPlaceholderText('Display name'), { target: { value: 'New' } })
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

    render(<AuthForm />)
    fireEvent.click(screen.getByRole('button', { name: 'Switch to sign in' }))
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'foo@x.com' } })
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() =>
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument(),
    )
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

    render(<AuthForm />)
    fireEvent.click(screen.getByRole('button', { name: 'Switch to sign in' }))
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'foo@x.com' } })
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() =>
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument(),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Switch to sign up' }))

    expect(screen.queryByText('Invalid email or password')).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('Email')).toHaveValue('')
    expect(screen.getByPlaceholderText('Password')).toHaveValue('')
  })
})
