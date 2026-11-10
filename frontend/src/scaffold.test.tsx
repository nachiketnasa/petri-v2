import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('scaffold', () => {
  it('renders', () => {
    render(<p>ok</p>)
    expect(screen.getByText('ok')).toBeInTheDocument()
  })
})
