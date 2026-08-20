import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/react'
import { InvestigatorHeatmap } from './InvestigatorHeatmap'
import type { InvestigatorAssignment, Playthrough } from '@/lib/types'

function makeInvestigator(
  investigatorName: string,
  archetype: InvestigatorAssignment['archetype'],
): InvestigatorAssignment {
  return {
    playerName: 'Player',
    investigatorName,
    archetype,
  }
}

const personalPlaythroughs: Playthrough[] = [{
  id: 'personal-1',
  date: '2026-01-01',
  campaignName: 'Night of the Zealot',
  campaignType: 'Full Campaign',
  campaignLineageId: 'campaign:night-of-the-zealot',
  investigators: [
    makeInvestigator('Roland Banks', 'Guardian'),
    makeInvestigator('Daisy Walker', 'Seeker'),
  ],
}, {
  id: 'personal-2',
  date: '2026-01-08',
  campaignName: 'Night of the Zealot',
  campaignType: 'Full Campaign',
  campaignLineageId: 'campaign:night-of-the-zealot',
  investigators: [
    makeInvestigator('Roland Banks', 'Guardian'),
    makeInvestigator('Daisy Walker', 'Seeker'),
  ],
}]

describe('InvestigatorHeatmap count units', () => {
  it('labels community cells as campaign participation', () => {
    render(
      <InvestigatorHeatmap
        playthroughs={personalPlaythroughs}
        communityPairings={[
          { investigator1: 'Daisy Walker', investigator2: 'Roland Banks', count: 3 },
        ]}
      />,
    )

    expect(screen.getByText('Campaigns in which investigators participated together')).toBeVisible()
    expect(screen.getAllByRole('gridcell', {
      name: 'Daisy Walker & Roland Banks: 3 campaigns',
    })).toHaveLength(1)
  })

  it('preserves game-session units for the personal view', async () => {
    const user = userEvent.setup()
    render(
      <InvestigatorHeatmap
        playthroughs={personalPlaythroughs}
        communityPairings={[
          { investigator1: 'Daisy Walker', investigator2: 'Roland Banks', count: 3 },
        ]}
      />,
    )

    await user.click(screen.getByRole('tab', { name: 'Your Games' }))

    expect(screen.getByText('Game sessions in which your investigators played together')).toBeVisible()
    expect(screen.getAllByRole('gridcell', {
      name: 'Daisy Walker & Roland Banks: 2 games',
    })).toHaveLength(1)
  })
})
