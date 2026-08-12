/**
 * Ripley — Rendered Icon Regressions (hotfix/rendered-icon-regressions, 2026-08-12)
 *
 * These tests cover the two visual regressions that survived PR #8:
 *
 * K. Neutral badge / filter icon renders with the same foreground as the label.
 *    Root cause: neutral.svg (Inkscape export) had <sodipodi:namedview> and other
 *    Inkscape metadata that disrupted fill-color inheritance in real browsers when
 *    the SVG is injected via dangerouslySetInnerHTML.  After the fix, normalise()
 *    strips those elements AND injects fill="currentColor" on every shape element
 *    (belt-and-suspenders), so the icon never relies solely on CSS inheritance.
 *
 * L. Popular Standalone Scenarios card: Barkham Horror shows barkham_horror.svg,
 *    not the Elder Sign fallback.  Root cause: the prior fix only added a registry
 *    alias but the rendering resolver in CommunityStats used s.name directly with
 *    no fallback to s.set.  Old Firestore data may carry either the full scenario
 *    name OR just the set name ("Barkham Horror") for Barkham entries.
 *    The new standaloneIconKey() resolver checks both.
 *
 * Test strategy:
 *  - Tests inspect rendered DOM structure and SVG path content, NOT Tailwind
 *    class snapshots.  SVG path `d` attributes are compared against known unique
 *    substrings from the authoritative SVG files to assert icon identity.
 *  - Elder Sign fallback identity: first path `d` starts with "M352.418"
 *  - Barkham Horror identity: first path `d` starts with "M695.315"
 *  These are stable substrings within the minified SVG files.
 */

import { render, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ArchetypeBadge } from './ArchetypeBadge'
import { Filters } from './Filters'
import { CommunityStats } from './CommunityStats'

// matchMedia is not implemented in jsdom
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  })
})

// ─── CommunityStats mock ──────────────────────────────────────────────────────
vi.mock('@/lib/community-stats', () => ({
  getCommunityStats: vi.fn(),
}))
import { getCommunityStats } from '@/lib/community-stats'
const mockGetCommunityStats = vi.mocked(getCommunityStats)

// ─── Distinctive SVG path prefix used to assert icon identity ─────────────────
//
// These substrings come from the first path `d` attribute of each asset and are
// unique enough to distinguish them without importing the full raw SVG string.
const ELDER_SIGN_PATH_PREFIX = 'M352.418'   // elder_sign.svg → fallback
const BARKHAM_PATH_PREFIX     = 'M695.315'  // barkham_horror.svg

const noop = () => {}

// ─── K. Neutral badge / filter icon — path carries fill="currentColor" ────────
//
// Regression: the icon rendered black in the Neutral badge and filter while the
// Neutral text was light grey.  The fix adds fill="currentColor" directly on each
// SVG shape element (belt-and-suspenders) so the icon's fill is explicit even if
// CSS color inheritance from the parent HTML element is incomplete in the browser.

describe('Neutral badge / filter icon — path-level fill="currentColor" (K)', () => {
  it('ArchetypeBadge Neutral: the icon <path> carries fill="currentColor" directly', () => {
    const { container } = render(<ArchetypeBadge archetype="Neutral" />)
    const hiddenSpan = container.querySelector('[aria-hidden="true"]')
    expect(hiddenSpan, 'icon span must be present').not.toBeNull()
    const path = hiddenSpan!.querySelector('path')
    expect(path, 'SVG path must be present inside icon').not.toBeNull()
    expect(
      path!.getAttribute('fill'),
      'icon path must carry fill="currentColor" directly so browser fill-inheritance cannot miss it',
    ).toBe('currentColor')
  })

  it('ArchetypeBadge Neutral: icon span and text are siblings inside the same text-neutral-text element', () => {
    const { container } = render(<ArchetypeBadge archetype="Neutral" />)
    // Badge (data-slot="badge") is the shared parent for both icon and text
    const badge = container.querySelector('[data-slot="badge"]')
    expect(badge, 'Badge element must be present').not.toBeNull()
    expect(
      badge!.className,
      'Badge must carry text-neutral-text so icon and text share the same color context',
    ).toContain('text-neutral-text')
    const iconSpan = badge!.querySelector('[aria-hidden="true"]')
    expect(iconSpan, 'icon span must be a descendant of the badge').not.toBeNull()
    // Icon span is a direct child of the badge (same color context as the text node)
    expect(
      iconSpan!.parentElement,
      'icon span must be a direct child of the badge element',
    ).toBe(badge)
  })

  it('Filters Neutral: the icon <path> carries fill="currentColor" directly', () => {
    const { container } = render(
      <Filters
        selectedArchetypes={[]}
        selectedCampaignTypes={[]}
        selectedCampaigns={[]}
        onArchetypeToggle={noop}
        onCampaignTypeToggle={noop}
        onCampaignToggle={noop}
        onClearFilters={noop}
        playthroughs={[]}
      />,
    )
    const buttons = container.querySelectorAll('button')
    const neutralBtn = Array.from(buttons).find(b => b.textContent?.includes('Neutral'))
    expect(neutralBtn, 'Neutral filter button must exist').toBeTruthy()
    const iconSpan = neutralBtn!.querySelector('[aria-hidden="true"]')
    expect(iconSpan, 'icon span must be present in Neutral button').not.toBeNull()
    const path = iconSpan!.querySelector('path')
    expect(path, 'SVG path must be present inside icon span').not.toBeNull()
    expect(
      path!.getAttribute('fill'),
      'Neutral filter icon path must carry fill="currentColor" directly',
    ).toBe('currentColor')
  })

  it('Filters Neutral: icon span is a sibling of the Neutral text inside the button (same color context)', () => {
    const { container } = render(
      <Filters
        selectedArchetypes={[]}
        selectedCampaignTypes={[]}
        selectedCampaigns={[]}
        onArchetypeToggle={noop}
        onCampaignTypeToggle={noop}
        onCampaignToggle={noop}
        onClearFilters={noop}
        playthroughs={[]}
      />,
    )
    const buttons = container.querySelectorAll('button')
    const neutralBtn = Array.from(buttons).find(b => b.textContent?.includes('Neutral'))!
    // Button itself carries text-neutral-text so both icon and text inherit the same color
    expect(
      neutralBtn.className,
      'idle Neutral filter button must carry text-neutral-text',
    ).toContain('text-neutral-text')
    const iconSpan = neutralBtn.querySelector('[aria-hidden="true"]')
    expect(
      iconSpan?.parentElement,
      'icon span must be a direct child of the button (same color context as text)',
    ).toBe(neutralBtn)
  })
})

