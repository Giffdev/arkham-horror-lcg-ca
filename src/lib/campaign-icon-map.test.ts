/**
 * campaign-icon-map contract tests
 *
 * Validates the mapping and normalisation layer without asserting any
 * SVG path data. Tests treat SVG content as opaque strings and only
 * check structural / contract properties.
 *
 * File owner: Dallas (Frontend Dev)
 * Lambert does not own this file — no coordination needed.
 */
import { describe, expect, it } from 'vitest'
import {
  getCampaignSvgRaw,
  getFactionSvgRaw,
  hasDedicatedCampaignIcon,
  CAMPAIGN_ICON_SETS,
} from './campaign-icon-map'

// Canonical set strings taken directly from src/lib/campaign-data.ts
const KNOWN_SETS = [
  'Core',
  'The Dunwich Legacy',
  'Return to The Dunwich Legacy',
  'The Path to Carcosa',
  'Return to The Path to Carcosa',
  'The Forgotten Age',
  'Return to The Forgotten Age',
  'The Circle Undone',
  'Return to The Circle Undone',
  'The Dream-Eaters',
  'The Innsmouth Conspiracy',
  'Edge of the Earth',
  'The Scarlet Keys',
  'The Feast of Hemlock Vale',
  'The Drowned City',
  'Barkham Horror',
  'Core 2026',
  'Children of Blood',
  'Brethren of Ash',
  'Return to The Night of the Zealot',
  'Scenario Pack',
  'Standalone',
] as const

describe('getCampaignSvgRaw', () => {
  it('returns a non-empty string for every known set', () => {
    for (const set of KNOWN_SETS) {
      const result = getCampaignSvgRaw(set)
      expect(result, `set "${set}" should return a non-empty string`).toBeTruthy()
      expect(typeof result).toBe('string')
    }
  })

  it('all returned SVGs start with an <svg element', () => {
    for (const set of KNOWN_SETS) {
      const result = getCampaignSvgRaw(set)
      expect(result.trimStart(), `set "${set}" SVG must start with <svg`).toMatch(/^<svg\b/)
    }
  })

  it('all returned SVGs carry fill="currentColor" for theme integration', () => {
    for (const set of KNOWN_SETS) {
      const result = getCampaignSvgRaw(set)
      expect(result, `set "${set}" SVG must contain fill="currentColor"`).toContain(
        'fill="currentColor"',
      )
    }
  })

  it('returns the Elder Sign fallback (non-empty SVG) for an unknown set', () => {
    const result = getCampaignSvgRaw('Unknown Set That Does Not Exist')
    expect(result).toBeTruthy()
    expect(result.trimStart()).toMatch(/^<svg\b/)
    expect(result).toContain('fill="currentColor"')
  })

  it('returns the same fallback SVG for two different unknown sets', () => {
    const a = getCampaignSvgRaw('Totally Unknown A')
    const b = getCampaignSvgRaw('Totally Unknown B')
    expect(a).toBe(b)
  })

  it('returns distinct SVGs for distinct known sets', () => {
    const core = getCampaignSvgRaw('Core')
    const dunwich = getCampaignSvgRaw('The Dunwich Legacy')
    expect(core).not.toBe(dunwich)
  })
})

describe('hasDedicatedCampaignIcon', () => {
  it('returns true for every entry in KNOWN_SETS', () => {
    for (const set of KNOWN_SETS) {
      expect(hasDedicatedCampaignIcon(set), `"${set}" should have a dedicated icon`).toBe(true)
    }
  })

  it('returns false for unknown sets', () => {
    expect(hasDedicatedCampaignIcon('Fan-Made')).toBe(false)
    expect(hasDedicatedCampaignIcon('')).toBe(false)
    expect(hasDedicatedCampaignIcon('Unknown Campaign')).toBe(false)
  })
})

describe('CAMPAIGN_ICON_SETS', () => {
  it('is a non-empty array of strings', () => {
    expect(Array.isArray(CAMPAIGN_ICON_SETS)).toBe(true)
    expect(CAMPAIGN_ICON_SETS.length).toBeGreaterThan(0)
    for (const s of CAMPAIGN_ICON_SETS) {
      expect(typeof s).toBe('string')
    }
  })

  it('contains all expected canonical campaign sets', () => {
    for (const set of KNOWN_SETS) {
      expect(CAMPAIGN_ICON_SETS).toContain(set)
    }
  })
})

// ── Regression: Neutral icon contrast (hotfix/neutral-icon-contrast) ──────────
// Before the fix, neutral.svg contained a <style> block with `.st0{fill:#020203;}`
// that overrode currentColor, rendering the icon black on dark backgrounds.
describe('Neutral faction icon SVG normalisation (regression)', () => {
  it('Neutral SVG contains no embedded <style> block', () => {
    const svg = getFactionSvgRaw('Neutral')
    expect(svg).not.toMatch(/<style\b/i)
  })

  it('Neutral SVG contains no hardcoded black fill colour (#020203)', () => {
    const svg = getFactionSvgRaw('Neutral')
    expect(svg).not.toContain('#020203')
    expect(svg).not.toContain('020203')
  })

  it('Neutral SVG carries fill="currentColor" on the root <svg> element', () => {
    const svg = getFactionSvgRaw('Neutral')
    expect(svg).toContain('fill="currentColor"')
    // Must be on the opening <svg tag, not a child element
    expect(svg).toMatch(/<svg[^>]*fill="currentColor"/)
  })

  it('Neutral SVG carries no other fill="..." overrides', () => {
    const svg = getFactionSvgRaw('Neutral')
    // Only one fill attribute allowed: the currentColor on <svg>
    const fillMatches = svg.match(/\bfill="/g) ?? []
    expect(fillMatches.length).toBe(1)
  })

  it('all faction SVGs are free of embedded <style> blocks', () => {
    const factions = ['Guardian', 'Seeker', 'Rogue', 'Mystic', 'Survivor', 'Neutral']
    for (const faction of factions) {
      const svg = getFactionSvgRaw(faction)
      expect(svg, `${faction} SVG must not contain a <style> block`).not.toMatch(/<style\b/i)
    }
  })

  it('all faction SVGs carry fill="currentColor" on the root <svg>', () => {
    const factions = ['Guardian', 'Seeker', 'Rogue', 'Mystic', 'Survivor', 'Neutral']
    for (const faction of factions) {
      const svg = getFactionSvgRaw(faction)
      expect(svg, `${faction} SVG must carry fill="currentColor"`).toMatch(
        /<svg[^>]*fill="currentColor"/,
      )
    }
  })
})
