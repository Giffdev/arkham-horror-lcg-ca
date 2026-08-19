const STRICT_SAFE_ASCII_DOCUMENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/
const FIRESTORE_RESERVED_DOCUMENT_ID_PATTERN = /^__.*__$/

function controlDocumentId(value: string): string {
  if (
    !STRICT_SAFE_ASCII_DOCUMENT_ID_PATTERN.test(value) ||
    FIRESTORE_RESERVED_DOCUMENT_ID_PATTERN.test(value)
  ) {
    throw new Error(`Invalid community stats control document ID: ${value}`)
  }
  return value
}

export const COMMUNITY_STATS_INTERNAL_COLLECTION_ID =
  controlDocumentId('community-stats-internal')
export const COMMUNITY_STATS_PUBLISHER_DOCUMENT_ID =
  controlDocumentId('contribution-publisher')
export const COMMUNITY_STATS_RECOVERY_CURSOR_DOCUMENT_ID =
  controlDocumentId('recovery-cursor')
export const COMMUNITY_STATS_BOOTSTRAP_LEASE_OWNER_ID =
  controlDocumentId('bootstrap-publisher')

export const COMMUNITY_STATS_STATE_DOC_PATH =
  `${COMMUNITY_STATS_INTERNAL_COLLECTION_ID}/${COMMUNITY_STATS_PUBLISHER_DOCUMENT_ID}`
export const COMMUNITY_STATS_RECOVERY_CURSOR_DOC_PATH =
  `${COMMUNITY_STATS_INTERNAL_COLLECTION_ID}/${COMMUNITY_STATS_RECOVERY_CURSOR_DOCUMENT_ID}`

export const COMMUNITY_STATS_CONTROL_DOCUMENT_IDS = [
  COMMUNITY_STATS_PUBLISHER_DOCUMENT_ID,
  COMMUNITY_STATS_RECOVERY_CURSOR_DOCUMENT_ID,
  COMMUNITY_STATS_BOOTSTRAP_LEASE_OWNER_ID,
] as const
