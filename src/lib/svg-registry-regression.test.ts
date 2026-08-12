/**
 * SVG Registry — Regression Tests
 *
 * Lambert — Tester | 2026-08-11
 *
 * Covers the specific regressions and contracts called out in the task spec.
 * Tests compare file *identity* (which asset the registry resolves to) without
 * asserting brittle path-data snapshots: the raw SVG files are imported as the
 * stable reference and compared to registry output after the same normalisation.
 *
 * Tests marked "[EXPECTED FAIL — pending Dallas]" will fail until the
 * registry is extended. That is intentional: they document the desired state.
 *
 * Production owner: Dallas (Frontend Dev)
 * Do NOT edit campaign-icon-map.ts from this file.
 *
 * ── Registry API (Dallas, 2026-08-11) ─────────────────────────────────────────
 *  getCampaignSvgRaw(setOrName)                 → campaign or standalone icon, else Elder Sign
 *  getStandaloneSvgRaw(scenarioName)             → standalone icon, else Elder Sign
 *  getStarterInvestigatorSvgRaw(investigatorName) → starter deck icon, else Elder Sign
 *  getBrandSvgRaw(key: 'codex' | 'log')          → site-identity / campaign-log icon
 *  hasDedicatedCampaignIcon(set)                 → true only for CAMPAIGN_ICONS map
 */

import { describe, it, expect } from 'vitest'
import {
  getCampaignSvgRaw,
  getStandaloneSvgRaw,
  getStarterInvestigatorSvgRaw,
  getBrandSvgRaw,
  getFactionSvgRaw,
  hasDedicatedCampaignIcon,
  CAMPAIGN_ICON_SETS,
} from './campaign-icon-map'

// ─── raw SVG asset imports ────────────────────────────────────────────────────
// User-confirmed authoritative file names per task spec.
// (short token file names: tskc, fhvc, tdcc, tic, set, rtnotz, rttcu)

import edgeRaw            from '@/components/icons/edge.svg?raw'
import eoeCampaignRaw     from '@/components/icons/eoe_campaign.svg?raw'
import setRaw             from '@/components/icons/set.svg?raw'
import returnDunwichRaw   from '@/components/icons/return_to_the_dunwich_legacy.svg?raw'
import carcosaRaw         from '@/components/icons/carcosa.svg?raw'
import returnCarcosaRaw   from '@/components/icons/return_to_the_path_to_carcosa.svg?raw'
import forgottenRaw       from '@/components/icons/the_forgotten_age.svg?raw'
import returnForgottenRaw from '@/components/icons/return_to_the_forgotten_age.svg?raw'
import rttcuRaw           from '@/components/icons/rttcu.svg?raw'
import rtnotzRaw          from '@/components/icons/rtnotz.svg?raw'
import tskcRaw            from '@/components/icons/tskc.svg?raw'
import fhvcRaw            from '@/components/icons/fhvc.svg?raw'
import tdccRaw            from '@/components/icons/tdcc.svg?raw'
import ticRaw             from '@/components/icons/tic.svg?raw'
import barkhamRaw         from '@/components/icons/barkham_horror.svg?raw'
import core2026Raw        from '@/components/icons/core_2026.svg?raw'
import veniceRaw          from '@/components/icons/standalone-venice.svg?raw'
import rougarouRaw        from '@/components/icons/curse_of_the_rougarou.svg?raw'
import filmFataleRaw      from '@/components/icons/film_fatale.svg?raw'
import fortuneFollyRaw    from '@/components/icons/fortune_and_folly.svg?raw'
import guardiansRaw       from '@/components/icons/guardians.svg?raw'
import murderRaw          from '@/components/icons/murder_at_the_excelsior_hotel.svg?raw'
import blobRaw            from '@/components/icons/blob_set.svg?raw'
import mttRaw             from '@/components/icons/mtt.svg?raw'
import nateRaw            from '@/components/icons/nate.svg?raw'
import harveyRaw          from '@/components/icons/harvey.svg?raw'
import winifredRaw        from '@/components/icons/winifred.svg?raw'
import jacquelineRaw      from '@/components/icons/jacqueline.svg?raw'
import stellaRaw          from '@/components/icons/stella.svg?raw'
import codexRaw           from '@/components/icons/codex.svg?raw'
import logRaw             from '@/components/icons/log.svg?raw'
// Faction SVG assets (verified file names per user spec)
import guardianRaw        from '@/components/icons/guardian.svg?raw'
import seekerRaw          from '@/components/icons/seeker.svg?raw'
import rogueRaw           from '@/components/icons/rogue.svg?raw'
import mysticRaw          from '@/components/icons/mystic.svg?raw'
import survivorRaw        from '@/components/icons/survivor.svg?raw'
import neutralRaw         from '@/components/icons/neutral.svg?raw'
import galaRaw            from '@/components/icons/gala.svg?raw'
import lolRaw             from '@/components/icons/lol.svg?raw'

