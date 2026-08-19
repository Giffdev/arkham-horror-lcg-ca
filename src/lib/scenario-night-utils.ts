import type { CampaignRun, CampaignScenarioLog, Playthrough } from './types'

function normalizeScenarioIdentity(value: string | undefined): string {
  return value?.trim().replace(/\s+/g, ' ').toLocaleLowerCase() ?? ''
}

function getCampaignDisplayName(name: string, customName?: string): string {
  return (customName?.trim() || name.trim())
}

function isLegacyRootShellLog(campaignRun: CampaignRun, scenarioLog: CampaignScenarioLog): boolean {
  if (!scenarioLog.legacySourcePlaythroughId) return false
  const normalizedScenario = normalizeScenarioIdentity(scenarioLog.scenarioName)
  const normalizedCampaign = normalizeScenarioIdentity(
    getCampaignDisplayName(campaignRun.campaignName, campaignRun.customCampaignName),
  )
  if (!normalizedScenario || !normalizedCampaign) return false
  return normalizedScenario === normalizedCampaign
}

export function isActualCampaignScenarioNight(campaignRun: CampaignRun, scenarioLog: CampaignScenarioLog): boolean {
  const normalizedScenario = normalizeScenarioIdentity(scenarioLog.scenarioName)
  if (!normalizedScenario) return false
  return !isLegacyRootShellLog(campaignRun, scenarioLog)
}

export function getActualCampaignScenarioLogs(campaignRun: CampaignRun): CampaignScenarioLog[] {
  return campaignRun.scenarioLogs.filter((scenarioLog) => isActualCampaignScenarioNight(campaignRun, scenarioLog))
}

export function hasActualCampaignScenarioNights(campaignRun: CampaignRun): boolean {
  return getActualCampaignScenarioLogs(campaignRun).length > 0
}

export function isActualLegacyScenarioNight(playthrough: Playthrough): boolean {
  const normalizedScenario = normalizeScenarioIdentity(playthrough.scenarioName)
  if (!normalizedScenario) return false
  const normalizedCampaign = normalizeScenarioIdentity(
    getCampaignDisplayName(playthrough.campaignName, playthrough.customCampaignName),
  )
  if (!normalizedCampaign) return true
  return normalizedScenario !== normalizedCampaign
}
