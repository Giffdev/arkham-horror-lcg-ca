import { formatDate, todayDateInputValue } from './date-utils'

describe('todayDateInputValue', () => {
  it('formats the local calendar date without converting through UTC', () => {
    expect(todayDateInputValue(new Date(2026, 7, 18, 19, 30))).toBe('2026-08-18')
  })
})

describe('formatDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-28T15:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('recent dates (within 7 days)', () => {
    it('formats today as relative time', () => {
      const result = formatDate('2026-04-28T10:00:00')
      expect(result).toMatch(/hours? ago/)
    })

    it('formats yesterday as relative time', () => {
      const result = formatDate('2026-04-27T15:00:00')
      expect(result).toMatch(/1 day ago/)
    })

    it('formats 6 days ago as relative time', () => {
      const result = formatDate('2026-04-22T15:00:00')
      expect(result).toMatch(/6 days ago/)
    })
  })

  describe('older dates (7+ days)', () => {
    it('formats dates 7+ days old as "MMM d, yyyy"', () => {
      const result = formatDate('2026-04-20T15:00:00')
      expect(result).toBe('Apr 20, 2026')
    })

    it('formats dates from previous months', () => {
      const result = formatDate('2026-01-15T12:00:00')
      expect(result).toBe('Jan 15, 2026')
    })

    it('formats dates from previous years', () => {
      const result = formatDate('2024-12-25T12:00:00')
      expect(result).toBe('Dec 25, 2024')
    })
  })

  describe('edge cases', () => {
    it('handles date at exactly 7 days boundary', () => {
      const result = formatDate('2026-04-21T15:00:00')
      // 7 days ago → should use absolute format
      expect(result).toBe('Apr 21, 2026')
    })

    it('handles ISO date strings with explicit time', () => {
      const result = formatDate('2025-06-15T12:00:00')
      expect(result).toBe('Jun 15, 2025')
    })
  })
})
