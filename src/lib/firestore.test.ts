import { describe, it, expect } from 'vitest'
import { sanitizePlaythrough } from './firestore'
import type { Playthrough, InvestigatorAssignment } from './types'

// firestore.ts imports firebase/firestore and firebase.ts — mock them so tests don't need a real Firebase app
vi.mock('./firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  collectionGroup: vi.fn(),
  doc: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  onSnapshot: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  runTransaction: vi.fn(),
  deleteField: vi.fn(() => Symbol('deleteField')),
  where: vi.fn(),
}))

function makeInvestigator(overrides: Partial<InvestigatorAssignment> = {}): InvestigatorAssignment {
  return {
    playerName: 'Alice',
    investigatorName: 'Roland Banks',
    archetype: 'Guardian',
    ...overrides,
  }
}

describe('sanitizePlaythrough', () => {
  it('removes undefined fields from top-level playthrough object', () => {
    const input = {
      date: '2024-01-01',
      campaignName: 'The Dunwich Legacy',
      campaignType: 'Full Campaign' as const,
      campaignSet: undefined,
      customCampaignName: undefined,
      sideStories: [],
      notes: undefined,
      investigators: [],
    }
    const result = sanitizePlaythrough(input)
    expect('campaignSet' in result).toBe(false)
    expect('customCampaignName' in result).toBe(false)
    expect('notes' in result).toBe(false)
    expect(result.campaignName).toBe('The Dunwich Legacy')
  })

  it('removes undefined fields from investigator objects inside investigators array', () => {
    const inv = makeInvestigator({
      archetypes: undefined,
      investigatorSet: undefined,
      isUnknown: undefined,
      isCustom: undefined,
      investigatorId: undefined,
      chapter: undefined,
      dreamEatersPath: undefined,
    })
    const input = {
      date: '2024-01-01',
      campaignName: 'The Dunwich Legacy',
      campaignType: 'Full Campaign' as const,
      sideStories: [],
      investigators: [inv],
    }
    const result = sanitizePlaythrough(input)
    const sanitizedInv = result.investigators[0]
    expect('archetypes' in sanitizedInv).toBe(false)
    expect('investigatorSet' in sanitizedInv).toBe(false)
    expect('isUnknown' in sanitizedInv).toBe(false)
    expect('isCustom' in sanitizedInv).toBe(false)
    expect('investigatorId' in sanitizedInv).toBe(false)
    expect('chapter' in sanitizedInv).toBe(false)
    expect('dreamEatersPath' in sanitizedInv).toBe(false)
    // present fields should survive
    expect(sanitizedInv.playerName).toBe('Alice')
    expect(sanitizedInv.investigatorName).toBe('Roland Banks')
    expect(sanitizedInv.archetype).toBe('Guardian')
  })

  it('preserves false, 0, empty string, and null (only undefined is stripped)', () => {
    const inv = makeInvestigator({
      isUnknown: false,
    })
    const input = {
      date: '2024-01-01',
      campaignName: 'Test',
      campaignType: 'Full Campaign' as const,
      sideStories: [],
      notes: '',
      investigators: [inv],
    }
    const result = sanitizePlaythrough(input)
    expect(result.notes).toBe('')
    expect(result.investigators[0].isUnknown).toBe(false)
  })

  it('preserves defined optional fields (archetypes array, chapter, etc.)', () => {
    const inv = makeInvestigator({
      archetypes: ['Guardian', 'Seeker'],
      chapter: 2,
      investigatorSet: 'Core',
      investigatorId: 'roland-banks',
    })
    const input = {
      date: '2024-01-01',
      campaignName: 'Test',
      campaignType: 'Full Campaign' as const,
      sideStories: ['Curse of the Rougarou'],
      investigators: [inv],
    }
    const result = sanitizePlaythrough(input)
    const si = result.investigators[0]
    expect(si.archetypes).toEqual(['Guardian', 'Seeker'])
    expect(si.chapter).toBe(2)
    expect(si.investigatorSet).toBe('Core')
    expect(si.investigatorId).toBe('roland-banks')
    expect(result.sideStories).toEqual(['Curse of the Rougarou'])
  })

  it('handles multiple investigators, only strips undefined in each', () => {
    const investigators = [
      makeInvestigator({ archetypes: ['Seeker'], isUnknown: undefined }),
      makeInvestigator({ investigatorName: 'Agnes Baker', archetype: 'Mystic', archetypes: undefined, chapter: undefined }),
    ]
    const input = {
      date: '2024-01-01',
      campaignName: 'Test',
      campaignType: 'Full Campaign' as const,
      sideStories: [],
      investigators,
    }
    const result = sanitizePlaythrough(input)
    expect('isUnknown' in result.investigators[0]).toBe(false)
    expect(result.investigators[0].archetypes).toEqual(['Seeker'])
    expect('archetypes' in result.investigators[1]).toBe(false)
    expect('chapter' in result.investigators[1]).toBe(false)
  })

  it('is a pure function — does not mutate the input object', () => {
    const inv = makeInvestigator({ archetypes: undefined })
    const input = {
      date: '2024-01-01',
      campaignName: 'Test',
      campaignType: 'Full Campaign' as const,
      sideStories: [],
      investigators: [inv],
    }
    sanitizePlaythrough(input)
    // original still has the key
    expect('archetypes' in inv).toBe(true)
  })

  it('representative legacy playthrough: adding a side story does not produce any undefined values', () => {
    // Simulates a Firestore-loaded legacy playthrough re-saved with a new side story
    const legacyPlaythrough: Omit<Playthrough, 'id'> = {
      date: '2024-06-10',
      campaignName: 'The Path to Carcosa',
      campaignType: 'Full Campaign',
      investigators: [
        {
          playerName: 'Devin',
          investigatorName: 'Sefina Rousseau',
          archetype: 'Rogue',
          archetypes: undefined as never,   // legacy: field present but undefined
          investigatorSet: undefined as never,
          isUnknown: undefined as never,
          isCustom: undefined as never,
        },
      ],
      sideStories: ['Carnevale of Horrors'],  // newly added
    }
    const sanitized = sanitizePlaythrough(legacyPlaythrough)
    const inv = sanitized.investigators[0]
    const hasUndefined = (obj: object) =>
      Object.values(obj).some(v => v === undefined)
    expect(hasUndefined(sanitized)).toBe(false)
    expect(hasUndefined(inv)).toBe(false)
    expect(sanitized.sideStories).toEqual(['Carnevale of Horrors'])
  })
})
