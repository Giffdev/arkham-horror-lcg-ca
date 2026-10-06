import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TraumaDisplay } from './TraumaDisplay'

describe('TraumaDisplay', () => {
  it('renders accessible physical and mental trauma with currentColor SVGs', () => {
    const { container } = render(<TraumaDisplay physical={1} mental={2} />)

    expect(screen.getByLabelText('1 physical trauma, 2 mental trauma')).toBeVisible()

    const physical = container.querySelector('[data-slot="physical-trauma"]')
    const mental = container.querySelector('[data-slot="mental-trauma"]')
    expect(physical).toHaveClass('text-red-400')
    expect(mental).toHaveClass('text-sky-400')

    const svgRoots = container.querySelectorAll('svg')
    expect(svgRoots).toHaveLength(2)
    for (const svg of svgRoots) {
      expect(svg).toHaveAttribute('fill', 'currentColor')
      expect(svg).toHaveAttribute('aria-hidden', 'true')
      expect(svg).toHaveAttribute('focusable', 'false')
      expect(svg.querySelector('path')).toHaveAttribute('fill', 'currentColor')
    }
  })
})
