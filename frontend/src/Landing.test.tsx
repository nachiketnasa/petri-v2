import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import Landing from './Landing'

function renderLanding() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/sign-in" element={<p>Sign-in page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Landing', () => {
  afterEach(() => {
    cleanup()
  })

  it('covers tiny experiments growing into goals, PACT, the WIP limit, and transparent endings', () => {
    const { container } = renderLanding()

    const copy = container.textContent!.toLowerCase()
    expect(copy).toContain('tiny experiment')
    expect(copy).toContain('goal')
    expect(copy).toContain('pact')
    expect(copy).toContain('work in progress')
    expect(copy).toContain('abandoned')
    expect(copy).toContain('honestly')
  })

  it('renders exactly one actionable control, which navigates to /sign-in', () => {
    renderLanding()

    const buttons = screen.getAllByRole('button')
    const links = screen.queryAllByRole('link')
    expect(buttons).toHaveLength(1)
    expect(links).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(screen.getByText('Sign-in page')).toBeInTheDocument()
  })

  it('has no sign-up/sign-in form fields on the landing page itself', () => {
    renderLanding()

    expect(screen.queryByPlaceholderText('Email')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Password')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Display name')).not.toBeInTheDocument()
  })
})
