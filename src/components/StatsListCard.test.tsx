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

  describe('overflow containment — "Show all" text overrun regression', () => {
    /**
     * jsdom cannot compute physical pixel overflow, so we assert the DOM/CSS
     * contract that prevents it:
     *
     *   1. The expand toggle (Show less) remains accessible after expansion.
     *   2. Expanded content is wrapped in a max-height, overflow-y-auto div,
     *      providing a deliberate scroll boundary.
     *   3. Each row's content cell has min-w-0 + flex-1 so long labels cannot
     *      push the count label off-screen — they truncate within flex flow.
     *   4. The count label is flex-shrink-0, ensuring it is never squeezed out.
     *
     * Physical overflow testing requires a real browser (e.g., Playwright).
     */

    it('Show less button is accessible (in the DOM and enabled) after expansion', async () => {
      const user = userEvent.setup()
      render(<StatsListCard {...defaultProps({ items: makeItems(10) })} />)
      await user.click(screen.getByRole('button', { name: /show all/i }))
      const showLessBtn = screen.getByRole('button', { name: /show (less|fewer)/i })
      expect(showLessBtn).toBeInTheDocument()
      expect(showLessBtn).not.toBeDisabled()
    })

    it('expanded scroll region carries max-h-[420px] class (containment boundary)', async () => {
      const user = userEvent.setup()
      render(<StatsListCard {...defaultProps({ items: makeItems(8) })} />)
      await user.click(screen.getByRole('button', { name: /show all/i }))
      const scrollRegion = document.querySelector('[data-expanded-scroll-region]')
      expect(scrollRegion).toBeInTheDocument()
      expect(scrollRegion!.className).toMatch(/max-h-\[420px\]/)
    })

    it('expanded scroll region carries overflow-y-auto (CSS contract, mutation guard)', async () => {
      const user = userEvent.setup()
      render(<StatsListCard {...defaultProps({ items: makeItems(8) })} />)
      await user.click(screen.getByRole('button', { name: /show all/i }))
      const scrollRegion = document.querySelector('[data-expanded-scroll-region]')
      expect(scrollRegion).toBeInTheDocument()
      // Mutation guard: removing overflow-y-auto breaks scroll containment.
      // This assertion fails if that class is removed.
      expect(scrollRegion!.className).toMatch(/overflow-y-auto/)
    })

    it('scroll-area wrapper is present when expanded with >10 items', async () => {
      const user = userEvent.setup()
      render(<StatsListCard {...defaultProps({ items: makeItems(11) })} />)
      await user.click(screen.getByRole('button', { name: /show all/i }))
      // The expanded scroll region must be in the DOM.
      const btn = screen.getByRole('button', { name: /show (less|fewer)/i })
      const controlledId = btn.getAttribute('aria-controls')
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const listRegion = document.getElementById(controlledId!)
      expect(listRegion).toBeInTheDocument()
      // Traverse ancestors looking for the scroll-area root or max-h containment
      let el: Element | null = listRegion?.parentElement ?? null
      let foundScrollArea = false
      while (el) {
        if (
          el.hasAttribute('data-radix-scroll-area-root') ||
          el.hasAttribute('data-expanded-scroll-region') ||
          (el.className && el.className.includes('max-h-'))
        ) {
          foundScrollArea = true
          break
        }
        el = el.parentElement
      }
      expect(foundScrollArea).toBe(true)
    })

    it('each row content cell carries min-w-0 to prevent label overflow', () => {
      render(<StatsListCard {...defaultProps({ items: makeItems(6) })} />)
      const campaignEl = screen.getByText('Campaign 1')
      const contentCell = campaignEl.closest('[class*="min-w-0"]')
      expect(contentCell).toBeInTheDocument()
    })

    it('count label has flex-shrink-0 so it is never squeezed by long content', () => {
      render(<StatsListCard {...defaultProps({ items: makeItems(3) })} />)
      const countLabel = screen.getByText('1 plays')
      expect(countLabel).toBeInTheDocument()
      expect(countLabel.className).toMatch(/flex-shrink-0/)
    })
  })

  describe('8-item boundary — original bug gate (6–10 items)', () => {
    /**
     * The original overflow bug manifested with 6–10 items. An earlier guard
     * used `items.length > 10`, which would never trigger containment for this
     * range. These tests exercise a representative 7- and 8-item set to confirm
     * the scroll/containment path fires correctly within the original bug range.
     */

    it('renders a show-all button with 8 items (> collapseAfter=5)', () => {
      render(<StatsListCard {...defaultProps({ items: makeItems(8) })} />)
      expect(screen.getByRole('button', { name: /show all/i })).toBeVisible()
    })

    it('expands 8 items and shows containment div', async () => {
      const user = userEvent.setup()
      render(<StatsListCard {...defaultProps({ items: makeItems(8) })} />)
      await user.click(screen.getByRole('button', { name: /show all/i }))
      // All 8 items visible
      for (let i = 1; i <= 8; i++) {
        expect(screen.getByText(`Campaign ${i}`)).toBeVisible()
      }
      // Containment boundary present
      expect(document.querySelector('[data-expanded-scroll-region]')).toBeInTheDocument()
    })

    it('renders a show-all button with 7 items (> collapseAfter=5)', () => {
      render(<StatsListCard {...defaultProps({ items: makeItems(7) })} />)
      expect(screen.getByRole('button', { name: /show all/i })).toBeVisible()
    })

    it('expands 7 items and shows all rows', async () => {
      const user = userEvent.setup()
      render(<StatsListCard {...defaultProps({ items: makeItems(7) })} />)
      await user.click(screen.getByRole('button', { name: /show all/i }))
      for (let i = 1; i <= 7; i++) {
        expect(screen.getByText(`Campaign ${i}`)).toBeVisible()
      }
    })
  })

  describe('keyboard accessibility — expanded scroll region (Blocker 1)', () => {
    /**
     * When expanded, the scroll region must enter tab order (tabIndex=0) so
     * sighted keyboard-only users can Tab to it and use Arrow/Page keys.
     * Radix ScrollArea viewport is tabIndex=-1 by default — the fix replaces
     * Radix with a focusable div for the expanded state.
     */

    it('expanded scroll region has tabIndex=0 (enters tab order)', async () => {
      const user = userEvent.setup()
      render(<StatsListCard {...defaultProps({ items: makeItems(8) })} />)
      await user.click(screen.getByRole('button', { name: /show all/i }))
      const scrollRegion = document.querySelector('[data-expanded-scroll-region]')
      expect(scrollRegion).toBeInTheDocument()
      expect(scrollRegion).toHaveAttribute('tabIndex', '0')
    })

    it('expanded scroll region receives focus after expand', async () => {
      const user = userEvent.setup()
      render(<StatsListCard {...defaultProps({ items: makeItems(8) })} />)
      await user.click(screen.getByRole('button', { name: /show all/i }))
      const scrollRegion = document.querySelector('[data-expanded-scroll-region]')
      expect(scrollRegion).toHaveFocus()
    })

    it('collapsed state does not expose a tab-order scroll region', () => {
      render(<StatsListCard {...defaultProps({ items: makeItems(8) })} />)
      expect(document.querySelector('[data-expanded-scroll-region]')).not.toBeInTheDocument()
    })
  })
})
