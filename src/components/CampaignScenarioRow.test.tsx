import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CampaignScenarioRow } from './CampaignScenarioRow'
import type { CampaignRun, CampaignScenarioLog } from '@/lib/types'

function makeLog(scenarioName: string, id = 'side-1'): CampaignScenarioLog {
  return {
    id,
    date: '2026-11-10',
    scenarioName,
    scenarioType: 'side_scenario',
    investigators: [{ playerName: 'Alice', investigatorName: 'Roland Banks', archetype: 'Guardian' }],
    investigatorOutcomes: [{
      seatId: 'seat:alice:1',
      slotId: 'seat:alice:1:slot:1',
      playerName: 'Alice',
      investigatorName: 'Roland Banks',
      status: 'survived',
      xpEarned: 4,
      traumaGainedPhysical: 0,
      traumaGainedMental: 0,
    }],
  }
}

function makeRun(scenarioLogs: CampaignScenarioLog[], overrides: Partial<CampaignRun> = {}): CampaignRun {
  return {
    id: 'run-1',
    version: 2,
    campaignLineageId: 'campaign:path-to-carcosa',
    campaignName: 'The Path to Carcosa',
    campaignType: 'Full Campaign',
    startedAt: '2026-11-09',
    updatedAt: '2026-11-10T00:00:00Z',
    status: 'active',
    setupSnapshot: { date: '2026-11-09', investigators: scenarioLogs[0].investigators },
    scenarioLogs,
    ...overrides,
  }
}

function renderRow(run: CampaignRun, logIndex = 0, displayIndex = logIndex) {
  return render(
    <CampaignScenarioRow
      campaignRun={run}
      scenarioLog={run.scenarioLogs[logIndex]}
      index={displayIndex}
      isLatestScenario={logIndex === run.scenarioLogs.length - 1}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
}

describe('saved side-scenario entry guidance', () => {
  it('shows negative admission separately from saved earned XP without changing the record', () => {
    const run = makeRun([makeLog('Traces To Nowhere')])
    const original = structuredClone(run)
    renderRow(run)
    expect(screen.getByRole('note', { name: 'Campaign entry guidance' }))
      .toHaveTextContent('Entry cost: -2 XP per investigator.')
    expect(screen.getByText('4 XP')).toBeVisible()
    expect(run).toEqual(original)
  })

  it('does not show campaign admission for a standalone result', () => {
    const log = { ...makeLog('Traces To Nowhere'), scenarioType: 'standard' as const }
    renderRow(makeRun([log], { campaignType: 'Scenario Pack', campaignName: 'Traces To Nowhere' }))
    expect(screen.queryByRole('note', { name: 'Campaign entry guidance' })).not.toBeInTheDocument()
    expect(screen.getByText('4 XP')).toBeVisible()
  })

  it.each([undefined, 'side_scenario' as const])('derives legacy guidance without outcomes, roster, or cost fields (type: %s)', (scenarioType) => {
    const log: CampaignScenarioLog = {
      id: 'legacy-side',
      date: '2025-03-01',
      scenarioName: 'Curse of the Rougarou',
      scenarioType,
      investigators: [],
    }
    const run = makeRun([log], { version: 1 })
    const original = structuredClone(run)
    renderRow(run)
    expect(screen.getByRole('note', { name: 'Campaign entry guidance' }))
      .toHaveTextContent('Entry cost: -1 XP per investigator.')
    if (scenarioType === undefined) {
      expect(screen.getByRole('note', { name: 'Campaign entry guidance' }))
        .toHaveTextContent('Scenario type was not recorded; this guidance applies only if this was a campaign side-story.')
    }
    expect(run).toEqual(original)
  })

  it('uses earlier stored logs, not the displayed row index, for shared Fortune entry', () => {
    const run = makeRun([
      { ...makeLog('The Path to Carcosa', 'setup'), scenarioType: undefined },
      makeLog('Fortune and Folly, Part I', 'part-1'),
      makeLog('Fortune and Folly, Part II', 'part-2'),
    ])
    renderRow(run, 2, 1)
    const guidance = screen.getByRole('note', { name: 'Campaign entry guidance' })
    expect(guidance).toHaveTextContent('No additional entry XP for Part II when continuing Part I.')
    expect(guidance).toHaveTextContent('not evidence that entry XP was paid')
  })

  it('does not use later Part I logs to infer earlier entry into Part II', () => {
    renderRow(makeRun([
      makeLog('Fortune and Folly, Part II', 'part-2'),
      makeLog('Fortune and Folly, Part I', 'part-1'),
    ]))
    expect(screen.getByRole('note', { name: 'Campaign entry guidance' }))
      .toHaveTextContent('Entry cost: -3 XP per investigator if starting directly with Part II.')
  })

  it('keeps Scarlet Keys time substitution conditional on a supported location', () => {
    renderRow(makeRun([makeLog('Traces To Nowhere')], { campaignName: 'The Scarlet Keys' }))
    const guidance = screen.getByRole('note', { name: 'Campaign entry guidance' })
    expect(guidance).toHaveTextContent('at a supported green-bordered map location')
    expect(guidance).toHaveTextContent('instead of XP')
    expect(guidance).toHaveTextContent('availability is not verified here')
    expect(guidance).toHaveTextContent('Normal entry rule: Entry cost: -2 XP per investigator.')
  })

  it.each([
    ['My Custom Side Story', 'Entry XP cost unknown / unverified.'],
    ['Guardians of the Abyss', 'A package-only log cannot identify which entry cost applies.'],
  ])('shows ambiguity instead of an invented saved cost for %s', (name, message) => {
    renderRow(makeRun([makeLog(name)]))
    expect(screen.getByRole('note', { name: 'Campaign entry guidance' })).toHaveTextContent(message)
  })
})
