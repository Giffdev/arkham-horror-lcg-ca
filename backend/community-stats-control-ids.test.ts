import { describe, expect, it } from 'vitest'

import {
  COMMUNITY_STATS_BOOTSTRAP_LEASE_OWNER_ID,
  COMMUNITY_STATS_CONTROL_DOCUMENT_IDS,
  COMMUNITY_STATS_RECOVERY_CURSOR_DOC_PATH,
  COMMUNITY_STATS_STATE_DOC_PATH,
} from './community-stats-control-ids'

describe('community stats Firestore control IDs', () => {
  it('uses strict safe ASCII IDs and never Firestore reserved document IDs', () => {
    for (const id of COMMUNITY_STATS_CONTROL_DOCUMENT_IDS) {
      expect(id).toMatch(/^[A-Za-z0-9][A-Za-z0-9_-]*$/)
      expect(id).not.toMatch(/^__.*__$/)
      expect(id).not.toContain('/')
    }
  })

  it('keeps bootstrap and server control paths on the centralized safe IDs', () => {
    expect(COMMUNITY_STATS_BOOTSTRAP_LEASE_OWNER_ID).toBe('bootstrap-publisher')
    expect(COMMUNITY_STATS_STATE_DOC_PATH).toBe(
      'community-stats-internal/contribution-publisher',
    )
    expect(COMMUNITY_STATS_RECOVERY_CURSOR_DOC_PATH).toBe(
      'community-stats-internal/recovery-cursor',
    )
  })
})
