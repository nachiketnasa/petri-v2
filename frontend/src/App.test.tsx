import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const user = {
  id: 'user-1',
  email: 'new@x.com',
  display_name: 'New',
  timezone: 'UTC',
  created_at: '2026-01-01T00:00:00Z',
}

const experiment = {
  id: 'exp-1',
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

describe('App', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    cleanup()
  })

  it('signs up and lands on the dashboard', async () => {
    let signedUp = false
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/auth/signup')) {
        signedUp = true
        return Promise.resolve({ ok: true, json: async () => user })
      }
      if (url.includes('/experiments')) {
        if (!signedUp) {
          return Promise.resolve({ ok: false, status: 401, json: async () => ({ detail: 'Not authenticated' }) })
        }
        return Promise.resolve({ ok: true, json: async () => [] })
      }
      return Promise.resolve({ ok: false, status: 401, json: async () => ({ detail: 'nope' }) })
    })
    vi.stubGlobal('fetch', fetchMock)
    window.history.pushState({}, '', '/')

    render(<App />)

    // Initial /experiments check fails (not signed in yet) -> shows AuthForm
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Sign up' })).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'new@x.com' } })
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'secret123' } })
    fireEvent.change(screen.getByPlaceholderText('Display name'), { target: { value: 'New' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))

    await waitFor(() => expect(screen.getByText('No experiments yet.')).toBeInTheDocument())
  })

  it('creates an experiment and sees it on the dashboard without a reload, then opens its detail page', async () => {
    let experiments = [] as Array<typeof experiment>
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('/experiments/exp-1')) {
        return Promise.resolve({ ok: true, json: async () => experiment })
      }
      if (url.endsWith('/experiments') && init?.method === 'POST') {
        experiments = [experiment]
        return Promise.resolve({ ok: true, status: 201, json: async () => experiment })
      }
      if (url.endsWith('/experiments')) {
        return Promise.resolve({ ok: true, json: async () => experiments })
      }
      return Promise.resolve({ ok: false, status: 401, json: async () => ({ detail: 'nope' }) })
    })
    vi.stubGlobal('fetch', fetchMock)

    // Start already "signed in" by pre-seeding experiments so the initial check succeeds.
    experiments = []
    window.history.pushState({}, '', '/dashboard')

    render(<App />)

    await waitFor(() => expect(screen.getByText('No experiments yet.')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('link', { name: 'New experiment' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'New experiment' })).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('Title'), { target: { value: 'Drink more water' } })
    fireEvent.change(screen.getByPlaceholderText('Hypothesis'), { target: { value: 'I will feel better' } })
    fireEvent.change(screen.getByPlaceholderText('Cadence type'), { target: { value: 'daily' } })
    fireEvent.change(screen.getByPlaceholderText('Target days'), { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create experiment' }))

    await waitFor(() => expect(screen.getByText('Drink more water')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('link', { name: 'Drink more water' }))

    await waitFor(() => expect(screen.getByText('I will feel better')).toBeInTheDocument())
    expect(screen.getByText('Status: active')).toBeInTheDocument()
  })

  it('makes exactly one GET /experiments call on a signed-in dashboard visit', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [experiment] })
    vi.stubGlobal('fetch', fetchMock)
    window.history.pushState({}, '', '/dashboard')

    render(<App />)

    await waitFor(() => expect(screen.getByText('Drink more water')).toBeInTheDocument())

    const experimentsCalls = fetchMock.mock.calls.filter((call) => (call[0] as string).endsWith('/experiments'))
    expect(experimentsCalls).toHaveLength(1)
  })
})
