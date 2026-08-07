import { describe, expect, it } from 'vitest'
import { INVESTIGATORS } from './investigator-data'
import { matchesSearchText } from './search'

describe('investigator search', () => {
  it('matches an accented investigator name with an unaccented query', () => {
    const andre = INVESTIGATORS.find(investigator => investigator.id === 'andre-patel')

    expect(andre?.name).toBe('André Patel')
    expect(matchesSearchText(andre?.name ?? '', 'Andre')).toBe(true)
  })

  it('matches accented and unaccented variants consistently', () => {
    expect(matchesSearchText('Andre Patel', 'André')).toBe(true)
    expect(matchesSearchText('ÁGNES Baker', 'agnes')).toBe(true)
  })
})
