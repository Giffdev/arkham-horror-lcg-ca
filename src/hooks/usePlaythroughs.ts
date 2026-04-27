import { useEffect, useState, useCallback, useRef } from 'react'
import {
  subscribeToPlaythroughs,
  addPlaythrough,
  updatePlaythrough,
  deletePlaythrough,
} from '../lib/firestore'
import { Playthrough } from '../lib/types'

interface PlaythroughActions {
  add: (data: Omit<Playthrough, 'id'>) => Promise<string>
  update: (playthrough: Playthrough) => Promise<void>
  remove: (id: string) => Promise<void>
  /** Bulk replace — for data normalization on first load */
  setAll: (updater: (current: Playthrough[]) => Playthrough[]) => Promise<void>
}

export function usePlaythroughs(
  uid: string | null
): [Playthrough[], PlaythroughActions, boolean] {
  const [playthroughs, setPlaythroughs] = useState<Playthrough[]>([])
  const [loading, setLoading] = useState(true)
  const currentUid = useRef(uid)
  currentUid.current = uid

  useEffect(() => {
    if (!uid) {
      setPlaythroughs([])
      setLoading(false)
      return
    }
    setLoading(true)
    const unsubscribe = subscribeToPlaythroughs(uid, (data) => {
      setPlaythroughs(data)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [uid])

  const add = useCallback(
    async (data: Omit<Playthrough, 'id'>) => {
      if (!currentUid.current) throw new Error('Not authenticated')
      return addPlaythrough(currentUid.current, data)
    },
    []
  )

  const update = useCallback(
    async (playthrough: Playthrough) => {
      if (!currentUid.current) throw new Error('Not authenticated')
      return updatePlaythrough(currentUid.current, playthrough)
    },
    []
  )

  const remove = useCallback(
    async (id: string) => {
      if (!currentUid.current) throw new Error('Not authenticated')
      return deletePlaythrough(currentUid.current, id)
    },
    []
  )

  const setAll = useCallback(
    async (updater: (current: Playthrough[]) => Playthrough[]) => {
      if (!currentUid.current) throw new Error('Not authenticated')
      const uid = currentUid.current
      // get current state, apply updater, write changed items back
      const updated = updater(playthroughs)
      const promises = updated.map((p) => updatePlaythrough(uid, p))
      await Promise.all(promises)
    },
    [playthroughs]
  )

  return [playthroughs, { add, update, remove, setAll }, loading]
}
