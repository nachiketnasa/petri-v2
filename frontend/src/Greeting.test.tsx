import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Greeting, { rememberDisplayName, salutationFor } from './Greeting'

function renderGreeting() {
  return render(
    <MemoryRouter initialEntries={['/greeting']}>
      <Routes>
        <Route path="/greeting" element={<Greeting />} />
        <Route path="/dashboard" element={<p>Dashboard page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('salutationFor', () => {
  it('reads morning, afternoon, and evening from the hour', () => {
    expect(salutationFor(new Date('2026-01-01T08:00:00'))).toBe('Good morning')
    expect(salutationFor(new Date('2026-01-01T14:00:00'))).toBe('Good afternoon')
    expect(salutationFor(new Date('2026-01-01T20:00:00'))).toBe('Good evening')
  })
})

describe('Greeting', () => {
  afterEach(() => {
    localStorage.clear()
    vi.useRealTimers()
    cleanup()
  })

  it('greets by time of day and display name, with one quiet due-today line', () => {
    rememberDisplayName('Nachiket')
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T08:00:00'))

    renderGreeting()

    expect(screen.getByText('Good morning, Nachiket.')).toBeInTheDocument()
    expect(screen.getByText('Nothing due today.')).toBeInTheDocument()
    // No stat grid, cards, or color-block tiles on this screen.
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('navigates to the dashboard via a single explicit action', () => {
    rememberDisplayName('Nachiket')
    renderGreeting()

    fireEvent.click(screen.getByRole('button', { name: 'Open dashboard' }))

    expect(screen.getByText('Dashboard page')).toBeInTheDocument()
  })

  it('still shows the correct name after a refresh (the name is cached, not held in memory)', () => {
    rememberDisplayName('Nachiket')
    renderGreeting()
    expect(screen.getByText('Nachiket', { exact: false })).toBeInTheDocument()
    cleanup()

    // Simulate a page refresh: a fresh mount reading the same storage key,
    // not anything held in component state from the first mount.
    renderGreeting()

    expect(screen.getByText('Nachiket', { exact: false })).toBeInTheDocument()
  })

  it('reads as a plain salutation, with no name, when none has ever been remembered', () => {
    renderGreeting()

    expect(screen.getByText(/^Good (morning|afternoon|evening)\.$/)).toBeInTheDocument()
  })
})