// ─── local normalise — mirrors campaign-icon-map.ts private normalise() ───────
// IMPORTANT: Keep in sync with the production function.
// Updated 2026-08-12 (hotfix/neutral-icon-contrast): also strips embedded
// <style> blocks and orphaned class="..." attributes on non-<svg> elements so
// that SVGs with Illustrator-generated class-based fills (e.g. neutral.svg's
// `.st0{fill:#020203;}`) fully honour currentColor.
function normalise(raw: string): string {
  return raw
    .replace(/<\?xml[^?]*\?>\s*/g, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/\sfill="[^"]*"/g, '')
    .replace(/(<(?!svg\b)[a-zA-Z][^>]*?)\sclass="[^"]*"/g, '$1')
    .replace(/<svg\b/, '<svg fill="currentColor"')
}

// ─── 1. Edge of the Earth — critical file-identity regression ─────────────────
// HISTORY: EoE was incorrectly mapped to edge.svg (non-campaign asset).
// Correct file: eoe_campaign.svg.

describe('Edge of the Earth — file-identity regression (eoe_campaign, not edge.svg)', () => {
  it('resolves to the eoe_campaign.svg asset', () => {
    expect(getCampaignSvgRaw('Edge of the Earth')).toBe(normalise(eoeCampaignRaw))
  })

  it('does NOT resolve to edge.svg (non-campaign asset)', () => {
    expect(getCampaignSvgRaw('Edge of the Earth')).not.toBe(normalise(edgeRaw))
  })

  it('hasDedicatedCampaignIcon is true for Edge of the Earth', () => {
    expect(hasDedicatedCampaignIcon('Edge of the Earth')).toBe(true)
  })
})

// ─── 2. User-confirmed campaign file contracts ────────────────────────────────
// Short-token asset names per user spec (tskc, fhvc, tdcc, tic, set).

describe('User-confirmed campaign SVG file contracts', () => {
  it('The Scarlet Keys (tskc) uses tskc.svg', () => {
    expect(getCampaignSvgRaw('The Scarlet Keys')).toBe(normalise(tskcRaw))
  })

  it('The Feast of Hemlock Vale (fhvc) uses fhvc.svg', () => {
    expect(getCampaignSvgRaw('The Feast of Hemlock Vale')).toBe(normalise(fhvcRaw))
  })

  it('The Drowned City (tdcc) uses tdcc.svg', () => {
    expect(getCampaignSvgRaw('The Drowned City')).toBe(normalise(tdccRaw))
  })

  it('The Dunwich Legacy (set) uses set.svg (campaign set icon)', () => {
    expect(getCampaignSvgRaw('The Dunwich Legacy')).toBe(normalise(setRaw))
  })

  it('The Innsmouth Conspiracy (tic) uses tic.svg', () => {
    expect(getCampaignSvgRaw('The Innsmouth Conspiracy')).toBe(normalise(ticRaw))
  })

  it('Barkham Horror uses barkham_horror.svg', () => {
    expect(getCampaignSvgRaw('Barkham Horror')).toBe(normalise(barkhamRaw))
  })

  it('Brethren of Ash uses core_2026.svg (shares Core 2026 identity)', () => {
    expect(getCampaignSvgRaw('Brethren of Ash')).toBe(normalise(core2026Raw))
  })
})

// ─── 3. Return-to mappings — dedicated files used where they exist ────────────

