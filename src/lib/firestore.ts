import {
  collection,
  collectionGroup,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  getDoc,
  getDocs,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import { Playthrough } from './types'
import { CommunityStats } from './community-stats'

// --- Playthroughs ---

export function playthroughsCollection(uid: string) {
  return collection(db, 'users', uid, 'playthroughs')
}

export function subscribeToPlaythroughs(
  uid: string,
  callback: (playthroughs: Playthrough[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(playthroughsCollection(uid), orderBy('date', 'desc'))
  return onSnapshot(
    q,
    (snapshot) => {
      const playthroughs = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Playthrough[]
      callback(playthroughs)
    },
    (error) => {
      console.error('[Firestore] onSnapshot error:', error)
      if (onError) onError(error)
    }
  )
}

export async function addPlaythrough(uid: string, data: Omit<Playthrough, 'id'>): Promise<string> {
  const ref = await addDoc(playthroughsCollection(uid), data)
  return ref.id
}

export async function updatePlaythrough(uid: string, playthrough: Playthrough): Promise<void> {
  const { id, ...data } = playthrough
  await updateDoc(doc(db, 'users', uid, 'playthroughs', id), data as Record<string, any>)
}

export async function deletePlaythrough(uid: string, playthroughId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'playthroughs', playthroughId))
}

// --- Community Stats ---

const COMMUNITY_STATS_DOC = doc(db, 'community-stats', 'global')

export async function getCommunityStatsFromFirestore(): Promise<CommunityStats | null> {
  const snap = await getDoc(COMMUNITY_STATS_DOC)
  return snap.exists() ? (snap.data() as CommunityStats) : null
}

export async function saveCommunityStats(stats: CommunityStats): Promise<void> {
  await setDoc(COMMUNITY_STATS_DOC, stats)
}

/**
 * Get ALL playthroughs across ALL users using a collectionGroup query.
 * Also returns the count of distinct users.
 *
 * User count is derived from playthrough parent paths (users with at least one game)
 * combined with the persisted registeredUsers counter (includes users with zero games).
 */
export async function getAllPlaythroughs(): Promise<{ playthroughs: Playthrough[]; userCount: number }> {
  const q = collectionGroup(db, 'playthroughs')
  const snapshot = await getDocs(q)
  const userIds = new Set<string>()
  const playthroughs = snapshot.docs.map((d) => {
    // Path: users/{uid}/playthroughs/{id} — extract uid
    const pathParts = d.ref.path.split('/')
    if (pathParts.length >= 2) userIds.add(pathParts[1])
    return { id: d.id, ...d.data() } as Playthrough
  })

  // Use the persisted registeredUsers from community-stats (incremented at signup)
  // as the floor, since some users may have zero playthroughs.
  const existingStats = await getDoc(COMMUNITY_STATS_DOC)
  const persistedUserCount = existingStats.exists()
    ? (existingStats.data() as { registeredUsers?: number }).registeredUsers || 0
    : 0

  return { playthroughs, userCount: Math.max(persistedUserCount, userIds.size) }
}

/**
 * Increment the registeredUsers counter in community-stats/global.
 * Called once per new user registration (from ensureUserDoc).
 */
export async function incrementRegisteredUsers(): Promise<void> {
  try {
    const snap = await getDoc(COMMUNITY_STATS_DOC)
    const current = snap.exists()
      ? (snap.data() as { registeredUsers?: number }).registeredUsers || 0
      : 0
    await setDoc(COMMUNITY_STATS_DOC, { registeredUsers: current + 1, lastUpdated: Date.now() }, { merge: true })
  } catch (err) {
    console.error('[Firestore] Failed to increment registeredUsers:', err)
  }
}
