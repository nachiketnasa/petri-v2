import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import NewExperimentForm from './NewExperimentForm'
import { AuthProvider } from './AuthContext'

const created = {
  id: 'exp-1',
  title: 'Drink more water',
  cadence_type: 'daily',
  cadence_days: null,
  status: 'active',
  target_days: 30,
}

function fillRequiredFields() {
  fireEvent.change(screen.getByPlaceholderText('Title'), { target: { value: 'Drink more water' } })
  fireEvent.change(screen.getByPlaceholderText('Hypothesis'), { target: { value: 'I will feel better' } })
  fireEvent.change(screen.getByPlaceholderText('Cadence type'), { target: { value: 'daily' } })
  fireEvent.change(screen.getByPlaceholderText('Target days'), { target: { value: '30' } })
}

function renderForm() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/experiments/new']}>
        <Routes>
          <Route path="/experiments/new" element={<NewExperimentForm />} />
          <Route path="/dashboard" element={<p>Dashboard view</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('NewExperimentForm', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    cleanup()
  })

  it('submits the required fields and navigates to the dashboard on success', async () => {
    // AuthProvider's own mount-time GET /experiments shares the mock with
    // the form's POST and the post-create refetch.
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Promise.resolve({ ok: true, status: 201, json: async () => created })
      }
      return Promise.resolve({ ok: true, json: async () => [created] })
    })
    vi.stubGlobal('fetch', fetchMock)

    renderForm()
    fillRequiredFields()
    fireEvent.click(screen.getByRole('button', { name: 'Create experiment' }))

    await waitFor(() => expect(screen.getByText('Dashboard view')).toBeInTheDocument())

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/experiments'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          title: 'Drink more water',
          hypothesis: 'I will feel better',
          cadence_type: 'daily',
          target_days: 30,
        }),
      }),
    )
  })

  it('blocks a custom-cadence submission with blank cadence_days, with no POST call', () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
    vi.stubGlobal('fetch', fetchMock)

    renderForm()
    fillRequiredFields()
    fireEvent.change(screen.getByPlaceholderText('Cadence type'), { target: { value: 'custom' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create experiment' }))

    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: 'POST' }),
    )
    expect(screen.getByRole('alert')).toHaveTextContent(/cadence_days is required/i)
  })

  it('shows the backend error text on a rejected submission', async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Promise.resolve({ ok: false, status: 400, json: async () => ({ detail: 'cadence_type is required' }) })
      }
      return Promise.resolve({ ok: true, json: async () => [] })
    })
    vi.stubGlobal('fetch', fetchMock)

    renderForm()
    fillRequiredFields()
    fireEvent.click(screen.getByRole('button', { name: 'Create experiment' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('cadence_type is required'))
  })
})
