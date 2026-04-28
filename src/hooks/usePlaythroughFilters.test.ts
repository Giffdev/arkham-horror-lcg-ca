import { renderHook, act } from '@testing-library/react'
import { usePlaythroughFilters } from './usePlaythroughFilters'
import { Playthrough } from '@/lib/types'

function makePlaythrough(overrides: Partial<Playthrough> = {}): Playthrough {
  return {
    id: 'pt-1',
    date: '2026-01-15',
    campaignName: 'Night of the Zealot',
    campaignType: 'Full Campaign',
    investigators: [
      { playerName: 'Alice', investigatorName: 'Roland Banks', archetype: 'Guardian' },
    ],
    ...overrides,
  }
}

const samplePlaythroughs: Playthrough[] = [
  makePlaythrough({ id: 'pt-1', campaignName: 'Night of the Zealot', campaignType: 'Full Campaign', investigators: [
    { playerName: 'Alice', investigatorName: 'Roland Banks', archetype: 'Guardian' },
    { playerName: 'Bob', investigatorName: 'Daisy Walker', archetype: 'Seeker' },
  ]}),
  makePlaythrough({ id: 'pt-2', campaignName: 'The Dunwich Legacy', campaignType: 'Full Campaign', investigators: [
    { playerName: 'Alice', investigatorName: 'Jenny Barnes', archetype: 'Rogue' },
  ]}),
  makePlaythrough({ id: 'pt-3', campaignName: 'Barkham Horror', campaignType: 'Scenario Pack', investigators: [
    { playerName: 'Charlie', investigatorName: 'Stella Clark', archetype: 'Survivor' },
  ]}),
  makePlaythrough({ id: 'pt-4', campaignName: 'My Custom', campaignType: 'Fan-Made', customCampaignName: 'Homebrew Madness', investigators: [
    { playerName: 'Dave', investigatorName: 'Agnes Baker', archetype: 'Mystic' },
  ]}),
]

