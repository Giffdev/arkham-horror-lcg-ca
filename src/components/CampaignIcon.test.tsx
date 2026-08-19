/**
 * CampaignIcon — dispatcher/mapping contract tests
 *
 * Tests `getCampaignIcon` and `CampaignIcon` against every canonical campaign
 * set identifier used in campaign-data.ts. Avoids brittle raw-SVG path
 * assertions; uses React component reference identity (which icon is returned)
 * and crash-free rendering as the stable semantic contract.
 *
 * Fallback: any unrecognised set string must return the Ghost icon, not crash.
 */
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  Star, Ghost, Skull, Eye, Snowflake, Buildings, Compass, Key,
  Grains, Waves, Church, Moon, Mountains, Cat,
} from '@phosphor-icons/react'
import { getCampaignIcon, CampaignIcon } from './CampaignIcon'
import { ALL_CAMPAIGNS } from '@/lib/campaign-data'

// ─── getCampaignIcon — canonical mappings ─────────────────────────────────────

describe('getCampaignIcon — canonical set → icon component mapping', () => {
  it('Core → Star', () => {
    expect(getCampaignIcon('Core')).toBe(Star)
  })

  it('Core 2026 → Star (Chapter 2 core set)', () => {
    expect(getCampaignIcon('Core 2026')).toBe(Star)
  })

  it('The Dunwich Legacy → Buildings', () => {
    expect(getCampaignIcon('The Dunwich Legacy')).toBe(Buildings)
  })

  it('Return to The Dunwich Legacy → Buildings (returnTo inherits set icon)', () => {
    expect(getCampaignIcon('Return to The Dunwich Legacy')).toBe(Buildings)
  })

  it('The Path to Carcosa → Moon', () => {
    expect(getCampaignIcon('The Path to Carcosa')).toBe(Moon)
  })

  it('Return to The Path to Carcosa → Moon', () => {
    expect(getCampaignIcon('Return to The Path to Carcosa')).toBe(Moon)
  })

  it('The Forgotten Age → Mountains', () => {
    expect(getCampaignIcon('The Forgotten Age')).toBe(Mountains)
  })

  it('Return to The Forgotten Age → Mountains', () => {
    expect(getCampaignIcon('Return to The Forgotten Age')).toBe(Mountains)
  })

  it('The Circle Undone → Church', () => {
    expect(getCampaignIcon('The Circle Undone')).toBe(Church)
  })

  it('Return to The Circle Undone → Church', () => {
    expect(getCampaignIcon('Return to The Circle Undone')).toBe(Church)
  })

  it('The Dream-Eaters → Eye', () => {
    expect(getCampaignIcon('The Dream-Eaters')).toBe(Eye)
  })

  it('The Innsmouth Conspiracy → Waves', () => {
    expect(getCampaignIcon('The Innsmouth Conspiracy')).toBe(Waves)
  })

  it('Edge of the Earth → Snowflake', () => {
    expect(getCampaignIcon('Edge of the Earth')).toBe(Snowflake)
  })

  it('The Scarlet Keys → Key', () => {
    expect(getCampaignIcon('The Scarlet Keys')).toBe(Key)
  })

  it('The Feast of Hemlock Vale → Grains', () => {
    expect(getCampaignIcon('The Feast of Hemlock Vale')).toBe(Grains)
  })

  it('The Drowned City → Compass', () => {
    expect(getCampaignIcon('The Drowned City')).toBe(Compass)
  })

  it('Barkham Horror → Cat', () => {
    expect(getCampaignIcon('Barkham Horror')).toBe(Cat)
  })

  it('"standalone" substring trigger → Skull', () => {
    // Standalone Scenario Pack sets containing the word "standalone"
    expect(getCampaignIcon('standalone')).toBe(Skull)
    expect(getCampaignIcon('Standalone Scenario')).toBe(Skull)
  })
})

// ─── getCampaignIcon — fallback contract ─────────────────────────────────────

describe('getCampaignIcon — fallback for unmapped identifiers', () => {
  it('returns Ghost for a completely unknown string', () => {
    expect(getCampaignIcon('Unknown Campaign Set')).toBe(Ghost)
  })

  it('returns Ghost for an empty string', () => {
    expect(getCampaignIcon('')).toBe(Ghost)
  })

  it('returns Ghost for "Scenario Pack" (no keyword match)', () => {
    expect(getCampaignIcon('Scenario Pack')).toBe(Ghost)
  })

  it('returns Ghost for "Children of Blood" (no keyword match)', () => {
    expect(getCampaignIcon('Children of Blood')).toBe(Ghost)
  })

  it('returns Ghost for "Return to The Night of the Zealot" (no keyword match)', () => {
    expect(getCampaignIcon('Return to The Night of the Zealot')).toBe(Ghost)
  })

  it('two different unmapped strings both return the same fallback component', () => {
    const a = getCampaignIcon('Totally Unknown A')
    const b = getCampaignIcon('Totally Unknown B')
    expect(a).toBe(b)
    expect(a).toBe(Ghost)
  })
})

// ─── getCampaignIcon — determinism & non-null contract ───────────────────────

describe('getCampaignIcon — returns a valid React component for every canonical set', () => {
  it('returns a valid React component for every campaign set in campaign-data', () => {
    // Phosphor icons are React.forwardRef wrappers — typeof is 'object', not 'function'.
    // We assert truthy (not null/undefined) and renderable (covered by crash-free tests).
    const uniqueSets = Array.from(new Set(ALL_CAMPAIGNS.map(c => c.set)))
    for (const set of uniqueSets) {
      const icon = getCampaignIcon(set)
      expect(icon).toBeTruthy()
    }
  })

  it('is idempotent: same input always returns the same component reference', () => {
    const sets = ['Core', 'Edge of the Earth', 'Scenario Pack', '']
    for (const set of sets) {
      expect(getCampaignIcon(set)).toBe(getCampaignIcon(set))
    }
  })
})

// ─── CampaignIcon component — crash-free rendering ───────────────────────────

describe('CampaignIcon component — renders without crashing', () => {
  const canonicalSets = Array.from(new Set(ALL_CAMPAIGNS.map(c => c.set)))

  for (const set of canonicalSets) {
    it(`renders for campaignSet="${set}"`, () => {
      expect(() => render(<CampaignIcon campaignSet={set} />)).not.toThrow()
    })
  }

  it('renders for an unknown/unmapped campaignSet without crashing', () => {
    expect(() => render(<CampaignIcon campaignSet="Completely Unknown" />)).not.toThrow()
  })

  it('accepts custom size and weight props without crashing', () => {
    expect(() =>
      render(<CampaignIcon campaignSet="Core" size={24} weight="bold" className="text-primary" />),
    ).not.toThrow()
  })
})
