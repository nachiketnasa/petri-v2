import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import NewExperimentForm from './NewExperimentForm'

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
    <MemoryRouter initialEntries={['/experiments/new']}>
      <Routes>
        <Route path="/experiments/new" element={<NewExperimentForm />} />
        <Route path="/dashboard" element={<p>Dashboard view</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('NewExperimentForm', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    cleanup()
  })

  it('submits the required fields and navigates to the dashboard on success', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => created,
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

  it('blocks a custom-cadence submission with blank cadence_days, with no fetch call', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    renderForm()
    fillRequiredFields()
    fireEvent.change(screen.getByPlaceholderText('Cadence type'), { target: { value: 'custom' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create experiment' }))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/cadence_days is required/i)
  })

  it('shows the backend error text on a rejected submission', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ detail: 'cadence_type is required' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    renderForm()
    fillRequiredFields()
    fireEvent.click(screen.getByRole('button', { name: 'Create experiment' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('cadence_type is required'))
  })
})