describe('usePlaythroughFilters', () => {
  describe('initial state', () => {
    it('returns all playthroughs when no filters are active', () => {
      const { result } = renderHook(() => usePlaythroughFilters(samplePlaythroughs))
      expect(result.current.filteredPlaythroughs).toHaveLength(4)
    })

    it('returns empty array when playthroughs is undefined', () => {
      const { result } = renderHook(() => usePlaythroughFilters(undefined))
      expect(result.current.filteredPlaythroughs).toEqual([])
    })

    it('returns empty array when playthroughs is empty', () => {
      const { result } = renderHook(() => usePlaythroughFilters([]))
      expect(result.current.filteredPlaythroughs).toEqual([])
    })

    it('starts with no filters selected', () => {
      const { result } = renderHook(() => usePlaythroughFilters(samplePlaythroughs))
      expect(result.current.filters.selectedArchetypes).toEqual([])
      expect(result.current.filters.selectedCampaignTypes).toEqual([])
      expect(result.current.filters.selectedCampaigns).toEqual([])
    })
  })

  describe('archetype filtering', () => {
    it('filters by single archetype', () => {
      const { result } = renderHook(() => usePlaythroughFilters(samplePlaythroughs))
      act(() => { result.current.handlers.onArchetypeToggle('Guardian') })
      expect(result.current.filteredPlaythroughs).toHaveLength(1)
      expect(result.current.filteredPlaythroughs[0].id).toBe('pt-1')
    })

    it('filters by multiple archetypes (OR logic)', () => {
      const { result } = renderHook(() => usePlaythroughFilters(samplePlaythroughs))
      act(() => { result.current.handlers.onArchetypeToggle('Guardian') })
      act(() => { result.current.handlers.onArchetypeToggle('Rogue') })
      expect(result.current.filteredPlaythroughs).toHaveLength(2)
      const ids = result.current.filteredPlaythroughs.map(p => p.id)
      expect(ids).toContain('pt-1')
      expect(ids).toContain('pt-2')
    })

    it('matches playthrough if ANY investigator has the archetype', () => {
      const { result } = renderHook(() => usePlaythroughFilters(samplePlaythroughs))
      act(() => { result.current.handlers.onArchetypeToggle('Seeker') })
      // pt-1 has a Seeker (Daisy Walker) as second investigator
      expect(result.current.filteredPlaythroughs).toHaveLength(1)
      expect(result.current.filteredPlaythroughs[0].id).toBe('pt-1')
    })

    it('toggling same archetype again removes the filter', () => {
      const { result } = renderHook(() => usePlaythroughFilters(samplePlaythroughs))
      act(() => { result.current.handlers.onArchetypeToggle('Guardian') })
      expect(result.current.filteredPlaythroughs).toHaveLength(1)
      act(() => { result.current.handlers.onArchetypeToggle('Guardian') })
      expect(result.current.filteredPlaythroughs).toHaveLength(4)
    })

    it('handles dual-class investigators with archetypes array', () => {
      const dualClassPlaythroughs: Playthrough[] = [
        makePlaythrough({ id: 'dc-1', investigators: [
          { playerName: 'Eve', investigatorName: 'Mandy Thompson', archetype: 'Seeker', archetypes: ['Seeker', 'Mystic'] },
        ]}),
      ]
      const { result } = renderHook(() => usePlaythroughFilters(dualClassPlaythroughs))
      act(() => { result.current.handlers.onArchetypeToggle('Mystic') })
      expect(result.current.filteredPlaythroughs).toHaveLength(1)
    })

    it('returns no results when archetype has no matches', () => {
      const { result } = renderHook(() => usePlaythroughFilters(samplePlaythroughs))
      act(() => { result.current.handlers.onArchetypeToggle('Neutral') })
      expect(result.current.filteredPlaythroughs).toHaveLength(0)
    })
  })

  describe('campaign type filtering', () => {
    it('filters by single campaign type', () => {
      const { result } = renderHook(() => usePlaythroughFilters(samplePlaythroughs))
      act(() => { result.current.handlers.onCampaignTypeToggle('Full Campaign') })
      expect(result.current.filteredPlaythroughs).toHaveLength(2)
    })

    it('filters by multiple campaign types (OR logic)', () => {
      const { result } = renderHook(() => usePlaythroughFilters(samplePlaythroughs))
      act(() => { result.current.handlers.onCampaignTypeToggle('Full Campaign') })
      act(() => { result.current.handlers.onCampaignTypeToggle('Scenario Pack') })
      expect(result.current.filteredPlaythroughs).toHaveLength(3)
    })

    it('toggling same campaign type removes it', () => {
      const { result } = renderHook(() => usePlaythroughFilters(samplePlaythroughs))
      act(() => { result.current.handlers.onCampaignTypeToggle('Fan-Made') })
      expect(result.current.filteredPlaythroughs).toHaveLength(1)
      act(() => { result.current.handlers.onCampaignTypeToggle('Fan-Made') })
      expect(result.current.filteredPlaythroughs).toHaveLength(4)
    })
  })

  describe('campaign name filtering', () => {
    it('filters by specific campaign name', () => {
      const { result } = renderHook(() => usePlaythroughFilters(samplePlaythroughs))
      act(() => { result.current.handlers.onCampaignToggle('Night of the Zealot') })
      expect(result.current.filteredPlaythroughs).toHaveLength(1)
      expect(result.current.filteredPlaythroughs[0].id).toBe('pt-1')
    })

    it('uses customCampaignName when available', () => {
      const { result } = renderHook(() => usePlaythroughFilters(samplePlaythroughs))
      act(() => { result.current.handlers.onCampaignToggle('Homebrew Madness') })
      expect(result.current.filteredPlaythroughs).toHaveLength(1)
      expect(result.current.filteredPlaythroughs[0].id).toBe('pt-4')
    })
  })

  describe('combined filters (AND logic between categories)', () => {
    it('combines archetype + campaign type', () => {
      const { result } = renderHook(() => usePlaythroughFilters(samplePlaythroughs))
      act(() => { result.current.handlers.onArchetypeToggle('Guardian') })
      act(() => { result.current.handlers.onCampaignTypeToggle('Full Campaign') })
      // pt-1 is Full Campaign AND has Guardian
      expect(result.current.filteredPlaythroughs).toHaveLength(1)
      expect(result.current.filteredPlaythroughs[0].id).toBe('pt-1')
    })

    it('returns empty when combined filters have no intersection', () => {
      const { result } = renderHook(() => usePlaythroughFilters(samplePlaythroughs))
      act(() => { result.current.handlers.onArchetypeToggle('Guardian') })
      act(() => { result.current.handlers.onCampaignTypeToggle('Scenario Pack') })
      expect(result.current.filteredPlaythroughs).toHaveLength(0)
    })
  })

  describe('clearing filters', () => {
    it('clears all filters and shows all playthroughs', () => {
      const { result } = renderHook(() => usePlaythroughFilters(samplePlaythroughs))
      act(() => { result.current.handlers.onArchetypeToggle('Guardian') })
      act(() => { result.current.handlers.onCampaignTypeToggle('Full Campaign') })
      act(() => { result.current.handlers.onCampaignToggle('Night of the Zealot') })
      expect(result.current.filteredPlaythroughs.length).toBeLessThan(4)

      act(() => { result.current.handlers.onClearFilters() })
      expect(result.current.filteredPlaythroughs).toHaveLength(4)
      expect(result.current.filters.selectedArchetypes).toEqual([])
      expect(result.current.filters.selectedCampaignTypes).toEqual([])
      expect(result.current.filters.selectedCampaigns).toEqual([])
    })
  })
})
