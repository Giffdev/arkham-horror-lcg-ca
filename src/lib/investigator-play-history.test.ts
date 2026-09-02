import { describe, expect, it } from 'vitest'

import {
  collapseCampaignInvestigatorPlays,
  collapseInvestigatorPlaysByRoot,
} from './investigator-play-history'
import type { CampaignRun, FlattenedGameLog, InvestigatorAssignment } from './types'

const ROLAND: InvestigatorAssignment = {
  playerName: 'Alice',
  investigatorName: 'Roland Banks',
  investigatorId: '01001',
  archetype: 'Guardian',
}

function rosterEntry(
  slotId: string,
  investigator: InvestigatorAssignment,
  seatStatus: 'active' | 'left' | 'eliminated' = 'active',
) {
  return {
    seatId: `seat-${slotId}`,
    slotId,
    playerName: investigator.playerName,
    investigator,
    seatStatus,
    joinedAtScenarioIndex: 0,
    startedAtScenarioIndex: 0,
    xpTotal: 0,
    xpSpent: 0,
    physicalTrauma: 0,
    mentalTrauma: 0,
  }
}

function scenario(runId: string, scenarioId: string, date: string): FlattenedGameLog {
  return {
    id: `campaign-run:${runId}:scenario:${scenarioId}`,
    date,
    campaignName: 'The Night of the Zealot',
    campaignType: 'Small Campaign',
    investigators: [{ ...ROLAND }],
    sourceKind: 'campaign-run-scenario',
    campaignRunId: runId,
    sourceCampaignScenarioLogId: scenarioId,
  }
}

function standalone(id: string, date: string): FlattenedGameLog {
  return {
    id,
    date,
    campaignName: 'The Blob That Ate Everything',
    campaignType: 'Scenario Pack',
    investigators: [{ ...ROLAND }],
    sourceKind: 'playthrough',
    sourcePlaythroughId: id,
  }
}

