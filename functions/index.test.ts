import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockedDeps = vi.hoisted(() => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
  processCommunityStatsQueue: vi.fn(),
  recoverCommunityStatsQueue: vi.fn(),
}))

vi.mock('firebase-functions', () => ({
  logger: mockedDeps.logger,
}))

vi.mock('firebase-functions/v2/firestore', () => ({
  onDocumentCreated: vi.fn((_options: unknown, handler: unknown) => handler),
}))

vi.mock('firebase-functions/v2/scheduler', () => ({
  onSchedule: vi.fn((_options: unknown, handler: unknown) => handler),
}))

vi.mock('./community-stats-pipeline', () => ({
  COMMUNITY_STATS_OUTBOX_COLLECTION: 'communityStatsOutbox',
  processCommunityStatsQueue: mockedDeps.processCommunityStatsQueue,
  recoverCommunityStatsQueue: mockedDeps.recoverCommunityStatsQueue,
}))

import { handleCommunityStatsOutboxWake, recoverCommunityStatsQueueLease } from './index'

const { logger, processCommunityStatsQueue, recoverCommunityStatsQueue } = mockedDeps
const scheduledRecover = recoverCommunityStatsQueueLease as unknown as () => Promise<void>

describe('community stats trigger retry handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns normally after a ready publish', async () => {
    processCommunityStatsQueue.mockResolvedValue({
      status: 'published',
      refreshState: 'ready',
      pendingOutboxCount: 0,
    })

    await expect(handleCommunityStatsOutboxWake('user-outbox')).resolves.toBeUndefined()
    expect(logger.info).toHaveBeenCalledWith(
      'Community stats rebuild finished from user-outbox.',
      expect.objectContaining({ status: 'published', refreshState: 'ready' }),
    )
  })

  it('throws so Eventarc retry handles transient failures', async () => {
    processCommunityStatsQueue.mockResolvedValue({
      status: 'failed',
      failureKind: 'transient',
      shouldRetry: true,
      pendingOutboxCount: 1,
    })

    await expect(handleCommunityStatsOutboxWake('user-outbox')).rejects.toThrow(/requires retry/i)
    expect(logger.error).toHaveBeenCalledWith(
      'Community stats rebuild failed from user-outbox; retrying the wake event.',
      expect.objectContaining({ failureKind: 'transient', shouldRetry: true }),
    )
  })

  it('throws so Eventarc retry can continue draining stale intermediate publishes', async () => {
    processCommunityStatsQueue.mockResolvedValue({
      status: 'published',
      refreshState: 'stale',
      shouldRetry: true,
      pendingOutboxCount: 1,
    })

    await expect(handleCommunityStatsOutboxWake('user-outbox')).rejects.toThrow(/requires retry/i)
    expect(logger.info).toHaveBeenCalledWith(
      'Community stats rebuild from user-outbox published a stale intermediate result and requested a retry-backed follow-up.',
      expect.objectContaining({ refreshState: 'stale', shouldRetry: true }),
    )
  })

  it('throws so Eventarc retry re-wakes when another lease is active', async () => {
    processCommunityStatsQueue.mockResolvedValue({
      status: 'skipped',
      skipReason: 'lease-active',
      shouldRetry: true,
      pendingOutboxCount: 1,
    })

    await expect(handleCommunityStatsOutboxWake('system-outbox')).rejects.toThrow(/requires retry/i)
    expect(logger.info).toHaveBeenCalledWith(
      'Community stats rebuild wake-up from system-outbox deferred because another lease or follow-up pass is still pending.',
      expect.objectContaining({ skipReason: 'lease-active', shouldRetry: true }),
    )
  })

  it('does not throw after quarantining poison outbox events', async () => {
    processCommunityStatsQueue.mockResolvedValue({
      status: 'failed',
      failureKind: 'poison',
      shouldRetry: false,
      pendingOutboxCount: 1,
    })

    await expect(handleCommunityStatsOutboxWake('user-outbox')).resolves.toBeUndefined()
    expect(logger.error).toHaveBeenCalledWith(
      'Community stats rebuild failed from user-outbox.',
      expect.objectContaining({ failureKind: 'poison', shouldRetry: false }),
    )
  })

  it('throws from the scheduler on retryable recovery failures but not on lease-active skips', async () => {
    recoverCommunityStatsQueue.mockResolvedValueOnce({
      status: 'failed',
      failureKind: 'transient',
      shouldRetry: true,
      pendingOutboxCount: 1,
    })

    await expect(scheduledRecover()).rejects.toThrow(/requires retry/i)
    expect(logger.error).toHaveBeenCalledWith(
      'Community stats sweeper failed while recovering pending work; requesting a scheduler retry.',
      expect.objectContaining({ failureKind: 'transient', shouldRetry: true }),
    )

    recoverCommunityStatsQueue.mockResolvedValueOnce({
      status: 'skipped',
      skipReason: 'lease-active',
      shouldRetry: true,
      pendingOutboxCount: 1,
    })

    await expect(scheduledRecover()).resolves.toBeUndefined()
    expect(logger.info).toHaveBeenCalledWith(
      'Community stats sweeper found an active lease and left the in-flight worker to finish.',
      expect.objectContaining({ skipReason: 'lease-active', shouldRetry: true }),
    )
  })
})
