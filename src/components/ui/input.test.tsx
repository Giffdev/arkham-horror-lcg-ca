import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Input } from './input'

describe('Input theme safety classes', () => {
  it('can hide native number spinners without changing number-input semantics', () => {
    render(<Input aria-label="XP" type="number" inputMode="numeric" min={0} hideNumberSpinners />)

    const input = screen.getByLabelText('XP')
    expect(input).toHaveAttribute('type', 'number')
    expect(input).toHaveAttribute('inputmode', 'numeric')
    expect(input).toHaveAttribute('min', '0')
    expect(input).toHaveClass(
      '[appearance:textfield]',
      '[&::-webkit-inner-spin-button]:appearance-none',
      '[&::-webkit-outer-spin-button]:appearance-none',
    )
  })

  it('does not hide native number spinners unless requested', () => {
    render(<Input aria-label="Unrelated number" type="number" />)

    expect(screen.getByLabelText('Unrelated number')).not.toHaveClass('[appearance:textfield]')
  })

  it('keeps explicit foreground styling in disabled state', () => {
    render(<Input aria-label="Disabled field" disabled value="Locked value" readOnly />)

    const input = screen.getByLabelText('Disabled field')
    expect(input.className).toContain('disabled:text-foreground')
    expect(input.className).toContain('disabled:[-webkit-text-fill-color:currentColor]')
    expect(input.className).toContain('disabled:opacity-70')
  })

  it('keeps explicit foreground styling in read-only state', () => {
    render(<Input aria-label="Read only field" readOnly value="Campaign name" />)

    const input = screen.getByLabelText('Read only field')
    expect(input.className).toContain('read-only:text-foreground')
    expect(input.className).toContain('read-only:[-webkit-text-fill-color:currentColor]')
    expect(input.className).toContain('read-only:opacity-100')
  })
})
