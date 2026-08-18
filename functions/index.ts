import { logger } from 'firebase-functions'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'

import {
  COMMUNITY_STATS_OUTBOX_COLLECTION,
  processCommunityStatsQueue,
  recoverCommunityStatsQueue,
  type CommunityStatsRebuildResult,
} from './community-stats-pipeline'

function buildRetryableWakeError(source: string, result: CommunityStatsRebuildResult): Error {
  return new Error(
    `Community stats rebuild from ${source} requires retry ` +
    `(status=${result.status}, refreshState=${result.refreshState ?? 'n/a'}, ` +
    `pendingOutboxCount=${result.pendingOutboxCount ?? 0}, ` +
    `failureKind=${result.failureKind ?? 'n/a'}, skipReason=${result.skipReason ?? 'n/a'}).`,
  )
}

function shouldRetryWake(result: CommunityStatsRebuildResult): boolean {
  return result.shouldRetry === true
}

export async function handleCommunityStatsOutboxWake(source: string): Promise<void> {
  const result = await processCommunityStatsQueue()
  if (result.status === 'published') {
    if (shouldRetryWake(result)) {
      logger.info(`Community stats rebuild from ${source} published a stale intermediate result and requested a retry-backed follow-up.`, result)
      throw buildRetryableWakeError(source, result)
    }
    logger.info(`Community stats rebuild finished from ${source}.`, result)
    return
  }
  if (result.status === 'failed') {
    if (shouldRetryWake(result)) {
      logger.error(`Community stats rebuild failed from ${source}; retrying the wake event.`, result)
      throw buildRetryableWakeError(source, result)
    }
    logger.error(`Community stats rebuild failed from ${source}.`, result)
    return
  }
  if (shouldRetryWake(result)) {
    logger.info(`Community stats rebuild wake-up from ${source} deferred because another lease or follow-up pass is still pending.`, result)
    throw buildRetryableWakeError(source, result)
  }
  logger.info(`Community stats rebuild wake-up skipped from ${source}.`, result)
}

export const processCommunityStatsUserOutboxOnCreate = onDocumentCreated({
  document: `users/{userId}/${COMMUNITY_STATS_OUTBOX_COLLECTION}/{eventId}`,
  retry: true,
}, async () => {
  await handleCommunityStatsOutboxWake('user-outbox')
})

export const processCommunityStatsSystemOutboxOnCreate = onDocumentCreated({
  document: `community-stats-system/{scope}/${COMMUNITY_STATS_OUTBOX_COLLECTION}/{eventId}`,
  retry: true,
}, async () => {
  await handleCommunityStatsOutboxWake('system-outbox')
})

export const recoverCommunityStatsQueueLease = onSchedule({
  schedule: 'every 5 minutes',
  retryCount: 3,
  minBackoffSeconds: 60,
  maxBackoffSeconds: 300,
}, async () => {
  const result = await recoverCommunityStatsQueue()
  const schedulerShouldRetry = shouldRetryWake(result) && result.skipReason !== 'lease-active'
  if (result.status === 'published') {
    if (schedulerShouldRetry) {
      logger.info('Community stats sweeper published a stale intermediate result and is requesting a scheduler retry.', result)
      throw buildRetryableWakeError('sweeper', result)
    }
    logger.info('Community stats sweeper recovered or completed pending rebuild work.', result)
    return
  }
  if (result.status === 'failed') {
    if (schedulerShouldRetry) {
      logger.error('Community stats sweeper failed while recovering pending work; requesting a scheduler retry.', result)
      throw buildRetryableWakeError('sweeper', result)
    }
    logger.error('Community stats sweeper failed while recovering pending work.', result)
    return
  }
  if (result.skipReason === 'lease-active') {
    logger.info('Community stats sweeper found an active lease and left the in-flight worker to finish.', result)
    return
  }
  logger.info('Community stats sweeper found no recoverable work.', result)
})
