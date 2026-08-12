/**
 * Asset registry — single source of truth for all SVG icons.
 *
 * Namespaces (all merged into one flat lookup for consistent API):
 *  - Campaign icons: keyed by canonical `set` from campaign-data.ts
 *  - Standalone scenario icons: keyed by campaign name
 *  - Starter investigator deck icons: keyed by short-name key (nate, harvey, …)
 *  - Faction icons: keyed by faction name (Guardian, Seeker, …)
 *  - UI brand icons: keyed by role (codex, log)
 *
 * All SVG assets are static build-time imports via Vite `?raw`.
 * dangerouslySetInnerHTML with these imports is safe — no user-controlled content.
 * Each SVG is normalised to `fill="currentColor"` for Tailwind text-* theming.
 */

// ── Campaign icons ────────────────────────────────────────────────────────────
import coreRaw from '@/components/icons/core.svg?raw'
import rtnotzRaw from '@/components/icons/rtnotz.svg?raw'
import core2026Raw from '@/components/icons/core_2026.svg?raw'
import setRaw from '@/components/icons/set.svg?raw'
import returnDunwichRaw from '@/components/icons/return_to_the_dunwich_legacy.svg?raw'
import carcosaRaw from '@/components/icons/carcosa.svg?raw'
import returnCarcosaRaw from '@/components/icons/return_to_the_path_to_carcosa.svg?raw'
import forgottenAgeRaw from '@/components/icons/the_forgotten_age.svg?raw'
import returnForgottenAgeRaw from '@/components/icons/return_to_the_forgotten_age.svg?raw'
import circleUndoneRaw from '@/components/icons/the_circle_undone.svg?raw'
import rttcuRaw from '@/components/icons/rttcu.svg?raw'
import dreamEatersRaw from '@/components/icons/dream.svg?raw'
import ticRaw from '@/components/icons/tic.svg?raw'
import eoeRaw from '@/components/icons/eoe_campaign.svg?raw'
import tskcRaw from '@/components/icons/tskc.svg?raw'
import fhvcRaw from '@/components/icons/fhvc.svg?raw'
import tdccRaw from '@/components/icons/tdcc.svg?raw'
import barkhamRaw from '@/components/icons/barkham_horror.svg?raw'

// ── Standalone scenario icons ─────────────────────────────────────────────────
import veniceRaw from '@/components/icons/standalone-venice.svg?raw'
import rougarouRaw from '@/components/icons/curse_of_the_rougarou.svg?raw'
import filmFataleRaw from '@/components/icons/film_fatale.svg?raw'
import fortuneFollyRaw from '@/components/icons/fortune_and_folly.svg?raw'
import guardiansScenarioRaw from '@/components/icons/guardians.svg?raw'
import murderRaw from '@/components/icons/murder_at_the_excelsior_hotel.svg?raw'
import blobRaw from '@/components/icons/blob_set.svg?raw'
import mttRaw from '@/components/icons/mtt.svg?raw'
import galaRaw from '@/components/icons/gala.svg?raw'
import lolRaw from '@/components/icons/lol.svg?raw'

// ── Starter investigator deck icons ───────────────────────────────────────────
import nateRaw from '@/components/icons/nate.svg?raw'
import harveyRaw from '@/components/icons/harvey.svg?raw'
import winifredRaw from '@/components/icons/winifred.svg?raw'
import jacquelineRaw from '@/components/icons/jacqueline.svg?raw'
import stellaRaw from '@/components/icons/stella.svg?raw'

// ── Faction icons ─────────────────────────────────────────────────────────────
import factionGuardianRaw from '@/components/icons/guardian.svg?raw'
import factionSeekerRaw from '@/components/icons/seeker.svg?raw'
import factionRogueRaw from '@/components/icons/rogue.svg?raw'
import factionMysticRaw from '@/components/icons/mystic.svg?raw'
import factionSurvivorRaw from '@/components/icons/survivor.svg?raw'
import factionNeutralRaw from '@/components/icons/neutral.svg?raw'

// ── UI brand icons ────────────────────────────────────────────────────────────
import codexRaw from '@/components/icons/codex.svg?raw'
import logRaw from '@/components/icons/log.svg?raw'

// ── Fallback ──────────────────────────────────────────────────────────────────
import elderSignRaw from '@/components/icons/elder_sign.svg?raw'

/**
 * Normalise an SVG string so its paths respond to CSS `currentColor`.
 *
 * Steps applied (in order):
 *  1. Strip XML processing instructions (<?xml ...?>).
 *  2. Strip embedded <style> blocks — they may hard-code fill colours that
 *     override currentColor (e.g. `.st0{fill:#020203;}` in neutral.svg).
 *  3. Remove all fill="..." attributes from every element.
 *  4. Remove class="..." attributes from non-<svg> elements so orphaned
 *     class references can't accidentally pick up external stylesheets.
 *  5. Inject fill="currentColor" on the root <svg> element so every
 *     descendant path inherits the surrounding text colour.
 */
function normalise(raw: string): string {
  return raw
    .replace(/<\?xml[^?]*\?>\s*/g, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/\sfill="[^"]*"/g, '')
    .replace(/(<(?!svg\b)[a-zA-Z][^>]*?)\sclass="[^"]*"/g, '$1')
    .replace(/<svg\b/, '<svg fill="currentColor"')
}

