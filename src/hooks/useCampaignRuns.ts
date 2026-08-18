import { useCallback, useEffect, useRef, useState } from 'react'
import {
  addCampaignRun,
  appendCampaignScenarioLog,
  deleteCampaignRunWithRestoration,
  deleteCampaignScenarioLog,
  editCampaignRun,
  editCampaignScenarioLog,
  subscribeToCampaignRuns,
  upsertCampaignRun,
} from '@/lib/firestore'
import type {
  CampaignRun,
  CampaignScenarioAdjustment,
  CampaignScenarioInvestigatorOutcome,
  CampaignScenarioLog,
  CampaignScenarioResolution,
  CampaignScenarioRosterChange,
  CampaignScenarioRosterEntry,
  CampaignScenarioType,
  CampaignType,
} from '@/lib/types'

interface CampaignRunActions {
  add: (data: Omit<CampaignRun, 'id'>) => Promise<string>
  upsert: (campaignRun: CampaignRun) => Promise<void>
  edit: (
    campaignRunId: string,
    updates: {
      campaignName?: string
      campaignSet?: string
      campaignType?: CampaignType
      customCampaignName?: string
      startedAt?: string
      status?: CampaignRun['status']
      setupSnapshot?: Partial<CampaignRun['setupSnapshot']>
    },
  ) => Promise<CampaignRun>
  remove: (campaignRunId: string) => Promise<void>
  appendScenario: (
    campaignRunId: string,
    scenarioLog: {
      id?: string
      date: string
      scenarioName: string
      investigators: CampaignScenarioLog['investigators']
      sideStories?: string[]
      notes?: string
      legacySourcePlaythroughId?: string
      scenarioType?: CampaignScenarioType
      resolution?: CampaignScenarioResolution
      rosterBefore?: CampaignScenarioRosterEntry[]
      investigatorOutcomes?: CampaignScenarioInvestigatorOutcome[]
      preScenarioAdjustments?: CampaignScenarioAdjustment[]
      rosterChanges?: CampaignScenarioRosterChange[]
      rosterAfter?: CampaignScenarioRosterEntry[]
    },
  ) => Promise<CampaignRun>
  editScenario: (
    campaignRunId: string,
    scenarioLogId: string,
    updates: {
      date?: string
      scenarioName?: string
      investigators?: CampaignScenarioLog['investigators']
      sideStories?: string[]
      notes?: string
      scenarioType?: CampaignScenarioType
      resolution?: CampaignScenarioResolution
      rosterBefore?: CampaignScenarioRosterEntry[]
      investigatorOutcomes?: CampaignScenarioInvestigatorOutcome[]
      preScenarioAdjustments?: CampaignScenarioAdjustment[]
      rosterChanges?: CampaignScenarioRosterChange[]
      rosterAfter?: CampaignScenarioRosterEntry[]
    },
  ) => Promise<CampaignRun>
  removeScenario: (campaignRunId: string, scenarioLogId: string) => Promise<CampaignRun>
}

export function useCampaignRuns(
  uid: string | null,
): [CampaignRun[], CampaignRunActions, boolean, Error | null] {
  const [campaignRuns, setCampaignRuns] = useState<CampaignRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const currentUid = useRef(uid)
  currentUid.current = uid

  useEffect(() => {
    if (!uid) {
      setCampaignRuns([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    const unsubscribe = subscribeToCampaignRuns(
      uid,
      (runs) => {
        setCampaignRuns(runs)
        setLoading(false)
        setError(null)
      },
      (err) => {
        setError(err)
        setCampaignRuns([])
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [uid])

  const add = useCallback(async (data: Omit<CampaignRun, 'id'>) => {
    if (!currentUid.current) throw new Error('Not authenticated')
    return addCampaignRun(currentUid.current, data)
  }, [])

  const upsert = useCallback(async (campaignRun: CampaignRun) => {
    if (!currentUid.current) throw new Error('Not authenticated')
    return upsertCampaignRun(currentUid.current, campaignRun)
  }, [])

  const edit = useCallback(async (
    campaignRunId: string,
    updates: {
      campaignName?: string
      campaignSet?: string
      campaignType?: CampaignType
      customCampaignName?: string
      startedAt?: string
      status?: CampaignRun['status']
      setupSnapshot?: Partial<CampaignRun['setupSnapshot']>
    },
  ) => {
    if (!currentUid.current) throw new Error('Not authenticated')
    return editCampaignRun(currentUid.current, campaignRunId, updates)
  }, [])

  const remove = useCallback(async (campaignRunId: string) => {
    if (!currentUid.current) throw new Error('Not authenticated')
    await deleteCampaignRunWithRestoration(currentUid.current, campaignRunId)
  }, [])

  const appendScenario = useCallback(async (
    campaignRunId: string,
    scenarioLog: {
      id?: string
      date: string
      scenarioName: string
      investigators: CampaignScenarioLog['investigators']
      sideStories?: string[]
      notes?: string
      legacySourcePlaythroughId?: string
      scenarioType?: CampaignScenarioType
      resolution?: CampaignScenarioResolution
      rosterBefore?: CampaignScenarioRosterEntry[]
      investigatorOutcomes?: CampaignScenarioInvestigatorOutcome[]
      preScenarioAdjustments?: CampaignScenarioAdjustment[]
      rosterChanges?: CampaignScenarioRosterChange[]
      rosterAfter?: CampaignScenarioRosterEntry[]
    },
  ) => {
    if (!currentUid.current) throw new Error('Not authenticated')
    return appendCampaignScenarioLog(currentUid.current, campaignRunId, scenarioLog)
  }, [])

  const editScenario = useCallback(async (
    campaignRunId: string,
    scenarioLogId: string,
    updates: {
      date?: string
      scenarioName?: string
      investigators?: CampaignScenarioLog['investigators']
      sideStories?: string[]
      notes?: string
      scenarioType?: CampaignScenarioType
      resolution?: CampaignScenarioResolution
      rosterBefore?: CampaignScenarioRosterEntry[]
      investigatorOutcomes?: CampaignScenarioInvestigatorOutcome[]
      preScenarioAdjustments?: CampaignScenarioAdjustment[]
      rosterChanges?: CampaignScenarioRosterChange[]
      rosterAfter?: CampaignScenarioRosterEntry[]
    },
  ) => {
    if (!currentUid.current) throw new Error('Not authenticated')
    return editCampaignScenarioLog(currentUid.current, campaignRunId, scenarioLogId, updates)
  }, [])

  const removeScenario = useCallback(async (campaignRunId: string, scenarioLogId: string) => {
    if (!currentUid.current) throw new Error('Not authenticated')
    return deleteCampaignScenarioLog(currentUid.current, campaignRunId, scenarioLogId)
  }, [])

  return [
    campaignRuns,
    {
      add,
      upsert,
      edit,
      remove,
      appendScenario,
      editScenario,
      removeScenario,
    },
    loading,
    error,
  ]
}
