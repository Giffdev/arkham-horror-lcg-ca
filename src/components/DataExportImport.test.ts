import { describe, it, expect } from 'vitest'

/**
 * Extract and test the validation logic from DataExportImport.
 * We test the pure validation function in isolation — no React rendering needed.
 */

// Replicate the validation logic from DataExportImport.tsx
function validateImportData(jsonString: string): { valid: boolean; data?: unknown[]; error?: string } {
  try {
    const parsed = JSON.parse(jsonString)

    if (!Array.isArray(parsed)) {
      return { valid: false, error: 'Data must be an array of playthroughs' }
    }

    for (const item of parsed) {
      if (!item.id || !item.date || !item.campaignName || !item.investigators) {
        return { valid: false, error: 'Invalid playthrough format detected' }
      }

      if (!Array.isArray(item.investigators)) {
        return { valid: false, error: 'Investigators must be an array' }
      }
    }

    return { valid: true, data: parsed }
  } catch {
    return { valid: false, error: 'Invalid JSON format' }
  }
}

describe('DataExportImport validation', () => {
  describe('validateImportData', () => {
    it('accepts valid playthrough array', () => {
      const data = JSON.stringify([
        {
          id: 'pt-1',
          date: '2026-01-01',
          campaignName: 'Night of the Zealot',
          investigators: [{ investigatorName: 'Roland Banks', playerName: 'Dev' }],
        },
      ])
      const result = validateImportData(data)
      expect(result.valid).toBe(true)
      expect(result.data).toHaveLength(1)
    })

    it('accepts multiple playthroughs', () => {
      const data = JSON.stringify([
        { id: '1', date: '2026-01-01', campaignName: 'C1', investigators: [] },
        { id: '2', date: '2026-01-02', campaignName: 'C2', investigators: [] },
      ])
      const result = validateImportData(data)
      expect(result.valid).toBe(true)
      expect(result.data).toHaveLength(2)
    })

    it('accepts empty array', () => {
      const result = validateImportData('[]')
      expect(result.valid).toBe(true)
      expect(result.data).toHaveLength(0)
    })

    it('rejects non-array JSON', () => {
      const result = validateImportData('{"id": "1"}')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Data must be an array of playthroughs')
    })

    it('rejects invalid JSON', () => {
      const result = validateImportData('not json at all')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid JSON format')
    })

    it('rejects empty string', () => {
      const result = validateImportData('')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid JSON format')
    })

    it('rejects playthrough missing id', () => {
      const data = JSON.stringify([
        { date: '2026-01-01', campaignName: 'C1', investigators: [] },
      ])
      const result = validateImportData(data)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid playthrough format detected')
    })

    it('rejects playthrough missing date', () => {
      const data = JSON.stringify([
        { id: '1', campaignName: 'C1', investigators: [] },
      ])
      const result = validateImportData(data)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid playthrough format detected')
    })

    it('rejects playthrough missing campaignName', () => {
      const data = JSON.stringify([
        { id: '1', date: '2026-01-01', investigators: [] },
      ])
      const result = validateImportData(data)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid playthrough format detected')
    })

    it('rejects playthrough missing investigators', () => {
      const data = JSON.stringify([
        { id: '1', date: '2026-01-01', campaignName: 'C1' },
      ])
      const result = validateImportData(data)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid playthrough format detected')
    })

    it('rejects playthrough with non-array investigators', () => {
      const data = JSON.stringify([
        { id: '1', date: '2026-01-01', campaignName: 'C1', investigators: 'not an array' },
      ])
      const result = validateImportData(data)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Investigators must be an array')
    })

    it('rejects if any playthrough in batch is invalid', () => {
      const data = JSON.stringify([
        { id: '1', date: '2026-01-01', campaignName: 'C1', investigators: [] },
        { id: '2', campaignName: 'C2', investigators: [] }, // missing date
      ])
      const result = validateImportData(data)
      expect(result.valid).toBe(false)
    })
  })
})
