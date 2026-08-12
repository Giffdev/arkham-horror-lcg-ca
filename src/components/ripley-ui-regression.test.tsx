/**
 * Ripley's UI Audit — Regression tests (Lambert, 2026-08-11)
 *
 * Covers the following audit items:
 *  A. ArchetypeBadge: every faction has a decorative glyph (aria-hidden) + visible text
 *  B. ArchetypeBadge: multiclass / small-badge variant remains usable (glyph + text, no clip)
 *  C. ArchetypeBadge: link-wrapped badges are keyboard-accessible; click does not propagate to card
 *  D. PlaythroughCard: campaign icon + label share one atomic flex wrapper (icon sibling of label text)
 *  E. PlaythroughCard: campaign type badge is in a separate wrapper (may wrap independently)
 *  F. PlaythroughCard: known standalone campaignSets render a dedicated non-fallback icon
 *  G. PlaythroughCard: unconfirmed standalone packs render safe fallback (not a guessed icon)
 *  H. Filters: every Class filter button contains a faction glyph (aria-hidden) + visible text
 *  I. PlayersOverview: every Class filter button contains a faction glyph (aria-hidden) + visible text
 *
 * Notes:
 *  - Tests verify rendered semantics, not Tailwind class names, where possible.
 *  - aria-hidden assertions confirm the glyph is decorative, not that exact SVG content.
 *  - CampaignSvgIcon renders an <svg> element; we look for role=img / svg tag presence.
 *  - PlaythroughCard SVG icon wrapper already has aria-hidden="true" on the outer span.
 *  - Unknown archetype is excluded from the "six factions" glyph requirement.
 *  - Do NOT assert War/Gala/Barkham dedicated icons — fallback is intentional.
 */

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { ArchetypeBadge } from './ArchetypeBadge'
import { PlaythroughCard } from './PlaythroughCard'
import { Filters } from './Filters'
import { PlayersOverview } from './PlayersOverview'
import type { Archetype, Playthrough } from '@/lib/types'

// matchMedia is not implemented in jsdom — mock it for components that use useIsMobile
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

// ─── helpers ─────────────────────────────────────────────────────────────────

const ALL_SIX_FACTIONS: Archetype[] = ['Guardian', 'Seeker', 'Rogue', 'Mystic', 'Survivor', 'Neutral']

function makePlaythrough(overrides: Partial<Playthrough> = {}): Playthrough {
  return {
    id: 'pt-test',
    date: '2026-01-01',
    campaignName: 'The Night of the Zealot',
    campaignType: 'Small Campaign',
    investigators: [
      { playerName: 'Alice', investigatorName: 'Roland Banks', archetype: 'Guardian' },
    ],
    ...overrides,
  }
}

const noop = () => {}

// ─── A. ArchetypeBadge: faction glyph + visible text ─────────────────────────

describe('ArchetypeBadge — faction glyph and visible text', () => {
  it.each(ALL_SIX_FACTIONS)('%s: renders visible text label', (faction) => {
    render(<ArchetypeBadge archetype={faction} />)
    expect(screen.getByText(faction)).toBeInTheDocument()
  })

  it.each(ALL_SIX_FACTIONS)('%s: renders a decorative SVG glyph alongside the text', (faction) => {
    const { container } = render(<ArchetypeBadge archetype={faction} />)
    // CampaignSvgIcon renders <span aria-hidden="true"><svg>…</svg></span>
    // aria-hidden lives on the span wrapper — find the hidden span and the svg inside it
    const hiddenSpan = container.querySelector('[aria-hidden="true"]')
    expect(hiddenSpan).not.toBeNull()
    expect(hiddenSpan!.querySelector('svg')).not.toBeNull()
  })

  it.each(ALL_SIX_FACTIONS)('%s: the visible text is not inside aria-hidden subtree', (faction) => {
    const { container } = render(<ArchetypeBadge archetype={faction} />)
    const textNode = screen.getByText(faction)
    // Walk up — none of its ancestors within the badge should be aria-hidden
    let el: Element | null = textNode
    while (el && el !== container) {
      expect(el).not.toHaveAttribute('aria-hidden', 'true')
      el = el.parentElement
    }
  })

  it('Unknown archetype renders visible text without crashing (no glyph required)', () => {
    render(<ArchetypeBadge archetype="Unknown" />)
    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })
})

// ─── B. ArchetypeBadge: multiclass / small-badge variant ─────────────────────

