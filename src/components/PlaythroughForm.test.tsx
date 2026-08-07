import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PlaythroughForm } from './PlaythroughForm'
import type { Playthrough } from '@/lib/types'

describe('PlaythroughForm player controls', () => {
  it('prevents adding a fifth player and keeps remove controls visible', async () => {
    const user = userEvent.setup()
    render(
      <PlaythroughForm
        open
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
      />
    )

    const addButton = screen.getByRole('button', { name: 'Add Investigator' })
    await user.click(addButton)
    await user.click(addButton)
    await user.click(addButton)

    expect(addButton).toBeDisabled()
    expect(screen.getByText('Player limit reached (4 maximum).')).toBeVisible()
    expect(screen.getByText('Investigators (4/4)')).toBeVisible()

    const removeButton = screen.getByRole('button', { name: 'Remove investigator 1' })
    expect(removeButton).toHaveClass('text-destructive', 'bg-destructive/10', 'focus-visible:ring-destructive/50')

    await user.click(removeButton)
    expect(addButton).toBeEnabled()
    expect(screen.getByText('Up to 4 players per playthrough.')).toBeVisible()
  })

  it('keeps a valid four-player playthrough editable', () => {
    const editPlaythrough: Playthrough = {
      id: 'playthrough-1',
      date: '2026-08-01',
      campaignName: 'Night of the Zealot',
      campaignType: 'Full Campaign',
      investigators: Array.from({ length: 4 }, (_, index) => ({
        playerName: `Player ${index + 1}`,
        investigatorName: `Investigator ${index + 1}`,
        archetype: 'Unknown',
      })),
    }

    render(
      <PlaythroughForm
        open
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        editPlaythrough={editPlaythrough}
      />
    )

    expect(screen.getByRole('button', { name: 'Add Investigator' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Update Playthrough' })).toBeEnabled()
    expect(screen.getAllByRole('button', { name: /Remove investigator/ })).toHaveLength(4)
  })
})
