import { deleteApp, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { rebuildUserContribution } from './community-stats-contributions'

const emulatorEnabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST)
const describeEmulator = emulatorEnabled ? describe : describe.skip

describeEmulator('community stats contributions against Firestore emulator', () => {
  beforeAll(async () => {
    for (const app of getApps()) await deleteApp(app)
    initializeApp({ projectId: 'demo-arkham-horror-lcg-ca' })
    const db = getFirestore()
    await Promise.all([
      db.recursiveDelete(db.collection('users')),
      db.recursiveDelete(db.collection('community-stats-contributions')),
      db.recursiveDelete(db.collection('community-stats')),
      db.recursiveDelete(db.collection('community-stats-internal')),
    ])
  })

  afterAll(async () => {
    for (const app of getApps()) await deleteApp(app)
  })

  it('replaces one owner contribution without reading or copying another owner raw document', async () => {
    const db = getFirestore()
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
})