describe('Return-to mappings — dedicated file usage', () => {
  it('Return to The Dunwich Legacy uses return_to_the_dunwich_legacy.svg (not set.svg)', () => {
    const result = getCampaignSvgRaw('Return to The Dunwich Legacy')
    expect(result).toBe(normalise(returnDunwichRaw))
    expect(result).not.toBe(normalise(setRaw))
  })

  it('Return to The Path to Carcosa uses return_to_the_path_to_carcosa.svg (not carcosa.svg)', () => {
    const result = getCampaignSvgRaw('Return to The Path to Carcosa')
    expect(result).toBe(normalise(returnCarcosaRaw))
    expect(result).not.toBe(normalise(carcosaRaw))
  })

  it('Return to The Forgotten Age uses return_to_the_forgotten_age.svg (not the_forgotten_age.svg)', () => {
    const result = getCampaignSvgRaw('Return to The Forgotten Age')
    expect(result).toBe(normalise(returnForgottenRaw))
    expect(result).not.toBe(normalise(forgottenRaw))
  })

  it('Return to The Night of the Zealot (rtnotz) uses dedicated rtnotz.svg', () => {
    expect(hasDedicatedCampaignIcon('Return to The Night of the Zealot')).toBe(true)
    expect(getCampaignSvgRaw('Return to The Night of the Zealot')).toBe(normalise(rtnotzRaw))
  })

  it('Return to The Circle Undone (rttcu) uses dedicated rttcu.svg', () => {
    expect(hasDedicatedCampaignIcon('Return to The Circle Undone')).toBe(true)
    expect(getCampaignSvgRaw('Return to The Circle Undone')).toBe(normalise(rttcuRaw))
  })
})

// ─── 4. Generic registry contract ────────────────────────────────────────────

describe('Registry contract — non-empty valid SVG for every registered key', () => {
  it('all entries in CAMPAIGN_ICON_SETS return a non-empty SVG string', () => {
    for (const set of CAMPAIGN_ICON_SETS) {
      const result = getCampaignSvgRaw(set)
      expect(result, `set "${set}" must return a non-empty string`).toBeTruthy()
      expect(result.trimStart(), `set "${set}" must start with <svg`).toMatch(/^<svg\b/)
      expect(result, `set "${set}" must contain fill="currentColor"`).toContain('fill="currentColor"')
    }
  })

  it('unknown value falls back to a safe generic SVG (Elder Sign), not null or empty', () => {
    const fallback = getCampaignSvgRaw('This Campaign Does Not Exist')
    expect(fallback.trimStart()).toMatch(/^<svg\b/)
    expect(fallback).toContain('fill="currentColor"')
  })

  it('fallback is consistent — two different unknown keys return the same SVG', () => {
    expect(getCampaignSvgRaw('Unknown A')).toBe(getCampaignSvgRaw('Unknown B'))
  })

  it('hasDedicatedCampaignIcon returns false for unknown values', () => {
    expect(hasDedicatedCampaignIcon('Unknown Campaign')).toBe(false)
    expect(hasDedicatedCampaignIcon('')).toBe(false)
  })
})

// ─── 5. Standalone scenario entries ──────────────────────────────────────────
// Dallas added STANDALONE_ICONS + getStandaloneSvgRaw().
// getCampaignSvgRaw falls through to STANDALONE_ICONS.
// Key 'Carnevale of Horrors' = Venice (standalone-venice.svg).

describe('Standalone scenario — dedicated icon entries', () => {
  const STANDALONE_ENTRIES = [
    { name: 'Carnevale of Horrors',          raw: veniceRaw },
    { name: 'Curse of the Rougarou',         raw: rougarouRaw },
    { name: 'Film Fatale',                   raw: filmFataleRaw },
    { name: 'Fortune and Folly',             raw: fortuneFollyRaw },
    { name: 'Guardians of the Abyss',        raw: guardiansRaw },
    { name: 'Murder at the Excelsior Hotel', raw: murderRaw },
    { name: 'The Blob That Ate Everything',  raw: blobRaw },
    { name: 'Machinations Through Time',     raw: mttRaw },
  ]

  for (const { name, raw } of STANDALONE_ENTRIES) {
    it(`getStandaloneSvgRaw("${name}") returns the dedicated asset`, () => {
      expect(getStandaloneSvgRaw(name)).toBe(normalise(raw))
    })

    it(`getCampaignSvgRaw("${name}") falls through to the standalone asset (not Elder Sign)`, () => {
      const elderSign = getCampaignSvgRaw('__unknown__')
      expect(getCampaignSvgRaw(name)).not.toBe(elderSign)
    })
  }

  it('getStandaloneSvgRaw falls back to Elder Sign for an unknown scenario', () => {
    const fallback = getStandaloneSvgRaw('Unknown Standalone')
    expect(fallback.trimStart()).toMatch(/^<svg\b/)
    expect(fallback).toBe(getCampaignSvgRaw('__unknown__'))
  })
})