// ── Campaign icons (keyed by campaign-data.ts `set` values) ──────────────────
const CAMPAIGN_ICONS: Record<string, string> = {
  'Core':                              normalise(coreRaw),
  'Return to The Night of the Zealot': normalise(rtnotzRaw),
  'Core 2026':                         normalise(core2026Raw),
  'Children of Blood':                 normalise(core2026Raw),
  'Brethren of Ash':                   normalise(core2026Raw),
  'The Dunwich Legacy':                normalise(setRaw),
  'Return to The Dunwich Legacy':      normalise(returnDunwichRaw),
  'The Path to Carcosa':               normalise(carcosaRaw),
  'Return to The Path to Carcosa':     normalise(returnCarcosaRaw),
  'The Forgotten Age':                 normalise(forgottenAgeRaw),
  'Return to The Forgotten Age':       normalise(returnForgottenAgeRaw),
  'The Circle Undone':                 normalise(circleUndoneRaw),
  'Return to The Circle Undone':       normalise(rttcuRaw),
  'The Dream-Eaters':                  normalise(dreamEatersRaw),
  'The Innsmouth Conspiracy':          normalise(ticRaw),
  // Return to The Innsmouth Conspiracy: no campaign-data entry yet; asset rttic.svg available when added.
  'Edge of the Earth':                 normalise(eoeRaw),
  'The Scarlet Keys':                  normalise(tskcRaw),
  'The Feast of Hemlock Vale':         normalise(fhvcRaw),
  'The Drowned City':                  normalise(tdccRaw),
  'Barkham Horror':                    normalise(barkhamRaw),
  // Return to The Innsmouth Conspiracy: no campaign-data entry yet; rttic.svg available when added.
  // Generic fallback keys for Scenario Pack entries that have no dedicated artwork.
  'Scenario Pack':                     normalise(elderSignRaw),
  'Standalone':                        normalise(elderSignRaw),
}

// ── Standalone scenario icons (keyed by canonical campaign name) ──────────────
const STANDALONE_ICONS: Record<string, string> = {
  'Carnevale of Horrors':              normalise(veniceRaw),
  'Curse of the Rougarou':             normalise(rougarouRaw),
  'Film Fatale':                       normalise(filmFataleRaw),
  'Fortune and Folly':                 normalise(fortuneFollyRaw),
  'Guardians of the Abyss':            normalise(guardiansScenarioRaw),
  'Murder at the Excelsior Hotel':     normalise(murderRaw),
  'The Blob That Ate Everything':      normalise(blobRaw),
  'Machinations Through Time':         normalise(mttRaw),
  'The Midwinter Gala':                normalise(galaRaw),
  'The Labyrinths of Lunacy':          normalise(lolRaw),
}

// ── Starter investigator deck icons (keyed by both short key AND full name) ────
const STARTER_ICONS: Record<string, string> = {
  // Short keys for getCampaignSvgRaw / hasDedicatedCampaignIcon lookup
  nate:       normalise(nateRaw),
  harvey:     normalise(harveyRaw),
  winifred:   normalise(winifredRaw),
  jacqueline: normalise(jacquelineRaw),
  stella:     normalise(stellaRaw),
  // Full names for getStarterInvestigatorSvgRaw lookup
  'Nathaniel Cho':    normalise(nateRaw),
  'Harvey Walters':   normalise(harveyRaw),
  'Winifred Habbamock': normalise(winifredRaw),
  'Jacqueline Fine':  normalise(jacquelineRaw),
  'Stella Clark':     normalise(stellaRaw),
}

// ── Faction icons (keyed by faction name) ─────────────────────────────────────
const FACTION_ICONS: Record<string, string> = {
  Guardian: normalise(factionGuardianRaw),
  Seeker:   normalise(factionSeekerRaw),
  Rogue:    normalise(factionRogueRaw),
  Mystic:   normalise(factionMysticRaw),
  Survivor: normalise(factionSurvivorRaw),
  Neutral:  normalise(factionNeutralRaw),
}

// ── UI brand icons (keyed by role) ────────────────────────────────────────────
const BRAND_ICONS: Record<string, string> = {
  codex: normalise(codexRaw),
  log:   normalise(logRaw),
}

/** Unified lookup covering all namespaces. */
const ALL_ICONS: Record<string, string> = {
  ...CAMPAIGN_ICONS,
  ...STANDALONE_ICONS,
  ...STARTER_ICONS,
  ...FACTION_ICONS,
  ...BRAND_ICONS,
}

const FALLBACK = normalise(elderSignRaw)

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the normalised SVG for any registered key (campaign set, standalone
 * name, starter short-key, faction name, or brand key), falling back to the
 * Elder Sign for unknown keys.
 */
export function getCampaignSvgRaw(key: string): string {
  return ALL_ICONS[key] ?? FALLBACK
}

/** Returns the SVG for a UI brand icon ('codex' or 'log'). */
export function getBrandSvgRaw(key: 'codex' | 'log'): string {
  return BRAND_ICONS[key]
}

/** Returns the SVG for a standalone scenario by its canonical campaign name. */
export function getStandaloneSvgRaw(scenarioName: string): string {
  return STANDALONE_ICONS[scenarioName] ?? FALLBACK
}

/** Returns the SVG for a starter investigator by short registry key (nate, harvey, …). */
export function getStarterInvestigatorSvgRaw(key: string): string {
  return STARTER_ICONS[key] ?? FALLBACK
}

/** Returns the SVG for a faction by name (Guardian, Seeker, …). */
export function getFactionSvgRaw(faction: string): string {
  return FACTION_ICONS[faction] ?? FALLBACK
}

/** True if the given key has a dedicated entry across all namespaces. */
export function hasDedicatedCampaignIcon(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(ALL_ICONS, key)
}

export const CAMPAIGN_ICON_SETS = Object.keys(CAMPAIGN_ICONS) as string[]