// ─── L. Popular Standalone Scenarios: Barkham Horror uses barkham_horror.svg ──
//
// Regression: Barkham Horror showed the Elder Sign fallback (or core-set icon)
// instead of barkham_horror.svg.  The previous registry alias test only checked
// getCampaignSvgRaw(), not the actual CommunityStats rendering path.
//
// Tested label variants:
//  1. Full canonical scenario name (from rebuilt community stats post-PR #7)
//  2. Set name only ("Barkham Horror") — legacy Firestore data shape
//     standaloneIconKey() falls back to s.set when s.name isn't in the registry

async function renderCommunityStatsWithBarkham(standaloneEntry: {
  name: string
  count: number
  set?: string
  breakdown?: { asStandalone: number; asSideStory: number }
}) {
  const stats = {
    totalGames: 5,
    registeredUsers: 2,
    totalInvestigatorsPlayed: 3,
    topCampaigns: [{ name: 'The Night of the Zealot', count: 5, set: 'Core' }],
    topInvestigators: [],
    topClasses: [],
    topStandalones: [standaloneEntry],
    topSideScenarios: [],
    lastUpdated: Date.now(),
  }
  mockGetCommunityStats.mockResolvedValueOnce(stats as never)
  render(<CommunityStats />)
  await waitFor(() =>
    expect(screen.queryByText(/loading community stats/i)).not.toBeInTheDocument(),
  )
}

describe('CommunityStats standalone card — Barkham Horror icon identity (L)', () => {
  beforeEach(() => vi.resetAllMocks())

  it('full scenario name: icon is barkham_horror.svg (not Elder Sign fallback)', async () => {
    await renderCommunityStatsWithBarkham({
      name: 'Barkham Horror: The Meddling of Meowlathotep',
      count: 3,
      set: 'Barkham Horror',
      breakdown: { asStandalone: 2, asSideStory: 1 },
    })

    // The name text is inside a <span class="font-medium text-foreground"> within the
    // standalone entry's atomic row: <span class="inline-flex ..."><iconSpan/><nameSpan/></span>
    const nameEl = screen.getByText('Barkham Horror: The Meddling of Meowlathotep')
    const atomicRow = nameEl.parentElement as HTMLElement
    const iconSpan = atomicRow?.querySelector('[aria-hidden="true"]')
    expect(iconSpan, 'icon span must be present for Barkham entry').not.toBeNull()

    const svgHTML = iconSpan!.innerHTML
    expect(
      svgHTML,
      'Barkham icon must use barkham_horror.svg (contains barkham path prefix)',
    ).toContain(BARKHAM_PATH_PREFIX)
    expect(
      svgHTML,
      'Barkham icon must NOT use the Elder Sign fallback',
    ).not.toContain(ELDER_SIGN_PATH_PREFIX)
  })

  it('set-name label "Barkham Horror" (legacy data): icon is barkham_horror.svg via standaloneIconKey fallback', async () => {
    await renderCommunityStatsWithBarkham({
      name: 'Barkham Horror',
      count: 2,
      set: 'Barkham Horror',
    })

    const nameEl = screen.getByText('Barkham Horror')
    const atomicRow = nameEl.parentElement as HTMLElement
    const iconSpan = atomicRow?.querySelector('[aria-hidden="true"]')
    expect(iconSpan, 'icon span must be present for set-name Barkham entry').not.toBeNull()

    const svgHTML = iconSpan!.innerHTML
    expect(
      svgHTML,
      'Set-name Barkham entry must use barkham_horror.svg',
    ).toContain(BARKHAM_PATH_PREFIX)
    expect(
      svgHTML,
      'Set-name Barkham entry must NOT use the Elder Sign fallback',
    ).not.toContain(ELDER_SIGN_PATH_PREFIX)
  })

  it('standaloneIconKey uses s.name when it resolves to a dedicated icon', async () => {
    await renderCommunityStatsWithBarkham({
      name: 'Curse of the Rougarou',
      count: 4,
      set: 'Scenario Pack',
    })

    const nameEl = screen.getByText('Curse of the Rougarou')
    const atomicRow = nameEl.parentElement as HTMLElement
    const iconSpan = atomicRow?.querySelector('[aria-hidden="true"]')
    expect(iconSpan, 'icon span must be present for Rougarou entry').not.toBeNull()
    // Rougarou uses curse_of_the_rougarou.svg — not the Elder Sign fallback
    expect(
      iconSpan!.innerHTML,
      'Rougarou must not use the Elder Sign fallback (dedicated icon exists)',
    ).not.toContain(ELDER_SIGN_PATH_PREFIX)
  })
})