// ─── 6. Starter investigator deck icons ───────────────────────────────────────
// Keys are SHORT NAMES per registry API (nate, harvey, winifred, jacqueline, stella).
// The user-spec canonical names are: Nathaniel Cho, Harvey Walters, Winifred Habbamock,
// Jacqueline Fine, Stella Clark — but the registry uses the short-form keys.

describe('Starter investigator deck icons (getStarterInvestigatorSvgRaw)', () => {
  const STARTER_ENTRIES = [
    { key: 'nate',       raw: nateRaw },
    { key: 'harvey',     raw: harveyRaw },
    { key: 'winifred',   raw: winifredRaw },
    { key: 'jacqueline', raw: jacquelineRaw },
    { key: 'stella',     raw: stellaRaw },
  ]

  for (const { key, raw } of STARTER_ENTRIES) {
    it(`getStarterInvestigatorSvgRaw("${key}") returns the correct asset`, () => {
      const result = getStarterInvestigatorSvgRaw(key)
      expect(result).toBe(normalise(raw))
      // SVG must be present somewhere in the output (some files have XML declaration preamble)
      expect(result).toMatch(/<svg\b/)
    })
  }

  it('returns Elder Sign fallback for unknown short keys', () => {
    const fallback = getStarterInvestigatorSvgRaw('unknown-key')
    expect(fallback).toMatch(/<svg\b/)
    expect(fallback).toBe(getCampaignSvgRaw('__unknown__'))
  })
})

// ─── 7. Brand / identity icons — codex and log ───────────────────────────────

describe('Brand icons — getBrandSvgRaw (codex = site identity; log = campaign-log)', () => {
  it('getBrandSvgRaw("codex") returns the codex.svg asset', () => {
    expect(getBrandSvgRaw('codex')).toBe(normalise(codexRaw))
  })

  it('getBrandSvgRaw("log") returns the log.svg asset', () => {
    expect(getBrandSvgRaw('log')).toBe(normalise(logRaw))
  })

  it('both brand icons are valid SVGs with fill="currentColor"', () => {
    for (const key of ['codex', 'log'] as const) {
      const svg = getBrandSvgRaw(key)
      expect(svg.trimStart()).toMatch(/^<svg\b/)
      expect(svg).toContain('fill="currentColor"')
    }
  })

  it('codex and log return distinct SVGs', () => {
    expect(getBrandSvgRaw('codex')).not.toBe(getBrandSvgRaw('log'))
  })
})

// ─── 8. Faction icons — file-identity contracts ───────────────────────────────
// guardian/seeker/rogue/mystic/survivor/neutral: each verified SVG file is the
// authoritative source for that faction. Tests guard against the registry
// accidentally serving the wrong file or falling back to the Elder Sign.
//
// Note: neutral.svg has an XML declaration preamble (<?xml…>) before <svg>.
// Tests use `toMatch(/<svg\b/)` (contains) rather than `^<svg` (starts-with).