describe('collapseInvestigatorPlaysByRoot', () => {
  it('counts an investigator once across a multi-scenario campaign run', () => {
    const result = collapseInvestigatorPlaysByRoot([
      scenario('run-1', 'scenario-1', '2026-01-01'),
      scenario('run-1', 'scenario-2', '2026-01-08'),
      scenario('run-1', 'scenario-3', '2026-01-15'),
    ])

    expect(result).toHaveLength(1)
    expect(result[0].investigators).toEqual([ROLAND])
    expect(result[0].date).toBe('2026-01-15')
  })

  it('keeps separate campaign runs distinct', () => {
    const result = collapseInvestigatorPlaysByRoot([
      scenario('run-1', 'scenario-1', '2026-01-01'),
      scenario('run-2', 'scenario-1', '2026-02-01'),
    ])

    expect(result).toHaveLength(2)
    expect(result.flatMap(play => play.investigators)).toHaveLength(2)
  })

  it('keeps distinct investigators from the same campaign run', () => {
    const replacement = scenario('run-1', 'scenario-2', '2026-01-08')
    replacement.investigators = [{
      playerName: 'Alice',
      investigatorName: 'Wendy Adams',
      investigatorId: '01005',
      archetype: 'Survivor',
    }]

    const result = collapseInvestigatorPlaysByRoot([
      scenario('run-1', 'scenario-1', '2026-01-01'),
      replacement,
    ])

    expect(result).toHaveLength(1)
    expect(result[0].investigators.map(investigator => investigator.investigatorName)).toEqual([
      'Roland Banks',
      'Wendy Adams',
    ])
  })

  it('keeps standalone plays distinct from each other and campaign runs', () => {
    const result = collapseInvestigatorPlaysByRoot([
      scenario('run-1', 'scenario-1', '2026-01-01'),
      standalone('standalone-1', '2026-02-01'),
      standalone('standalone-2', '2026-03-01'),
    ])

    expect(result).toHaveLength(3)
    expect(result.flatMap(play => play.investigators)).toHaveLength(3)
  })

  it('counts Hank Samson from a saved Hemlock Vale campaign with no scenario logs', () => {
    const hank = {
      playerName: 'Devin Sinha',
      investigatorName: 'Hank Samson',
      investigatorId: 'hank-samson',
      chapter: 1 as const,
      investigatorSet: 'The Feast of Hemlock Vale',
      archetype: 'Survivor' as const,
      archetypes: ['Survivor'] as const,
    }
    const campaignRun: CampaignRun = {
      id: 'hemlock-hank',
      version: 1,
      campaignLineageId: 'campaign:the-feast-of-hemlock-vale',
      campaignName: 'The Feast of Hemlock Vale',
      campaignSet: 'The Feast of Hemlock Vale',
      campaignType: 'Full Campaign',
      startedAt: '2026-08-01',
      updatedAt: '2026-08-01T00:00:00.000Z',
      status: 'active',
      setupSnapshot: {
        date: '2026-08-01',
        investigators: [hank],
      },
      scenarioLogs: [],
    }

    const result = collapseCampaignInvestigatorPlays([], [campaignRun])

    expect(result).toHaveLength(1)
    expect(result[0].investigators).toEqual([hank])
  })

  it('counts investigators retained only in campaign roster transition history', () => {
    const wendy: InvestigatorAssignment = {
      playerName: 'Alice',
      investigatorName: 'Wendy Adams',
      investigatorId: 'wendy-adams',
      archetype: 'Survivor',
    }
    const daisy: InvestigatorAssignment = {
      playerName: 'Bob',
      investigatorName: 'Daisy Walker',
      investigatorId: 'daisy-walker',
      archetype: 'Seeker',
    }
    const zoey: InvestigatorAssignment = {
      playerName: 'Carol',
      investigatorName: 'Zoey Samaras',
      investigatorId: 'zoey-samaras',
      archetype: 'Guardian',
    }
    const agnes: InvestigatorAssignment = {
      playerName: 'Dana',
      investigatorName: 'Agnes Baker',
      investigatorId: 'agnes-baker',
      archetype: 'Mystic',
    }
    const campaignRun: CampaignRun = {
      id: 'run-with-roster-history',
      version: 1,
      campaignLineageId: 'campaign:the-night-of-the-zealot',
      campaignName: 'The Night of the Zealot',
      campaignType: 'Small Campaign',
      startedAt: '2026-01-01',
      updatedAt: '2026-01-08T00:00:00.000Z',
      status: 'active',
      setupSnapshot: {
        date: '2026-01-01',
        investigators: [{ ...ROLAND }],
      },
      currentRoster: [rosterEntry('daisy', daisy)],
      scenarioLogs: [{
        ...scenario('run-with-roster-history', 'scenario-1', '2026-01-08'),
        rosterBefore: [
          rosterEntry('wendy', wendy, 'eliminated'),
          rosterEntry('zoey', zoey, 'left'),
        ],
        rosterChanges: [{
          type: 'replacement',
          seatId: 'seat-daisy',
          previousSlotId: 'wendy',
          reason: 'killed',
          newEntry: rosterEntry('daisy', daisy),
        }],
        rosterAfter: [rosterEntry('daisy', daisy), rosterEntry('agnes', agnes)],
      }],
    }

    const result = collapseCampaignInvestigatorPlays([], [campaignRun])

    expect(result).toHaveLength(1)
    expect(result[0].investigators.map(investigator => investigator.investigatorName)).toEqual(
      expect.arrayContaining([
        'Roland Banks',
        'Wendy Adams',
        'Daisy Walker',
        'Zoey Samaras',
        'Agnes Baker',
      ]),
    )
    expect(result[0].investigators).toHaveLength(5)
  })

  it('deduplicates canonical investigators across name-only, ID-backed, and corrected-player evidence', () => {
    const campaignRun: CampaignRun = {
      id: 'canonical-identity-run',
      version: 1,
      campaignLineageId: 'campaign:the-night-of-the-zealot',
      campaignName: 'The Night of the Zealot',
      campaignType: 'Small Campaign',
      startedAt: '2026-01-01',
      updatedAt: '2026-01-08T00:00:00.000Z',
      status: 'active',
      setupSnapshot: {
        date: '2026-01-01',
        investigators: [{
          playerName: 'Alic',
          investigatorName: 'Roland Banks',
          archetype: 'Guardian',
        }],
      },
      scenarioLogs: [{
        ...scenario('canonical-identity-run', 'scenario-1', '2026-01-08'),
        investigators: [{
          ...ROLAND,
          playerName: 'Alice',
        }],
      }],
    }

    const result = collapseCampaignInvestigatorPlays([], [campaignRun])

    expect(result).toHaveLength(1)
    expect(result[0].investigators).toHaveLength(1)
    expect(result[0].investigators[0]).toMatchObject({
      investigatorId: '01001',
      investigatorName: 'Roland Banks',
      playerName: 'Alice',
    })
  })

  it('uses current roster metadata without letting older history restore a stale player name', () => {
    const staleRoland = {
      ...ROLAND,
      playerName: 'Alic',
    }
    const campaignRun: CampaignRun = {
      id: 'corrected-current-roster-run',
      version: 2,
      campaignLineageId: 'campaign:the-night-of-the-zealot',
      campaignName: 'The Night of the Zealot',
      campaignType: 'Small Campaign',
      startedAt: '2026-01-01',
      updatedAt: '2026-01-08T00:00:00.000Z',
      status: 'active',
      setupSnapshot: {
        date: '2026-01-01',
        investigators: [{
          playerName: 'Alic',
          investigatorName: 'Roland Banks',
          archetype: 'Guardian',
        }],
      },
      currentRoster: [rosterEntry('roland', ROLAND)],
      scenarioLogs: [{
        ...scenario('corrected-current-roster-run', 'scenario-1', '2026-01-08'),
        investigators: [staleRoland],
        rosterBefore: [rosterEntry('roland', staleRoland)],
        rosterAfter: [rosterEntry('roland', staleRoland)],
      }],
    }

    const result = collapseCampaignInvestigatorPlays(
      [scenario('corrected-current-roster-run', 'scenario-1', '2026-01-08')],
      [campaignRun],
    )

    expect(result).toHaveLength(1)
    expect(result[0].investigators).toEqual([ROLAND])
    expect(result[0].investigators.map(investigator => investigator.playerName)).not.toContain('Alic')
  })

  it('does not introduce an investigator found only in the current roster', () => {
    const campaignRun: CampaignRun = {
      id: 'current-roster-only-run',
      version: 2,
      campaignLineageId: 'campaign:the-night-of-the-zealot',
      campaignName: 'The Night of the Zealot',
      campaignType: 'Small Campaign',
      startedAt: '2026-01-01',
      updatedAt: '2026-01-08T00:00:00.000Z',
      status: 'active',
      setupSnapshot: {
        date: '2026-01-01',
        investigators: [{ ...ROLAND }],
      },
      currentRoster: [
        rosterEntry('roland', ROLAND),
        rosterEntry('wendy', {
          playerName: 'Bob',
          investigatorName: 'Wendy Adams',
          investigatorId: 'wendy-adams',
          archetype: 'Survivor',
        }),
      ],
      scenarioLogs: [],
    }

    const result = collapseCampaignInvestigatorPlays([], [campaignRun])

    expect(result[0].investigators).toEqual([ROLAND])
  })
})
