import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import NewExperimentForm from './NewExperimentForm'
import { AuthProvider } from './AuthContext'
import { playTone } from './sound'

vi.mock('./sound', () => ({ playTone: vi.fn() }))

const created = {
  id: 'exp-1',
  title: 'Drink more water',
  cadence_type: 'daily',
  cadence_days: null,
  status: 'active',
  target_days: 30,
}

function renderWizard() {
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

function fillDetailsAndAdvance() {
  fireEvent.change(screen.getByPlaceholderText('Title'), { target: { value: 'Drink more water' } })
  fireEvent.change(screen.getByPlaceholderText('Hypothesis'), { target: { value: 'I will feel better' } })
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
}

function fillCadenceAndAdvance() {
  fireEvent.change(screen.getByLabelText('Cadence type'), { target: { value: 'daily' } })
  fireEvent.change(screen.getByPlaceholderText('Target days'), { target: { value: '30' } })
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
}

function stubFetch(postResponse: { ok: boolean; status: number; json: () => Promise<unknown> }) {
  const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
    if (init?.method === 'POST') return Promise.resolve(postResponse)
    return Promise.resolve({ ok: true, json: async () => [] })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('NewExperimentForm wizard', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    cleanup()
  })

  it('plays a wizard-open tone when the wizard mounts', () => {
    stubFetch({ ok: true, status: 201, json: async () => created })
    renderWizard()

    expect(playTone).toHaveBeenCalledWith('wizard-open')
  })

  it('plays a wizard-submit tone only after a successful submission, not on failure', async () => {
    stubFetch({ ok: false, status: 400, json: async () => ({ detail: 'cadence_type is required' }) })
    renderWizard()
    fillDetailsAndAdvance()
    fillCadenceAndAdvance()

    fireEvent.click(screen.getByRole('button', { name: 'Create experiment' }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(playTone).not.toHaveBeenCalledWith('wizard-submit')
  })

  it('renders Step 1 Details first, with the rail showing it current', () => {
    stubFetch({ ok: true, status: 201, json: async () => created })
    renderWizard()

    expect(screen.getByRole('heading', { name: 'Details' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Details' })).toHaveClass('current')
    expect(screen.getByRole('button', { name: 'Cadence' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Review' })).toBeDisabled()
  })

  it('blocks advancing from Details when title or hypothesis is empty', () => {
    stubFetch({ ok: true, status: 201, json: async () => created })
    renderWizard()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Please fill in title and hypothesis.')
    expect(screen.getByRole('heading', { name: 'Details' })).toBeInTheDocument()
  })

  it('blocks advancing from Cadence when cadence_type or target_days is empty', () => {
    stubFetch({ ok: true, status: 201, json: async () => created })
    renderWizard()
    fillDetailsAndAdvance()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Please fill in cadence type and target days.')
    expect(screen.getByRole('heading', { name: 'Cadence' })).toBeInTheDocument()
  })

  it('blocks advancing from Cadence when cadence_type is custom and cadence_days is blank', () => {
    stubFetch({ ok: true, status: 201, json: async () => created })
    renderWizard()
    fillDetailsAndAdvance()

    fireEvent.change(screen.getByLabelText('Cadence type'), { target: { value: 'custom' } })
    fireEvent.change(screen.getByPlaceholderText('Target days'), { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(screen.getByRole('alert')).toHaveTextContent(/cadence_days is required/i)
    expect(screen.getByRole('heading', { name: 'Cadence' })).toBeInTheDocument()
  })

  it('reaches Review with a read-only summary of Steps 1-2, and marks earlier steps completed', () => {
    stubFetch({ ok: true, status: 201, json: async () => created })
    renderWizard()
    fillDetailsAndAdvance()
    fillCadenceAndAdvance()

    expect(screen.getByRole('heading', { name: 'Review' })).toBeInTheDocument()
    expect(screen.getByText('Title: Drink more water')).toBeInTheDocument()
    expect(screen.getByText('Hypothesis: I will feel better')).toBeInTheDocument()
    expect(screen.getByText('Cadence: daily')).toBeInTheDocument()
    expect(screen.getByText('Target days: 30')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Details/ })).toHaveClass('completed')
    expect(screen.getByRole('button', { name: /Cadence/ })).toHaveClass('completed')
    expect(screen.getByRole('button', { name: 'Review' })).toHaveClass('current')
    // No inputs on Review.
    expect(screen.queryByPlaceholderText('Title')).not.toBeInTheDocument()
  })

  it('preserves entered data when going back from Review and forward again', () => {
    stubFetch({ ok: true, status: 201, json: async () => created })
    renderWizard()
    fillDetailsAndAdvance()
    fillCadenceAndAdvance()

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByLabelText('Cadence type')).toHaveValue('daily')
    expect(screen.getByPlaceholderText('Target days')).toHaveValue(30)

    fireEvent.click(screen.getByRole('button', { name: /Details/ }))
    expect(screen.getByPlaceholderText('Title')).toHaveValue('Drink more water')

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Title: Drink more water')).toBeInTheDocument()
  })

  it('does not allow jumping directly to Review by clicking an unreached step', () => {
    stubFetch({ ok: true, status: 201, json: async () => created })
    renderWizard()

    fireEvent.click(screen.getByRole('button', { name: 'Review' }))

    expect(screen.getByRole('heading', { name: 'Details' })).toBeInTheDocument()
  })

  it('submits on Create experiment and navigates to the dashboard on success', async () => {
    const fetchMock = stubFetch({ ok: true, status: 201, json: async () => created })
    renderWizard()
    fillDetailsAndAdvance()
    fillCadenceAndAdvance()

    fireEvent.click(screen.getByRole('button', { name: 'Create experiment' }))

    await waitFor(() => expect(screen.getByText('Dashboard view')).toBeInTheDocument())

    expect(playTone).toHaveBeenCalledWith('wizard-submit')
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

  it('shows the backend error via role="alert" on Review and keeps data intact for retry', async () => {
    stubFetch({ ok: false, status: 400, json: async () => ({ detail: 'cadence_type is required' }) })
    renderWizard()
    fillDetailsAndAdvance()
    fillCadenceAndAdvance()

    fireEvent.click(screen.getByRole('button', { name: 'Create experiment' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('cadence_type is required'))
    expect(screen.getByRole('heading', { name: 'Review' })).toBeInTheDocument()
    expect(screen.getByText('Title: Drink more water')).toBeInTheDocument()
  })
})
