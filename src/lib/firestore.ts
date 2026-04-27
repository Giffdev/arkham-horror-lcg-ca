import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  getDoc,
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
  callback: (playthroughs: Playthrough[]) => void
): Unsubscribe {
  const q = query(playthroughsCollection(uid), orderBy('date', 'desc'))
  return onSnapshot(q, (snapshot) => {
    const playthroughs = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Playthrough[]
    callback(playthroughs)
  })
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
