import { describe, expect, it } from 'vitest'

import {
  isCampaignRun,
  isCampaignScenarioLog,
  isExportEnvelopeV2,
  isPlaythrough,
  type CampaignRun,
  type Playthrough,
} from './types'

function makePlaythrough(overrides: Partial<Playthrough> = {}): Playthrough {
  return {
    id: 'pt-1',
    date: '2026-08-17',
    campaignName: 'The Path to Carcosa',
    campaignType: 'Full Campaign',
    campaignLineageId: 'campaign:path-to-carcosa',
    investigators: [
      {
        playerName: 'Devin',
        investigatorName: 'Mark Harrigan',
        archetype: 'Guardian',
      },
    ],
    ...overrides,
  }
}

function makeCampaignRun(overrides: Partial<CampaignRun> = {}): CampaignRun {
  return {
    id: 'run-1',
    version: 2,
    campaignLineageId: 'campaign:path-to-carcosa',
    campaignName: 'The Path to Carcosa',
    campaignType: 'Full Campaign',
    startedAt: '2026-08-01',
    updatedAt: '2026-08-17T00:00:00.000Z',
    status: 'active',
    setupSnapshot: {
      date: '2026-08-01',
      investigators: [
        {
          playerName: 'Devin',
          investigatorName: 'Mark Harrigan',
          archetype: 'Guardian',
        },
      ],
    },
    scenarioLogs: [
      {
        id: 'scenario-1',
        date: '2026-08-01',
        scenarioName: 'Curtain Call',
        investigators: [
          {
            playerName: 'Devin',
            investigatorName: 'Mark Harrigan',
            archetype: 'Guardian',
          },
        ],
        scenarioType: 'standard',
        resolution: {
          type: 'numbered',
          value: '1',
        },
      },
    ],
    ...overrides,
  }
}

describe('types guards', () => {
  it('accepts valid playthroughs and campaign runs', () => {
    expect(isPlaythrough(makePlaythrough())).toBe(true)
    expect(isCampaignScenarioLog(makeCampaignRun().scenarioLogs[0])).toBe(true)
    expect(isCampaignRun(makeCampaignRun())).toBe(true)
  })

  it('accepts campaign run versions 1 and 2, rejects malformed snapshots', () => {
    expect(isCampaignRun({ ...makeCampaignRun(), version: 1 })).toBe(true)
    expect(isCampaignRun({ ...makeCampaignRun(), version: 2 })).toBe(true)
    expect(isCampaignRun({ ...makeCampaignRun(), version: 3 as unknown as CampaignRun['version'] })).toBe(false)
    expect(isCampaignRun({ ...makeCampaignRun(), setupSnapshot: null })).toBe(false)
  })

  it('validates v2 export envelopes', () => {
    const envelope = {
      version: 2,
      playthroughs: [makePlaythrough()],
      campaignRuns: [makeCampaignRun()],
    }
    expect(isExportEnvelopeV2(envelope)).toBe(true)
    expect(isExportEnvelopeV2({ ...envelope, version: 1 })).toBe(false)
    expect(isExportEnvelopeV2({ ...envelope, campaignRuns: [{}] })).toBe(false)
  })

  it('rejects malformed optional investigator and campaign-run metadata', () => {
    expect(isPlaythrough({
      ...makePlaythrough(),
      investigators: [{
        playerName: 'Devin',
        investigatorName: 'Mark Harrigan',
        archetype: 'Guardian',
        chapter: 3,
      }],
    })).toBe(false)

    expect(isCampaignRun({
      ...makeCampaignRun(),
      setupSnapshot: {
        ...makeCampaignRun().setupSnapshot,
        notes: 42,
      },
    })).toBe(false)
  })
})
