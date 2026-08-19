import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { COMMUNITY_STATS_BOOTSTRAP_LEASE_OWNER_ID } from './community-stats-control-ids'
import { rebuildUserContribution } from './community-stats-contributions'
import { getBackendFirestore } from './google-cloud'

const emulatorEnabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST)
const describeEmulator = emulatorEnabled ? describe : describe.skip

describeEmulator('community stats contributions against Firestore emulator', () => {
  beforeAll(async () => {
    process.env.COMMUNITY_STATS_FIREBASE_PROJECT_ID = 'demo-arkham-horror-lcg-ca'
  })

  beforeEach(async () => {
    const db = getBackendFirestore()
    await Promise.all([
      db.recursiveDelete(db.collection('users')),
      db.recursiveDelete(db.collection('community-stats-contributions')),
      db.recursiveDelete(db.collection('community-stats-quarantine')),
      db.recursiveDelete(db.collection('community-stats')),
      db.recursiveDelete(db.collection('community-stats-internal')),
    ])
  })

  afterAll(async () => {
    await getBackendFirestore().terminate()
  })

  it('accepts the bootstrap lease owner in the actual Firestore outbox query path', async () => {
    const snapshot = await getBackendFirestore()
      .collection(`users/${COMMUNITY_STATS_BOOTSTRAP_LEASE_OWNER_ID}/communityStatsOutbox`)
      .limit(1)
      .get()

    expect(snapshot.empty).toBe(true)
  })

  it('replaces one owner contribution without reading or copying another owner raw document', async () => {
    const db = getBackendFirestore()
    await db.doc('users/u1/playthroughs/game-1').set({
      date: '2026-08-01',
      campaignName: 'The Path to Carcosa',
      campaignType: 'Full Campaign',
      investigators: [{
        playerName: 'PRIVATE U1 PLAYER',
        investigatorName: 'Roland Banks',
        investigatorId: '01001',
        archetype: 'Guardian',
      }],
      notes: 'PRIVATE U1 NOTES',
    })
    await db.doc('users/u1/communityStatsOutbox/event-1').set({
      mutationId: 'event-1',
      requestedAtMs: Date.now(),
      requestedBy: 'client',
      reason: 'playthrough-write',
      affectedDocuments: 1,
    })
    await db.doc('users/u2/playthroughs/game-2').set({
      date: '2026-08-02',
      campaignName: 'The Dunwich Legacy',
      campaignType: 'Full Campaign',
      investigators: [{
        playerName: 'PRIVATE U2 PLAYER',
        investigatorName: 'Jenny Barnes',
        investigatorId: '02003',
        archetype: 'Rogue',
      }],
    })
    await db.doc('users/u2/communityStatsOutbox/event-2').set({
      mutationId: 'event-2',
      requestedAtMs: Date.now(),
      requestedBy: 'client',
      reason: 'playthrough-write',
      affectedDocuments: 1,
    })

    const first = await rebuildUserContribution('u1')
    expect(first.status).toBe('published')
    const u1Contribution = await db.doc('community-stats-contributions/u1').get()
    expect(JSON.stringify(u1Contribution.data())).not.toContain('PRIVATE')
    expect((await db.doc('users/u2/communityStatsOutbox/event-2').get()).exists).toBe(true)

    const second = await rebuildUserContribution('u2')
    expect(second.status).toBe('published')
    const aggregate = (await db.doc('community-stats/global').get()).data()
    expect(aggregate).toMatchObject({
      totalGames: 2,
      registeredUsers: 2,
      refreshState: 'ready',
    })
    expect(aggregate?.topCampaigns).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'The Path to Carcosa', count: 1 }),
      expect.objectContaining({ name: 'The Dunwich Legacy', count: 1 }),
    ]))
  })

  it('keeps an empty registered owner through game creation and deletion replacements', async () => {
    const db = getBackendFirestore()
    await db.doc('users/empty/communityStatsOutbox/create').set({
      mutationId: 'create',
      requestedAtMs: 1,
      requestedBy: 'client',
      reason: 'user-create',
      affectedDocuments: 1,
    })

    expect(await rebuildUserContribution('empty')).toMatchObject({
      status: 'published',
      refreshState: 'ready',
    })
    expect((await db.doc('community-stats/global').get()).data()).toMatchObject({
      registeredUsers: 1,
      totalGames: 0,
    })

    await db.doc('users/empty/playthroughs/game-1').set({
      date: '2026-08-18',
      campaignName: 'The Path to Carcosa',
      campaignType: 'Full Campaign',
      investigators: [],
    })
    await db.doc('users/empty/communityStatsOutbox/write').set({
      mutationId: 'write',
      requestedAtMs: 2,
      requestedBy: 'client',
      reason: 'playthrough-write',
      affectedDocuments: 1,
    })
    await rebuildUserContribution('empty')
    expect((await db.doc('community-stats/global').get()).data()).toMatchObject({
      registeredUsers: 1,
      totalGames: 1,
    })

    await db.doc('users/empty/playthroughs/game-1').delete()
    await db.doc('users/empty/communityStatsOutbox/delete').set({
      mutationId: 'delete',
      requestedAtMs: 3,
      requestedBy: 'client',
      reason: 'playthrough-delete',
      affectedDocuments: 1,
    })
    await rebuildUserContribution('empty')
    expect((await db.doc('community-stats/global').get()).data()).toMatchObject({
      registeredUsers: 1,
      totalGames: 0,
      refreshState: 'ready',
    })
  })

  it('quarantines deterministic source failures without replacing contributions or totals', async () => {
    const db = getBackendFirestore()
    for (const uid of ['poison', 'healthy']) {
      await db.doc(`users/${uid}/playthroughs/game-1`).set({
        date: '2026-08-18',
        campaignName: 'The Path to Carcosa',
        campaignType: 'Full Campaign',
        investigators: [],
      })
      await db.doc(`users/${uid}/communityStatsOutbox/initial`).set({
        mutationId: 'initial',
        requestedAtMs: 1,
        requestedBy: 'client',
        reason: 'playthrough-write',
        affectedDocuments: 1,
      })
      await rebuildUserContribution(uid)
    }

    await db.doc('users/poison/playthroughs/game-1').set({
      date: '2026-08-18',
      campaignName: 'The Path to Carcosa',
      campaignType: 'Full Campaign',
      investigators: null,
    })
    await db.doc('users/poison/communityStatsOutbox/malformed').set({
      mutationId: 'malformed',
      requestedAtMs: 2,
      requestedBy: 'client',
      reason: 'playthrough-write',
      affectedDocuments: 1,
    })

    expect(await rebuildUserContribution('poison')).toMatchObject({
      status: 'failed',
      failureKind: 'poison',
      processedOutboxCount: 1,
      shouldRetry: false,
    })
    expect((await db.doc('community-stats-contributions/poison').get()).data())
      .toMatchObject({ totalGames: 1 })
    expect((await db.doc('community-stats/global').get()).data()).toMatchObject({
      registeredUsers: 2,
      totalGames: 2,
      refreshState: 'failed',
    })
    expect((await db.doc('community-stats-quarantine/poison').get()).exists).toBe(true)
    expect((await db.doc('users/poison/communityStatsOutbox/malformed').get()).exists).toBe(false)

    expect(await rebuildUserContribution('poison')).toEqual({
      status: 'skipped',
      skipReason: 'no-pending-work',
    })

    await db.doc('users/healthy/communityStatsOutbox/recovery').set({
      mutationId: 'recovery',
      requestedAtMs: 3,
      requestedBy: 'client',
      reason: 'playthrough-write',
      affectedDocuments: 1,
    })
    await rebuildUserContribution('healthy')
    expect((await db.doc('community-stats/global').get()).data()).toMatchObject({
      registeredUsers: 2,
      totalGames: 2,
      refreshState: 'failed',
    })
  })
})
