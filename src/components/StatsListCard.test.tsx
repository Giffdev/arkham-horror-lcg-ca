/**
 * StatsListCard — behavior-first tests
 *
 * Target: src/components/StatsListCard.tsx (Dallas — not yet implemented)
 * These tests will fail until Dallas's production code lands. That is expected.
 * Tests themselves compile once the interface exists.
 *
 * Covered (per design doc D6, D11, Contract C):
 *  1. Collapsed at collapseAfter (default 5) — only the first N items visible
 *  2. Show-all button text and item count
 *  3. Expand reveals all items
 *  4. Collapse hides tail again
 *  5. aria-expanded correctness
 *  6. aria-controls points at the list region
 *  7. Focus returns to the toggle button on collapse (D11)
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { StatsListCard } from './StatsListCard'
import type { StatsListItem, StatsListCardProps } from './StatsListCard'
import { Trophy } from '@phosphor-icons/react'

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeItems(n: number): StatsListItem[] {
  return Array.from({ length: n }, (_, i) => ({
    key: `item-${i + 1}`,
    countLabel: `${i + 1} plays`,
    renderContent: () => <span>Campaign {i + 1}</span>,
  }))
}

function defaultProps(overrides?: Partial<StatsListCardProps>): StatsListCardProps {
  return {
    icon: Trophy,
    title: 'Most Popular Campaigns',
    items: makeItems(10),
    ...overrides,
  }
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe('StatsListCard', () => {
  describe('collapsed render', () => {
    it('shows only the first 5 items by default', () => {
      render(<StatsListCard {...defaultProps()} />)
      // visible items
      expect(screen.getByText('Campaign 1')).toBeVisible()
      expect(screen.getByText('Campaign 5')).toBeVisible()
      // item 6 should not be in the document OR not be visible
      expect(screen.queryByText('Campaign 6')).not.toBeVisible()
    })

    it('shows only the first collapseAfter items when explicitly set', () => {
      render(<StatsListCard {...defaultProps({ collapseAfter: 3 })} />)
      expect(screen.getByText('Campaign 3')).toBeVisible()
      expect(screen.queryByText('Campaign 4')).not.toBeVisible()
    })

    it('does not render a show-all button when items.length <= collapseAfter', () => {
      render(<StatsListCard {...defaultProps({ items: makeItems(5) })} />)
      expect(screen.queryByRole('button', { name: /show all/i })).not.toBeInTheDocument()
    })

    it('renders a show-all button when items exceed collapseAfter', () => {
      render(<StatsListCard {...defaultProps({ items: makeItems(8) })} />)
      expect(screen.getByRole('button', { name: /show all/i })).toBeVisible()
    })

    it('show-all button label reflects the remaining item count', () => {
      render(<StatsListCard {...defaultProps({ items: makeItems(10) })} />)
      // 10 - 5 = 5 more items
      expect(screen.getByRole('button', { name: /show all/i })).toBeVisible()
      expect(screen.getByRole('button', { name: /10/i })).toBeVisible()
    })
  })

  describe('expand and collapse', () => {
    it('expands to show all items after clicking show-all', async () => {
      const user = userEvent.setup()
      render(<StatsListCard {...defaultProps({ items: makeItems(8) })} />)
      await user.click(screen.getByRole('button', { name: /show all/i }))
      for (let i = 1; i <= 8; i++) {
        expect(screen.getByText(`Campaign ${i}`)).toBeVisible()
      }
    })

    it('collapses back to the first 5 after a second click', async () => {
      const user = userEvent.setup()
      render(<StatsListCard {...defaultProps({ items: makeItems(8) })} />)
      const toggle = screen.getByRole('button', { name: /show all/i })
      await user.click(toggle)
      // now collapse
      await user.click(screen.getByRole('button', { name: /show (less|fewer)/i }))
      expect(screen.queryByText('Campaign 6')).not.toBeVisible()
    })
  })

  describe('accessibility', () => {
    it('toggle button has aria-expanded=false when collapsed', () => {
      render(<StatsListCard {...defaultProps()} />)
      const btn = screen.getByRole('button', { name: /show all/i })
      expect(btn).toHaveAttribute('aria-expanded', 'false')
    })

    it('toggle button has aria-expanded=true when expanded', async () => {
      const user = userEvent.setup()
      render(<StatsListCard {...defaultProps()} />)
      const btn = screen.getByRole('button', { name: /show all/i })
      await user.click(btn)
      // re-query to get updated attribute
      expect(screen.getByRole('button', { name: /show (less|fewer)/i })).toHaveAttribute(
        'aria-expanded',
        'true',
      )
    })

    it('toggle button has aria-controls pointing at the list region', () => {
      render(<StatsListCard {...defaultProps()} />)
      const btn = screen.getByRole('button', { name: /show all/i })
      const controlledId = btn.getAttribute('aria-controls')
      expect(controlledId).toBeTruthy()
      // the controlled element must be in the DOM
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(document.getElementById(controlledId!)).toBeInTheDocument()
    })

    it('returns focus to the toggle button after collapsing (D11)', async () => {
      const user = userEvent.setup()
      render(<StatsListCard {...defaultProps()} />)
      const expandBtn = screen.getByRole('button', { name: /show all/i })
      await user.click(expandBtn)
      const collapseBtn = screen.getByRole('button', { name: /show (less|fewer)/i })
      await user.click(collapseBtn)
      // After collapse, the toggle (now back to "show all") must have focus
      expect(screen.getByRole('button', { name: /show all/i })).toHaveFocus()
    })

    it('renders the card title', () => {
      render(<StatsListCard {...defaultProps()} />)
      expect(screen.getByText('Most Popular Campaigns')).toBeVisible()
    })

    it('renders an optional subtitle when provided', () => {
      render(
        <StatsListCard
          {...defaultProps({ subtitle: 'Full, Small & Return-to campaigns' })}
        />,
      )
      expect(screen.getByText('Full, Small & Return-to campaigns')).toBeVisible()
    })
  })
})