describe('Faction icons — getFactionSvgRaw file-identity contracts', () => {
  it('exports getFactionSvgRaw', () => {
    expect(typeof getFactionSvgRaw).toBe('function')
  })

  const FACTION_ENTRIES = [
    { name: 'Guardian', raw: guardianRaw, file: 'guardian.svg' },
    { name: 'Seeker',   raw: seekerRaw,   file: 'seeker.svg' },
    { name: 'Rogue',    raw: rogueRaw,    file: 'rogue.svg' },
    { name: 'Mystic',   raw: mysticRaw,   file: 'mystic.svg' },
    { name: 'Survivor', raw: survivorRaw, file: 'survivor.svg' },
    { name: 'Neutral',  raw: neutralRaw,  file: 'neutral.svg' },
  ]

  for (const { name, raw, file } of FACTION_ENTRIES) {
    it(`getFactionSvgRaw("${name}") uses ${file} (file-identity contract)`, () => {
      expect(getFactionSvgRaw(name)).toBe(normalise(raw))
    })

    it(`getFactionSvgRaw("${name}") returns a valid SVG (contains <svg)`, () => {
      expect(getFactionSvgRaw(name)).toMatch(/<svg\b/)
    })

    it(`getFactionSvgRaw("${name}") does not fall back to the Elder Sign`, () => {
      expect(getFactionSvgRaw(name)).not.toBe(getCampaignSvgRaw('__unknown__'))
    })
  }

  it('getCampaignSvgRaw resolves faction names via the unified ALL_ICONS lookup', () => {
    // getCampaignSvgRaw merges all namespaces — faction names must resolve correctly
    for (const { name, raw } of FACTION_ENTRIES) {
      expect(getCampaignSvgRaw(name)).toBe(normalise(raw))
    }
  })

  it('returns Elder Sign fallback for unknown faction names', () => {
    const fallback = getCampaignSvgRaw('__unknown__')
    expect(getFactionSvgRaw('Warlock')).toBe(fallback)
    expect(getFactionSvgRaw('')).toBe(fallback)
  })

  it('all six faction icons are distinct (no two factions share an asset)', () => {
    const results = FACTION_ENTRIES.map(({ name }) => getFactionSvgRaw(name))
    const unique = new Set(results)
    expect(unique.size).toBe(6)
  })
})

// ─── 9. Unresolved standalone packs — must stay on generic Elder Sign fallback ─
//
// Scenario packs in campaign-data.ts that have NO dedicated artwork file must
// return the Elder Sign for both getStandaloneSvgRaw() and getCampaignSvgRaw()
// when called with the scenario name directly.
//
// Unresolved packs (as of 2026-08-12):
//   War of the Outer Gods, Traces To Nowhere
//
// Resolved 2026-08-12 (hotfix/neutral-icon-contrast): The Midwinter Gala → gala.svg
// Resolved 2026-08-12 (hotfix/neutral-icon-contrast): The Labyrinths of Lunacy → lol.svg
// Resolved 2026-08-12 (hotfix/neutral-icon-contrast): Barkham Horror: The Meddling of
//   Meowlathotep → barkham_horror.svg (alias to canonical Barkham Horror entry)
//
// Do NOT require a Return to The Innsmouth Conspiracy campaign record — the
// production registry has a comment noting rttic.svg is available but the
// campaign-data entry does not exist yet.

describe('Unresolved standalone packs — generic Elder Sign fallback (no guessing)', () => {
  const ELDER_SIGN = getCampaignSvgRaw('__unknown__')

  const UNRESOLVED = [
    'War of the Outer Gods',
    'Traces To Nowhere',
  ]

  for (const name of UNRESOLVED) {
    it(`getStandaloneSvgRaw("${name}") returns the Elder Sign (not a guessed file)`, () => {
      expect(
        getStandaloneSvgRaw(name),
        `"${name}" has no dedicated artwork — must return Elder Sign, not a guessed asset`,
      ).toBe(ELDER_SIGN)
    })

    it(`getCampaignSvgRaw("${name}") also returns the Elder Sign (scenario name not in any map)`, () => {
      expect(
        getCampaignSvgRaw(name),
        `"${name}" must not be silently assigned any campaign/standalone asset`,
      ).toBe(ELDER_SIGN)
    })
  }

  it('Return to The Innsmouth Conspiracy is not in CAMPAIGN_ICONS (no campaign record exists)', () => {
    // rttic.svg asset exists but no campaign-data record — hasDedicatedCampaignIcon must be false
    expect(hasDedicatedCampaignIcon('Return to The Innsmouth Conspiracy')).toBe(false)
    // Falling through the registry returns the Elder Sign
    expect(getCampaignSvgRaw('Return to The Innsmouth Conspiracy')).toBe(ELDER_SIGN)
  })
})

// ─── 10. The Midwinter Gala — confirmed file-identity (gala.svg) ──────────────
// User confirmed 2026-08-12: The Midwinter Gala maps to gala.svg.
// Migrated from UNRESOLVED list. Verified via getStandaloneSvgRaw and
// the unified getCampaignSvgRaw lookup so PlaythroughCard resolves correctly.

