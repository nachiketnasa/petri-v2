import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ExperimentDetail from './ExperimentDetail'

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

describe('ExperimentDetail', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    cleanup()
  })

  it('fetches and renders the experiment on mount', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => experiment }),
    )

    render(<ExperimentDetail experimentId="exp-1" />)

    await waitFor(() => expect(screen.getByText('Drink more water')).toBeInTheDocument())
    expect(screen.getByText('I will feel better')).toBeInTheDocument()
    expect(screen.getByText('Status: active')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(
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

    render(<ExperimentDetail experimentId="missing" />)

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Experiment not found'),
    )
  })

  it('logs a check-in and shows it from the response without refetching', async () => {
    const checkIn = {
      id: 'ci-1',
      experiment_id: 'exp-1',
      value_bool: true,
      value_rating: null,
      note: 'felt good',
      checked_in_at: '2026-01-02T09:00:00Z',
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => experiment })
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => checkIn })
    vi.stubGlobal('fetch', fetchMock)

    render(<ExperimentDetail experimentId="exp-1" />)
    await waitFor(() => expect(screen.getByText('Drink more water')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('Note'), { target: { value: 'felt good' } })
    fireEvent.click(screen.getByRole('button', { name: 'Log check-in' }))

    await waitFor(() =>
      expect(screen.getByText(/Last check-in logged: 2026-01-02T09:00:00Z/)).toBeInTheDocument(),
    )
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('/experiments/exp-1/check-ins'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ note: 'felt good' }),
      }),
    )
  })

  it('does not show the check-in form and shows the status when not active', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...experiment, status: 'backlog' }) }),
    )

    render(<ExperimentDetail experimentId="exp-1" />)

    await waitFor(() => expect(screen.getByText('Drink more water')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Log check-in' })).not.toBeInTheDocument()
    expect(
      screen.getByText(/Check-ins can only be logged while this experiment is Active/),
    ).toBeInTheDocument()
  })

  it('shows the backend error text on a rejected check-in', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => experiment })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ detail: 'Experiment is not active' }),
      })
    vi.stubGlobal('fetch', fetchMock)

    render(<ExperimentDetail experimentId="exp-1" />)
    await waitFor(() => expect(screen.getByText('Drink more water')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Log check-in' }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Experiment is not active'),
    )
  })

  it('archives via the retro path and hides both forms on success', async () => {
    const archived = { ...experiment, status: 'archived' }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => experiment })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => archived })
    vi.stubGlobal('fetch', fetchMock)

    render(<ExperimentDetail experimentId="exp-1" />)
    await waitFor(() => expect(screen.getByText('Drink more water')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('What worked'), { target: { value: 'consistency' } })
    fireEvent.change(screen.getByPlaceholderText("What didn't"), { target: { value: 'mornings' } })
    fireEvent.change(screen.getByPlaceholderText('Decision'), { target: { value: 'continue' } })
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))

    await waitFor(() => expect(screen.getByText('Status: archived')).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('/experiments/exp-1/archive'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ what_worked: 'consistency', what_didnt: 'mornings', decision: 'continue' }),
      }),
    )
    expect(screen.queryByRole('button', { name: 'Log check-in' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument()
  })

  it('archives via the abandon-early path and hides both forms on success', async () => {
    const archived = { ...experiment, status: 'archived', abandon_reason: 'lost interest' }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => experiment })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => archived })
    vi.stubGlobal('fetch', fetchMock)

    render(<ExperimentDetail experimentId="exp-1" />)
    await waitFor(() => expect(screen.getByText('Drink more water')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Switch to abandon early' }))
    fireEvent.change(screen.getByPlaceholderText('Abandon reason'), { target: { value: 'lost interest' } })
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))

    await waitFor(() => expect(screen.getByText('Status: archived')).toBeInTheDocument())
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('/experiments/exp-1/archive'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ abandon_reason: 'lost interest' }),
      }),
    )
  })

  it('blocks an incomplete archive submission client-side with no fetch call', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => experiment })
    vi.stubGlobal('fetch', fetchMock)

    render(<ExperimentDetail experimentId="exp-1" />)
    await waitFor(() => expect(screen.getByText('Drink more water')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('What worked'), { target: { value: 'consistency' } })
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('alert')).toHaveTextContent(/fill in what worked/i)
  })

  it('shows the backend error text on a rejected archive submission', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => experiment })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ detail: 'Experiment is not active or reflect' }),
      })
    vi.stubGlobal('fetch', fetchMock)

    render(<ExperimentDetail experimentId="exp-1" />)
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
