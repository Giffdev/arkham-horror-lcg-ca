import { SCENARIO_PACK_SCENARIOS } from './campaign-data'
import type { CampaignRun, CampaignScenarioLog } from './types'

interface EntryGuidance {
  summary: string
  detail: string
  source: string
  campaignRule?: string
}

type ScenarioIdentity = Pick<CampaignScenarioLog, 'scenarioName' | 'scenarioType'>

const ENTRY_COSTS: Record<string, { xp: number; source: string }> = {
  'curse of the rougarou': { xp: 1, source: 'curse of the rougarou.pdf, p. 1' },
  'carnevale of horrors': { xp: 3, source: 'carnavale of horrors.pdf, p. 1' },
  'murder at the excelsior hotel': { xp: 3, source: 'murder at the excelsior hotel campaign guide.pdf, p. 3' },
  'the blob that ate everything': { xp: 2, source: 'the blob that ate everything campaign guide.pdf, p. 3' },
  'war of the outer gods': { xp: 3, source: 'war of the outer gods campaign guide.pdf, p. 3' },
  'machinations through time': { xp: 2, source: 'machinations through time campaign guide.pdf, p. 3' },
  'the midwinter gala': { xp: 2, source: 'the midwinter gala campaign rules.pdf, p. 2' },
  'film fatale': { xp: 3, source: 'film fatale campaign rules.pdf, p. 2' },
  'traces to nowhere': {
    xp: 2,
    source: 'https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/AHC107_Campaign-Guide.pdf, p. 4',
  },
  'the eternal slumber': { xp: 2, source: 'guardians of the abyss campaign guide.pdf, p. 3' },
  "the night's usurper": { xp: 2, source: 'guardians of the abyss campaign guide.pdf, p. 3' },
}

const FORTUNE_SOURCE = 'Fortune and folly campaign guide.pdf, pp. 3, 11'
const GUARDIANS_ORDER = "The Night's Usurper may be played directly; The Eternal Slumber cannot be played afterwards in the same campaign."

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').replace(/’/g, "'").toLowerCase()
}

export function getSideScenarioEntryGuidance(
  campaign: Pick<CampaignRun, 'campaignName' | 'campaignType'>,
  scenario: ScenarioIdentity,
  previousScenarioLogs: readonly ScenarioIdentity[] = [],
): EntryGuidance | null {
  if (campaign.campaignType === 'Scenario Pack') return null
  const name = normalizeName(scenario.scenarioName)
  if (!name) return null
  const isUntypedLegacySideStory = scenario.scenarioType === undefined &&
    (campaign.campaignType === 'Full Campaign' || campaign.campaignType === 'Small Campaign') &&
    SCENARIO_PACK_SCENARIOS.some(entry => normalizeName(entry.name) === name)
  if (scenario.scenarioType !== 'side_scenario' && !isUntypedLegacySideStory) return null

  const standaloneOnly = name === 'the labyrinths of lunacy' || name === 'barkham horror: the meddling of meowlathotep'
  let guidance: EntryGuidance
  if (standaloneOnly) {
    guidance = {
      summary: 'Campaign integration is not supported by the published rules.',
      detail: 'This scenario is standalone-only, not a zero-XP campaign side-story. This notice does not block logging.',
      source: name === 'the labyrinths of lunacy'
        ? 'the labyrinths of lunacy campaign guide.pdf, p. 1'
        : 'barkham horror the meddling of meowlahotep campaign guide.pdf, pp. 1–2',
    }
  } else if (name === 'fortune and folly' || name === 'fortune and folly, part i') {
    guidance = {
      summary: 'Entry cost: -3 XP per investigator, once for both parts.',
      detail: 'Part II may be played directly instead of Part I. Continuing from Part I to Part II has no additional entry cost.',
      source: FORTUNE_SOURCE,
    }
  } else if (name === 'fortune and folly, part ii') {
    const hasEarlierPartI = previousScenarioLogs.some(log =>
      log.scenarioType === 'side_scenario' && normalizeName(log.scenarioName) === 'fortune and folly, part i',
    )
    guidance = {
      summary: hasEarlierPartI
        ? 'No additional entry XP for Part II when continuing Part I.'
        : 'Entry cost: -3 XP per investigator if starting directly with Part II.',
      detail: hasEarlierPartI
        ? 'The shared entry cost is -3 XP per investigator, once for both parts. An earlier Part I log is not evidence that entry XP was paid.'
        : 'If continuing Part I, there is no additional entry cost. Earlier entry or payment cannot be confirmed from this history.',
      source: FORTUNE_SOURCE,
    }
  } else if (name === 'guardians of the abyss') {
    guidance = {
      summary: 'Guardians of the Abyss has two separately priced scenarios.',
      detail: `The Eternal Slumber and The Night's Usurper each cost -2 XP per investigator. A package-only log cannot identify which entry cost applies. ${GUARDIANS_ORDER}`,
      source: 'guardians of the abyss campaign guide.pdf, p. 3',
    }
  } else {
    const cost = Object.prototype.hasOwnProperty.call(ENTRY_COSTS, name) ? ENTRY_COSTS[name] : undefined
    guidance = cost
      ? {
          summary: `Entry cost: -${cost.xp} XP per investigator.`,
          detail: name === 'the eternal slumber' || name === "the night's usurper"
            ? GUARDIANS_ORDER
            : 'Entry XP is separate from XP earned during the scenario.',
          source: cost.source,
        }
      : {
          summary: 'Entry XP cost unknown / unverified.',
          detail: 'Check the published campaign rules for this side-story. No zero cost is assumed.',
          source: 'No verified entry-cost source for this scenario.',
        }
  }

  if (isUntypedLegacySideStory) {
    guidance.detail = `Scenario type was not recorded; this guidance applies only if this was a campaign side-story. ${guidance.detail}`
  }
  if (!standaloneOnly && campaign.campaignType === 'Full Campaign' && normalizeName(campaign.campaignName) === 'the scarlet keys') {
    guidance.campaignRule = 'The Scarlet Keys: at a supported green-bordered map location, spend additional campaign time equal to the normal entry XP cost instead of XP. Check the campaign map; scenario availability is not verified here.'
    guidance.source += '; the scarlet keys campaign guide.pdf, p. 10'
  }
  return guidance
}