describe('The Midwinter Gala — confirmed standalone icon (gala.svg)', () => {
  it('getStandaloneSvgRaw("The Midwinter Gala") uses gala.svg (file-identity contract)', () => {
    expect(getStandaloneSvgRaw('The Midwinter Gala')).toBe(normalise(galaRaw))
  })

  it('getCampaignSvgRaw("The Midwinter Gala") resolves via unified lookup (not Elder Sign)', () => {
    const elderSign = getCampaignSvgRaw('__unknown__')
    expect(getCampaignSvgRaw('The Midwinter Gala')).not.toBe(elderSign)
    expect(getCampaignSvgRaw('The Midwinter Gala')).toBe(normalise(galaRaw))
  })

  it('getStandaloneSvgRaw("The Midwinter Gala") returns a valid normalised SVG', () => {
    const svg = getStandaloneSvgRaw('The Midwinter Gala')
    expect(svg.trimStart()).toMatch(/^<svg\b/)
    expect(svg).toContain('fill="currentColor"')
    expect(svg).not.toMatch(/<style\b/i)
  })
})

// ─── 11. The Labyrinths of Lunacy — confirmed file-identity (lol.svg) ─────────
// User confirmed 2026-08-12: The Labyrinths of Lunacy maps to lol.svg.
// Migrated from UNRESOLVED list. Verified via getStandaloneSvgRaw and
// the unified getCampaignSvgRaw lookup so PlaythroughCard resolves correctly.

describe('The Labyrinths of Lunacy — confirmed standalone icon (lol.svg)', () => {
  it('getStandaloneSvgRaw("The Labyrinths of Lunacy") uses lol.svg (file-identity contract)', () => {
    expect(getStandaloneSvgRaw('The Labyrinths of Lunacy')).toBe(normalise(lolRaw))
  })

  it('getCampaignSvgRaw("The Labyrinths of Lunacy") resolves via unified lookup (not Elder Sign)', () => {
    const elderSign = getCampaignSvgRaw('__unknown__')
    expect(getCampaignSvgRaw('The Labyrinths of Lunacy')).not.toBe(elderSign)
    expect(getCampaignSvgRaw('The Labyrinths of Lunacy')).toBe(normalise(lolRaw))
  })

  it('getStandaloneSvgRaw("The Labyrinths of Lunacy") returns a valid normalised SVG', () => {
    const svg = getStandaloneSvgRaw('The Labyrinths of Lunacy')
    expect(svg.trimStart()).toMatch(/^<svg\b/)
    expect(svg).toContain('fill="currentColor"')
    expect(svg).not.toMatch(/<style\b/i)
  })
})

// ─── 12. Barkham Horror: The Meddling of Meowlathotep — alias to barkham_horror.svg ──
// User confirmed 2026-08-12: the standalone scenario "Barkham Horror: The Meddling
// of Meowlathotep" uses the same artwork as the canonical "Barkham Horror" campaign
// entry. The asset is NOT duplicated — STANDALONE_ICONS maps the full scenario name
// to the same normalise(barkhamRaw) value already used by CAMPAIGN_ICONS.
// Migrated from UNRESOLVED list.

describe('Barkham Horror: The Meddling of Meowlathotep — confirmed icon alias (barkham_horror.svg)', () => {
  const FULL_NAME = 'Barkham Horror: The Meddling of Meowlathotep'

  it('getStandaloneSvgRaw uses barkham_horror.svg (file-identity contract)', () => {
    expect(getStandaloneSvgRaw(FULL_NAME)).toBe(normalise(barkhamRaw))
  })

  it('getCampaignSvgRaw resolves via unified lookup (not Elder Sign fallback)', () => {
    const elderSign = getCampaignSvgRaw('__unknown__')
    expect(getCampaignSvgRaw(FULL_NAME)).not.toBe(elderSign)
    expect(getCampaignSvgRaw(FULL_NAME)).toBe(normalise(barkhamRaw))
  })

  it('asset is the same normalised value as canonical Barkham Horror entry (no file duplication)', () => {
    expect(getCampaignSvgRaw(FULL_NAME)).toBe(getCampaignSvgRaw('Barkham Horror'))
  })

  it('returns a valid normalised SVG (no <style> block, has fill="currentColor")', () => {
    const svg = getStandaloneSvgRaw(FULL_NAME)
    expect(svg.trimStart()).toMatch(/^<svg\b/)
    expect(svg).toContain('fill="currentColor"')
    expect(svg).not.toMatch(/<style\b/i)
  })
})
