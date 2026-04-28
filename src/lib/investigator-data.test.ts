import { describe, it, expect } from 'vitest'
import {
  INVESTIGATORS,
  INVESTIGATOR_SETS,
  DUAL_CHAPTER_NAMES,
  getInvestigatorById,
  getInvestigatorByName,
  getInvestigatorsByArchetype,
  resolveInvestigator,
  getAllInvestigatorNames,
  isDualClassInvestigator,
  getChapterBadgeLabel,
  isChapterBadgeSpecial,
  getArkhamDBUrl,
  getArkhamDBUrlById,
  getInvestigatorDisplayName,
  getDisplaySetName,
} from './investigator-data'

describe('investigator-data', () => {
  describe('INVESTIGATORS dataset', () => {
    it('contains investigators', () => {
      expect(INVESTIGATORS.length).toBeGreaterThan(50)
    })

    it('all investigators have required fields', () => {
      for (const inv of INVESTIGATORS) {
        expect(inv.id).toBeTruthy()
        expect(inv.name).toBeTruthy()
        expect([1, 2]).toContain(inv.chapter)
        expect(inv.archetypes.length).toBeGreaterThan(0)
        expect(inv.set).toBeTruthy()
      }
    })

    it('has no duplicate IDs', () => {
      const ids = INVESTIGATORS.map(i => i.id)
      expect(new Set(ids).size).toBe(ids.length)
    })
  })

  describe('getInvestigatorById', () => {
    it('returns investigator for valid id', () => {
      const roland = getInvestigatorById('roland-banks')
      expect(roland).toBeDefined()
      expect(roland!.name).toBe('Roland Banks')
      expect(roland!.archetypes).toEqual(['Guardian'])
    })

    it('returns undefined for invalid id', () => {
      expect(getInvestigatorById('nonexistent')).toBeUndefined()
    })
  })

  describe('getInvestigatorByName', () => {
    it('returns Ch.1 investigator by default', () => {
      const joe = getInvestigatorByName('Joe Diamond')
      expect(joe).toBeDefined()
      expect(joe!.chapter).toBe(1)
    })

    it('returns Ch.2 investigator when chapter specified', () => {
      const joe = getInvestigatorByName('Joe Diamond', 2)
      expect(joe).toBeDefined()
      expect(joe!.chapter).toBe(2)
      expect(joe!.set).toBe('Core 2026')
    })

    it('returns undefined for unknown name', () => {
      expect(getInvestigatorByName('Nobody Real')).toBeUndefined()
    })
  })

  describe('getInvestigatorsByArchetype', () => {
    it('returns only investigators of the given archetype', () => {
      const guardians = getInvestigatorsByArchetype('Guardian')
      expect(guardians.length).toBeGreaterThan(5)
      for (const g of guardians) {
        expect(g.archetypes).toContain('Guardian')
      }
    })

    it('includes dual-class investigators', () => {
      const seekers = getInvestigatorsByArchetype('Seeker')
      const agatha = seekers.find(i => i.id === 'agatha-crane')
      expect(agatha).toBeDefined()
      expect(agatha!.archetypes).toContain('Mystic')
    })
  })

  describe('resolveInvestigator', () => {
    it('resolves by investigatorId first', () => {
      const result = resolveInvestigator({
        investigatorId: 'agnes-baker',
        investigatorName: 'Wrong Name',
      })
      expect(result).toBeDefined()
      expect(result!.name).toBe('Agnes Baker')
    })

    it('falls back to name + chapter when no id', () => {
      const result = resolveInvestigator({
        investigatorName: 'Joe Diamond',
        chapter: 2,
      })
      expect(result).toBeDefined()
      expect(result!.chapter).toBe(2)
    })

    it('defaults to Ch.1 when no chapter specified', () => {
      const result = resolveInvestigator({
        investigatorName: 'Trish Scarborough',
      })
      expect(result).toBeDefined()
      expect(result!.chapter).toBe(1)
    })

    it('returns undefined for unknown investigator', () => {
      expect(resolveInvestigator({ investigatorName: 'Ghost' })).toBeUndefined()
    })
  })

  describe('getAllInvestigatorNames', () => {
    it('returns sorted unique names', () => {
      const names = getAllInvestigatorNames()
      expect(names.length).toBeGreaterThan(0)
      // Check sorted
      const sorted = [...names].sort()
      expect(names).toEqual(sorted)
      // Check unique
      expect(new Set(names).size).toBe(names.length)
    })
  })

  describe('isDualClassInvestigator', () => {
    it('returns true for Agatha Crane', () => {
      expect(isDualClassInvestigator('Agatha Crane')).toBe(true)
    })

    it('returns false for Roland Banks', () => {
      expect(isDualClassInvestigator('Roland Banks')).toBe(false)
    })

    it('returns false for unknown name', () => {
      expect(isDualClassInvestigator('Nobody')).toBe(false)
    })
  })

  describe('getChapterBadgeLabel', () => {
    it('returns "Parallel" for parallel set', () => {
      expect(getChapterBadgeLabel({ set: 'Parallel', chapter: 1 })).toBe('Parallel')
    })

    it('returns "Ch. 1" for chapter 1', () => {
      expect(getChapterBadgeLabel({ chapter: 1 })).toBe('Ch. 1')
    })

    it('returns "Ch. 2" for chapter 2', () => {
      expect(getChapterBadgeLabel({ chapter: 2 })).toBe('Ch. 2')
    })

    it('defaults to "Ch. 1" when no chapter', () => {
      expect(getChapterBadgeLabel({})).toBe('Ch. 1')
    })
  })

  describe('isChapterBadgeSpecial', () => {
    it('returns true for parallel', () => {
      expect(isChapterBadgeSpecial({ set: 'Parallel' })).toBe(true)
    })

    it('returns true for chapter 2', () => {
      expect(isChapterBadgeSpecial({ chapter: 2 })).toBe(true)
    })

    it('returns false for standard chapter 1', () => {
      expect(isChapterBadgeSpecial({ set: 'Core', chapter: 1 })).toBe(false)
    })
  })

  describe('getArkhamDBUrl', () => {
    it('returns URL for investigator with string code', () => {
      const url = getArkhamDBUrl('Roland Banks')
      expect(url).toBe('https://arkhamdb.com/card/01001')
    })

    it('returns URL for dual-class with specific archetype', () => {
      const url = getArkhamDBUrl('Agatha Crane', 'Mystic')
      expect(url).toBe('https://arkhamdb.com/card/11008')
    })

    it('returns first code for dual-class without archetype', () => {
      const url = getArkhamDBUrl('Agatha Crane')
      expect(url).toBe('https://arkhamdb.com/card/11007')
    })

    it('returns null for Barkham Horror investigators', () => {
      const url = getArkhamDBUrl('Bark Harrigan')
      expect(url).toBeNull()
    })

    it('returns null for unknown investigator', () => {
      expect(getArkhamDBUrl('Nobody')).toBeNull()
    })
  })

  describe('getArkhamDBUrlById', () => {
    it('returns URL for valid id', () => {
      expect(getArkhamDBUrlById('roland-banks')).toBe('https://arkhamdb.com/card/01001')
    })

    it('returns null for null arkhamDbCode', () => {
      expect(getArkhamDBUrlById('bark-harrigan')).toBeNull()
    })
  })

  describe('getInvestigatorDisplayName', () => {
    it('adds chapter suffix for dual-chapter investigators', () => {
      const joe1 = getInvestigatorById('joe-diamond')!
      expect(getInvestigatorDisplayName(joe1)).toBe('Joe Diamond (Ch. 1)')
    })

    it('returns plain name for unique investigators', () => {
      const roland = getInvestigatorById('roland-banks')!
      expect(getInvestigatorDisplayName(roland)).toBe('Roland Banks')
    })
  })

  describe('DUAL_CHAPTER_NAMES', () => {
    it('contains names that appear in both chapters', () => {
      expect(DUAL_CHAPTER_NAMES.has('Joe Diamond')).toBe(true)
      expect(DUAL_CHAPTER_NAMES.has('Trish Scarborough')).toBe(true)
    })

    it('does not contain unique names', () => {
      expect(DUAL_CHAPTER_NAMES.has('Roland Banks')).toBe(false)
    })
  })

  describe('INVESTIGATOR_SETS', () => {
    it('lists all sets in order', () => {
      expect(INVESTIGATOR_SETS[0]).toBe('Core')
      expect(INVESTIGATOR_SETS).toContain('The Dunwich Legacy')
      expect(INVESTIGATOR_SETS).toContain('Core 2026')
    })
  })
})
