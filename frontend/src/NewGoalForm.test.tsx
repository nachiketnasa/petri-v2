import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import NewGoalForm from './NewGoalForm'
import { AuthProvider } from './AuthContext'
import { playTone } from './sound'

vi.mock('./sound', () => ({ playTone: vi.fn() }))

const created = {
  id: 'goal-1',
  title: 'Run a 10k',
  why_text: 'I want to build a real running habit',
  start_date: '2026-01-01',
  target_date: '2026-06-01',
  status: 'backlog',
  milestones: [],
}

function renderWizard() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/goals/new']}>
        <Routes>
          <Route path="/goals/new" element={<NewGoalForm />} />
          <Route path="/dashboard" element={<p>Dashboard view</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

function fillDetailsAndAdvance() {
  fireEvent.change(screen.getByPlaceholderText('Title'), { target: { value: 'Run a 10k' } })
  fireEvent.change(screen.getByPlaceholderText('Why this goal'), {
    target: { value: 'I want to build a real running habit' },
  })
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-01-01' } })
  fireEvent.change(screen.getByLabelText('Target date'), { target: { value: '2026-06-01' } })
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
}

function fillFirstMilestoneAndAdvance() {
  fireEvent.change(screen.getByPlaceholderText('Milestone title'), { target: { value: 'Run 5k without stopping' } })
  fireEvent.click(screen.getByRole('radio', { name: 'Weekly' }))
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

describe('NewGoalForm wizard', () => {
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

  it('links back to the dashboard', () => {
    stubFetch({ ok: true, status: 201, json: async () => created })
    renderWizard()

    const link = screen.getByRole('link', { name: 'Back to the dashboard' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/dashboard')
  })

  it('renders Step 1 Details first, with the rail showing it current', () => {
    stubFetch({ ok: true, status: 201, json: async () => created })
    renderWizard()

    expect(screen.getByRole('heading', { name: 'Details' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Details' })).toHaveClass('current')
    expect(screen.getByRole('button', { name: 'Milestones' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Review' })).toBeDisabled()
  })

  it('blocks advancing from Details when any field is empty', () => {
    stubFetch({ ok: true, status: 201, json: async () => created })
    renderWizard()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(screen.getByRole('alert')).toHaveTextContent(/please fill in/i)
    expect(screen.getByRole('heading', { name: 'Details' })).toBeInTheDocument()
  })

  it('starts with exactly one milestone and blocks advancing without a title/cadence', () => {
    stubFetch({ ok: true, status: 201, json: async () => created })
    renderWizard()
    fillDetailsAndAdvance()

    expect(screen.getByRole('heading', { name: 'Milestones' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Milestone title')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/title and a cadence type/i)
  })

  it('blocks advancing when a custom-cadence milestone has no cadence_days', () => {
    stubFetch({ ok: true, status: 201, json: async () => created })
    renderWizard()
    fillDetailsAndAdvance()

    fireEvent.change(screen.getByPlaceholderText('Milestone title'), { target: { value: 'First milestone' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Custom' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(screen.getByRole('alert')).toHaveTextContent(/cadence_days is required/i)
  })

  it('does not let the last remaining milestone be removed', () => {
    stubFetch({ ok: true, status: 201, json: async () => created })
    renderWizard()
    fillDetailsAndAdvance()

    expect(screen.getByRole('button', { name: /Remove milestone 1/ })).toBeDisabled()
  })

  it('adds, reorders, and removes milestones', () => {
    stubFetch({ ok: true, status: 201, json: async () => created })
    renderWizard()
    fillDetailsAndAdvance()

    fireEvent.change(screen.getByPlaceholderText('Milestone title'), { target: { value: 'First' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add milestone' }))

    const titles = screen.getAllByPlaceholderText('Milestone title')
    expect(titles).toHaveLength(2)
    fireEvent.change(titles[1], { target: { value: 'Second' } })

    // Move the second milestone up: now "Second" should be first.
    fireEvent.click(screen.getByRole('button', { name: /Move milestone 2 up/ }))
    expect(screen.getAllByPlaceholderText('Milestone title')[0]).toHaveValue('Second')

    // Remove one, down to a single milestone again.
    fireEvent.click(screen.getAllByRole('button', { name: /^Remove milestone/ })[0])
    expect(screen.getAllByPlaceholderText('Milestone title')).toHaveLength(1)
  })

  it('reaches Review with a summary, and marks earlier steps completed', () => {
    stubFetch({ ok: true, status: 201, json: async () => created })
    renderWizard()
    fillDetailsAndAdvance()
    fillFirstMilestoneAndAdvance()

    expect(screen.getByRole('heading', { name: 'Review' })).toBeInTheDocument()
    expect(screen.getByText('Title: Run a 10k')).toBeInTheDocument()
    expect(screen.getByText(/Run 5k without stopping — Weekly/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Details/ })).toHaveClass('completed')
    expect(screen.getByRole('button', { name: /Milestones/ })).toHaveClass('completed')
    expect(screen.getByRole('button', { name: 'Review' })).toHaveClass('current')
  })

  it('submits on Create goal and navigates to the dashboard on success', async () => {
    const fetchMock = stubFetch({ ok: true, status: 201, json: async () => created })
    renderWizard()
    fillDetailsAndAdvance()
    fillFirstMilestoneAndAdvance()

    fireEvent.click(screen.getByRole('button', { name: 'Create goal' }))

    await waitFor(() => expect(screen.getByText('Dashboard view')).toBeInTheDocument())

    expect(playTone).toHaveBeenCalledWith('wizard-submit')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/goals'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          title: 'Run a 10k',
          why_text: 'I want to build a real running habit',
          start_date: '2026-01-01',
          target_date: '2026-06-01',
          milestones: [{ title: 'Run 5k without stopping', cadence_type: 'weekly' }],
        }),
      }),
    )
  })

  it('shows the backend error via role="alert" on Review and keeps data intact for retry', async () => {
    stubFetch({ ok: false, status: 400, json: async () => ({ detail: 'why_text is required' }) })
    renderWizard()
    fillDetailsAndAdvance()
    fillFirstMilestoneAndAdvance()

    fireEvent.click(screen.getByRole('button', { name: 'Create goal' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('why_text is required'))
    expect(screen.getByRole('heading', { name: 'Review' })).toBeInTheDocument()
    expect(screen.getByText('Title: Run a 10k')).toBeInTheDocument()
  })
})