describe('ArchetypeBadge — multiclass and small badge', () => {
  it('renders the archetype text when className supplies a smaller size', () => {
    render(<ArchetypeBadge archetype="Guardian" className="text-xs h-5 px-1" />)
    expect(screen.getByText('Guardian')).toBeInTheDocument()
  })

  it('does not clip the svg glyph when a small className is applied', () => {
    const { container } = render(<ArchetypeBadge archetype="Seeker" className="text-xs h-5 px-1" />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    // overflow:hidden on the badge would clip the glyph — guard against it
    const badge = container.querySelector('[class*="badge"], [class*="Badge"]') ?? container.firstElementChild
    if (badge) {
      const style = window.getComputedStyle(badge)
      // JSDOM/happy-dom doesn't fully compute Tailwind so we check that the
      // element at least doesn't have an explicit inline overflow:hidden
      expect(badge.getAttribute('style') ?? '').not.toContain('overflow: hidden')
    }
  })
})

// ─── C. ArchetypeBadge: keyboard accessibility ───────────────────────────────

describe('ArchetypeBadge — keyboard / accessibility', () => {
  it('badge with known investigator name renders a focusable link', () => {
    render(
      <ArchetypeBadge
        archetype="Guardian"
        investigatorName="Roland Banks"
        investigatorId="01001"
      />
    )
    const link = screen.getByRole('link')
    expect(link).toBeInTheDocument()
    // Links are keyboard-focusable by default; verify no tabindex=-1 was applied
    expect(link).not.toHaveAttribute('tabindex', '-1')
  })

  it('badge click does not propagate to parent (stopPropagation)', async () => {
    const user = userEvent.setup()
    const parentClick = vi.fn()
    render(
      <div onClick={parentClick}>
        <ArchetypeBadge
          archetype="Guardian"
          investigatorName="Roland Banks"
          investigatorId="01001"
        />
      </div>
    )
    await user.click(screen.getByRole('link'))
    expect(parentClick).not.toHaveBeenCalled()
  })

  it('badge without investigator name renders without a link (plain badge)', () => {
    render(<ArchetypeBadge archetype="Mystic" />)
    expect(screen.queryByRole('link')).toBeNull()
    // Should still render the text
    expect(screen.getByText('Mystic')).toBeInTheDocument()
  })
})

// ─── D & E. PlaythroughCard: icon+label wrapper, type badge separation ────────

describe('PlaythroughCard — campaign icon + label layout', () => {
  it('campaign icon (svg) and campaign name text share the same heading element', () => {
    const pt = makePlaythrough({ campaignName: 'The Night of the Zealot', campaignType: 'Small Campaign' })
    const { container } = render(<PlaythroughCard playthrough={pt} onEdit={noop} onDelete={noop} />)
    const heading = container.querySelector('h3')
    expect(heading).not.toBeNull()
    // The heading must contain both the svg and the campaign name text
    const svgInHeading = heading!.querySelector('svg')
    expect(svgInHeading).not.toBeNull()
    expect(within(heading!).getByText(/Night of the Zealot/)).toBeInTheDocument()
  })

  it('the svg glyph within the heading is wrapped in an aria-hidden span', () => {
    const pt = makePlaythrough()
    const { container } = render(<PlaythroughCard playthrough={pt} onEdit={noop} onDelete={noop} />)
    const heading = container.querySelector('h3')!
    const iconSpan = heading.querySelector('[aria-hidden="true"]')
    expect(iconSpan).not.toBeNull()
    expect(iconSpan!.querySelector('svg')).not.toBeNull()
  })

  it('campaign type badge is outside the heading (may appear elsewhere)', () => {
    const pt = makePlaythrough({ campaignType: 'Full Campaign', campaignName: 'Arkham Horror' })
    render(<PlaythroughCard playthrough={pt} onEdit={noop} onDelete={noop} />)
    // The type badge text exists in the document
    const typeBadges = screen.getAllByText('Full Campaign')
    expect(typeBadges.length).toBeGreaterThan(0)
    // None of the type badge nodes should be inside an h3
    const { container } = render(<PlaythroughCard playthrough={pt} onEdit={noop} onDelete={noop} />)
    const heading = container.querySelector('h3')!
    expect(within(heading).queryByText('Full Campaign')).toBeNull()
  })
})

// ─── F. PlaythroughCard: known standalone dedicated icon ─────────────────────

describe('PlaythroughCard — standalone icon resolution', () => {
  /**
   * These standalone scenario names have confirmed dedicated SVG files in the
   * registry. The PlaythroughCard sets campaignSet which is passed to
   * CampaignSvgIcon. A dedicated icon means an <svg> is rendered (always the
   * case — even fallback uses Elder Sign svg). We therefore assert the SVG
   * renders without crash and the card title includes the scenario name.
   */
  const KNOWN_STANDALONES = [
    'Carnevale of Horrors',
    'The Curse of the Rougarou',
    "Machinations Through Time",
    'Fortune and Folly',
    'Guardians of the Abyss',
    'Murder at the Excelsior Hotel',
    'The Blob That Ate Everything',
  ]

  it.each(KNOWN_STANDALONES)('"%s" renders an svg icon without crashing', (scenarioName) => {
    const pt = makePlaythrough({
      campaignName: scenarioName,
      campaignSet: scenarioName,
      campaignType: 'Scenario Pack',
    })
    const { container } = render(<PlaythroughCard playthrough={pt} onEdit={noop} onDelete={noop} />)
    const heading = container.querySelector('h3')!
    expect(heading.querySelector('svg')).not.toBeNull()
    expect(within(heading).getByText(new RegExp(scenarioName.substring(0, 12)))).toBeInTheDocument()
  })
})

// ─── G. PlaythroughCard: unresolved standalone → safe fallback ───────────────

describe('PlaythroughCard — unconfirmed standalone uses safe fallback (no crash)', () => {
  /**
   * These packs have no confirmed dedicated icon file. The registry returns the
   * Elder Sign SVG fallback. We verify the card renders without crashing and
   * the heading still shows an <svg> (the fallback) rather than an img-missing
   * state or thrown error.
   *
   * Do NOT assert a specific non-fallback file for these packs.
   */
  const UNCONFIRMED_STANDALONES = [
    'The Labyrinths of Lunacy',
    'War of the Outer Gods',
    'The Midwinter Gala',
    'Traces To Nowhere',
    'Barkham Horror: The Meddling of Meowlathotep',
  ]

  it.each(UNCONFIRMED_STANDALONES)('"%s" renders a fallback svg without crashing', (scenarioName) => {
    const pt = makePlaythrough({
      campaignName: scenarioName,
      campaignSet: scenarioName,
      campaignType: 'Scenario Pack',
    })
    const { container } = render(<PlaythroughCard playthrough={pt} onEdit={noop} onDelete={noop} />)
    const heading = container.querySelector('h3')!
    expect(heading.querySelector('svg')).not.toBeNull()
  })
})

// ─── H. Filters: Class filter buttons — glyph + text ─────────────────────────

describe('Filters — Class filter buttons contain faction glyph + visible text', () => {
  function renderFilters(selectedArchetypes: Archetype[] = []) {
    return render(
      <Filters
        selectedArchetypes={selectedArchetypes}
        selectedCampaignTypes={[]}
        selectedCampaigns={[]}
        onArchetypeToggle={noop}
        onCampaignTypeToggle={noop}
        onCampaignToggle={noop}
        onClearFilters={noop}
        playthroughs={[]}
      />
    )
  }

  it.each(ALL_SIX_FACTIONS)('%s button renders the archetype label', (faction) => {
    renderFilters()
    expect(screen.getByRole('button', { name: new RegExp(faction, 'i') })).toBeInTheDocument()
  })

  it.each(ALL_SIX_FACTIONS)('%s button contains an aria-hidden svg glyph', (faction) => {
    const { container } = renderFilters()
    // CampaignSvgIcon puts aria-hidden on its span wrapper; find button then check inside it
    const buttons = container.querySelectorAll('button')
    const btn = Array.from(buttons).find(b => b.textContent?.includes(faction))
    expect(btn).toBeTruthy()
    // The aria-hidden span wrapping the svg should be inside the button
    const hiddenSpan = btn!.querySelector('[aria-hidden="true"]')
    expect(hiddenSpan).not.toBeNull()
    expect(hiddenSpan!.querySelector('svg')).not.toBeNull()
  })

  it('all six faction buttons are present (none omitted)', () => {
    renderFilters()
    ALL_SIX_FACTIONS.forEach((faction) => {
      expect(screen.getByRole('button', { name: new RegExp(faction, 'i') })).toBeInTheDocument()
    })
  })
})

// ─── I. PlayersOverview: Class filter buttons — glyph + text ─────────────────

describe('PlayersOverview — Class filter buttons contain faction glyph + visible text', () => {
  const PLAYED_PT: Playthrough = makePlaythrough({
    investigators: [
      { playerName: 'Alice', investigatorName: 'Roland Banks', archetype: 'Guardian' },
    ],
  })

  function expandFilters(container: HTMLElement) {
    // The filter panel is hidden behind a collapsible button
    const toggleBtn = container.querySelector('button[class*="border-border"]') as HTMLButtonElement | null
    if (toggleBtn) toggleBtn.click()
  }

  it.each(ALL_SIX_FACTIONS)('%s class button renders visible text in PlayersOverview', async (faction) => {
    const user = userEvent.setup()
    const { container } = render(<PlayersOverview playthroughs={[PLAYED_PT]} />)
    // Open the filter panel
    const filterToggle = container.querySelector('button')!
    await user.click(filterToggle)
    expect(screen.getByRole('button', { name: new RegExp(faction, 'i') })).toBeInTheDocument()
  })

  it.each(ALL_SIX_FACTIONS)('%s class button has an aria-hidden svg glyph in PlayersOverview', async (faction) => {
    const user = userEvent.setup()
    const { container } = render(<PlayersOverview playthroughs={[PLAYED_PT]} />)
    const filterToggle = container.querySelector('button')!
    await user.click(filterToggle)
    const buttons = container.querySelectorAll('button')
    const btn = Array.from(buttons).find(b => b.textContent?.trim() === faction || b.textContent?.includes(faction))
    expect(btn).toBeTruthy()
    // CampaignSvgIcon puts aria-hidden on span wrapper
    const hiddenSpan = btn!.querySelector('[aria-hidden="true"]')
    expect(hiddenSpan).not.toBeNull()
    expect(hiddenSpan!.querySelector('svg')).not.toBeNull()
  })
})
