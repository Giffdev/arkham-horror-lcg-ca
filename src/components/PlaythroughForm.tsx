import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Playthrough,
  InvestigatorAssignment,
  CAMPAIGN_TYPES,
  Archetype,
  CampaignType,
  DreamEatersCampaignPath,
  type CampaignScenarioInvestigatorOutcome,
  type CampaignScenarioInvestigatorStatus,
  type CampaignScenarioResolution,
} from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import {
  FULL_CAMPAIGNS,
  SCENARIO_PACK_SCENARIOS,
  SMALL_CAMPAIGNS,
  getCampaignLineageId,
  orderCampaignsForDisplay,
  resolveCampaignMetadata,
} from '@/lib/campaign-data'
import {
  getCampaignProgressionScenarioNames,
  getNextCampaignScenarioResolution,
} from '@/lib/campaign-progression'
import { INVESTIGATORS, getInvestigatorById, getInvestigatorDisplayName, getChapterBadgeLabel, isChapterBadgeSpecial, type Investigator } from '@/lib/investigator-data'
import { MAX_PLAYERS_PER_PLAYTHROUGH, getPlayerLimitError } from '@/lib/playthrough-validation'
import { matchesSearchText } from '@/lib/search'
import { toDateInputValue } from '@/lib/date-utils'
import { Check, CaretDown, X, Plus, Trash, Sparkle } from '@phosphor-icons/react'

import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface PlaythroughFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (playthrough: Omit<Playthrough, 'id'> | Playthrough) => Promise<void> | void
  editPlaythrough?: Playthrough | null
  seedPlaythrough?: Playthrough | null
  campaignHistory?: Playthrough[]
  knownPlayerNames?: string[]
  isSaving?: boolean
}

const EMPTY_CAMPAIGN_HISTORY: Playthrough[] = []
const STANDALONE_OUTCOME_STATUSES: CampaignScenarioInvestigatorStatus[] = [
  'survived',
  'resigned',
  'defeated_physical',
  'defeated_mental',
  'killed',
  'driven_insane',
  'devoured',
]

interface StandaloneOutcomeDraft {
  participated: boolean
  status: CampaignScenarioInvestigatorStatus
  xpEarned: string
  traumaGainedPhysical: string
  traumaGainedMental: string
}

function defaultStandaloneOutcomeDraft(): StandaloneOutcomeDraft {
  return {
    participated: true,
    status: 'survived',
    xpEarned: '',
    traumaGainedPhysical: '',
    traumaGainedMental: '',
  }
}

function numericDraft(value: number | undefined): string {
  return value && value > 0 ? String(value) : ''
}

function parseNonNegativeInteger(value: string): number {
  const parsed = Number.parseInt(value.trim(), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function buildStandaloneOutcomeDrafts(
  investigators: InvestigatorAssignment[],
  outcomes: CampaignScenarioInvestigatorOutcome[] | undefined,
): StandaloneOutcomeDraft[] {
  const remaining = [...(outcomes ?? [])]
  return investigators.map(investigator => {
    const outcomeIndex = remaining.findIndex(outcome => (
      outcome.playerName === investigator.playerName &&
      outcome.investigatorName === investigator.investigatorName
    ))
    if (outcomeIndex < 0) {
      return outcomes ? { ...defaultStandaloneOutcomeDraft(), participated: false } : defaultStandaloneOutcomeDraft()
    }
    const [outcome] = remaining.splice(outcomeIndex, 1)
    return {
      participated: true,
      status: outcome.status,
      xpEarned: numericDraft(outcome.xpEarned),
      traumaGainedPhysical: numericDraft(outcome.traumaGainedPhysical),
      traumaGainedMental: numericDraft(outcome.traumaGainedMental),
    }
  })
}

function getDefaultScenarioFromResolution(
  resolution: ReturnType<typeof getNextCampaignScenarioResolution>,
): string {
  if (resolution.status === 'single' && resolution.automaticCandidates.length === 1) {
    return resolution.automaticCandidates[0].name
  }

  if (resolution.status === 'choice' && resolution.automaticCandidates.length > 0) {
    return resolution.automaticCandidates[0].name
  }

  if (resolution.status === 'manual' && resolution.manualCandidates.length === 1) {
    return resolution.manualCandidates[0].name
  }

  return ''
}

export function PlaythroughForm({
  open,
  onOpenChange,
  onSave,
  editPlaythrough,
  seedPlaythrough,
  campaignHistory = EMPTY_CAMPAIGN_HISTORY,
  knownPlayerNames = [],
  isSaving = false,
}: PlaythroughFormProps) {
  const [campaignType, setCampaignType] = useState<CampaignType>('Full Campaign')
  const [customCampaignName, setCustomCampaignName] = useState('')
  const [campaignName, setCampaignName] = useState('')
  const [campaignSet, setCampaignSet] = useState('')
  const [campaignLineageId, setCampaignLineageId] = useState('')
  const [scenarioName, setScenarioName] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [investigators, setInvestigators] = useState<InvestigatorAssignment[]>([])
  const [sideStories, setSideStories] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [resolutionType, setResolutionType] = useState<CampaignScenarioResolution['type']>('no_resolution')
  const [resolutionValue, setResolutionValue] = useState('')
  const [standaloneOutcomes, setStandaloneOutcomes] = useState<StandaloneOutcomeDraft[]>([])
  const [sideStoriesOpen, setSideStoriesOpen] = useState(false)
  const [sideStorySearch, setSideStorySearch] = useState('')
  const [customSideStory, setCustomSideStory] = useState('')
  const [campaignSearchOpen, setCampaignSearchOpen] = useState(false)
  const [dateError, setDateError] = useState('')
  const [saveError, setSaveError] = useState('')
  const isContinueMode = Boolean(seedPlaythrough) && !editPlaythrough
  const normalizedScenarioName = typeof scenarioName === 'string' ? scenarioName : ''

  useEffect(() => {
    if (open && editPlaythrough) {
      const editLineageId = getCampaignLineageId({
        campaignName: editPlaythrough.campaignName,
        customCampaignName: editPlaythrough.customCampaignName,
        campaignType: editPlaythrough.campaignType,
        campaignSet: editPlaythrough.campaignSet,
      })

      setCampaignType(editPlaythrough.campaignType)
      setCampaignName(editPlaythrough.campaignName)
      setCampaignSet(editPlaythrough.campaignSet || '')
      setCampaignLineageId(editPlaythrough.campaignLineageId || editLineageId)
      setScenarioName(editPlaythrough.scenarioName || '')
      setCustomCampaignName(editPlaythrough.customCampaignName || '')
      setDate(toDateInputValue(editPlaythrough.date))
      setSideStories(editPlaythrough.sideStories || [])
      setNotes(editPlaythrough.notes || '')
      setResolutionType(editPlaythrough.resolution?.type ?? 'no_resolution')
      setResolutionValue(editPlaythrough.resolution?.value ?? '')
      setStandaloneOutcomes(buildStandaloneOutcomeDrafts(
        editPlaythrough.investigators,
        editPlaythrough.investigatorOutcomes,
      ))
      setDateError('')
      setSaveError('')
      setInvestigators(editPlaythrough.investigators.map(inv => ({
        ...inv,
        archetypes: inv.archetypes || [inv.archetype]
      })))
    } else if (open && seedPlaythrough) {
      const resolvedSeedCampaign = resolveCampaignMetadata({
        campaignName: seedPlaythrough.campaignName,
        customCampaignName: seedPlaythrough.customCampaignName,
        campaignType: seedPlaythrough.campaignType,
        campaignSet: seedPlaythrough.campaignSet,
      })
      const seededCampaignType = resolvedSeedCampaign?.type ?? seedPlaythrough.campaignType
      const seededCampaignName = resolvedSeedCampaign?.name ?? seedPlaythrough.campaignName
      const seededCampaignSet = resolvedSeedCampaign?.set ?? seedPlaythrough.campaignSet ?? ''
      const seededLineageId = getCampaignLineageId({
        campaignName: seededCampaignName,
        campaignType: seededCampaignType,
        campaignSet: seededCampaignSet,
        customCampaignName: seedPlaythrough.customCampaignName,
      })
      const scenarioHistory = (campaignHistory.length > 0 ? campaignHistory : [seedPlaythrough])
        .map(log => log.scenarioName ?? '')

      const seededResolution = getNextCampaignScenarioResolution(
        {
          campaignName: seededCampaignName,
          campaignType: seededCampaignType,
          campaignSet: seededCampaignSet,
          customCampaignName: seedPlaythrough.customCampaignName,
        },
        scenarioHistory,
      )
      const seededScenarioName = getDefaultScenarioFromResolution(seededResolution)

      setCampaignType(seededCampaignType)
      setCampaignName(seededCampaignName)
      setCampaignSet(seededCampaignSet)
      setCampaignLineageId(seededLineageId)
      setScenarioName(seededScenarioName)
      setCustomCampaignName(
        seededCampaignType === 'Fan-Made'
          ? seedPlaythrough.customCampaignName || seedPlaythrough.campaignName
          : '',
      )
      setDate(new Date().toISOString().split('T')[0])
      setSideStories([])
      setNotes('')
      setResolutionType('no_resolution')
      setResolutionValue('')
      setStandaloneOutcomes([])
      setDateError('')
      setSaveError('')
      setInvestigators(seedPlaythrough.investigators.map(inv => ({
        ...inv,
        archetypes: inv.archetypes || [inv.archetype]
      })))
    } else if (open) {
      setCampaignType('Full Campaign')
      setCampaignName('')
      setCampaignSet('')
      setCampaignLineageId('')
      setScenarioName('')
      setCustomCampaignName('')
      setDate(new Date().toISOString().split('T')[0])
      setSideStories([])
      setNotes('')
      setResolutionType('no_resolution')
      setResolutionValue('')
      setStandaloneOutcomes([defaultStandaloneOutcomeDraft()])
      setDateError('')
      setSaveError('')
      setInvestigators([{
        playerName: '', 
        investigatorName: '', 
        archetype: 'Unknown',
        isUnknown: false, 
        investigatorSet: undefined 
      }])
    }
  }, [open, editPlaythrough, seedPlaythrough, campaignHistory])

  const handleCampaignNameChange = (name: string) => {
    setCampaignSearchOpen(false)
    setCampaignName(name)
    
    const selectedCampaign = [...FULL_CAMPAIGNS, ...SMALL_CAMPAIGNS, ...SCENARIO_PACK_SCENARIOS].find(c => c.name === name)
    if (selectedCampaign) {
      setCampaignSet(selectedCampaign.set)
      setCampaignLineageId(getCampaignLineageId({
        campaignName: selectedCampaign.name,
        campaignType: selectedCampaign.type,
        campaignSet: selectedCampaign.set,
      }))
      setScenarioName(selectedCampaign.name)
    }
  }

  const handleAddInvestigator = () => {
    if (investigators.length >= MAX_PLAYERS_PER_PLAYTHROUGH) return
    setInvestigators(current => {
      const isDreamEaters = campaignName === 'The Dream-Eaters'
      return [...current, {
        playerName: '',
        investigatorName: '',
        archetype: 'Unknown',
        isUnknown: false,
        investigatorSet: undefined,
        ...(isDreamEaters ? { dreamEatersPath: undefined } : {})
      }]
    })
    setStandaloneOutcomes(current => [...current, defaultStandaloneOutcomeDraft()])
  }

  const handleRemoveInvestigator = (index: number) => {
    setInvestigators(investigators.filter((_, i) => i !== index))
    setStandaloneOutcomes(current => current.filter((_, i) => i !== index))
  }

  const updateStandaloneOutcome = <K extends keyof StandaloneOutcomeDraft>(
    index: number,
    field: K,
    value: StandaloneOutcomeDraft[K],
  ) => {
    setStandaloneOutcomes(current => investigators.map((_, outcomeIndex) => {
      const draft = current[outcomeIndex] ?? defaultStandaloneOutcomeDraft()
      return outcomeIndex === index ? { ...draft, [field]: value } : draft
    }))
  }

  const handleInvestigatorChange = <K extends keyof InvestigatorAssignment>(
    index: number,
    field: K,
    value: InvestigatorAssignment[K],
  ) => {
    const updatedInvestigators: InvestigatorAssignment[] = investigators.map((inv, i): InvestigatorAssignment => {
      if (i !== index) return inv

      if (field === 'investigatorName') {
        const investigatorKey = typeof value === 'string' ? value : ''
        const investigatorData = getInvestigatorById(investigatorKey)
        if (investigatorData) {
          return {
            ...inv,
            investigatorName: investigatorData.name,
            investigatorId: investigatorData.id,
            chapter: investigatorData.chapter,
            archetype: investigatorData.archetypes[0],
            archetypes: investigatorData.archetypes,
            investigatorSet: investigatorData.set,
            isUnknown: false,
            isCustom: false
          }
        } else {
          return {
            ...inv,
            investigatorName: investigatorKey,
            investigatorId: undefined,
            chapter: undefined,
            isCustom: true,
            archetype: 'Unknown' as const,
            archetypes: ['Unknown'],
            investigatorSet: undefined
          }
        }
      }

      if (field === 'isUnknown') {
        const isUnknown = Boolean(value)
        return {
          ...inv,
          isUnknown,
          investigatorName: isUnknown ? 'Unknown' : '',
          archetype: 'Unknown' as const,
          archetypes: ['Unknown'],
          investigatorSet: undefined
        }
      }

      return { ...inv, [field]: value } as InvestigatorAssignment
    })

    setInvestigators(updatedInvestigators)
  }

  const handleToggleSideStory = (story: string) => {
    setSideStories(current => 
      current.includes(story) 
        ? current.filter(s => s !== story)
        : [...current, story]
    )
  }

  const handleAddCustomSideStory = () => {
    const name = customSideStory.trim()
    if (name && !sideStories.includes(name)) {
      setSideStories(current => [...current, name])
      setCustomSideStory('')
    }
  }

  // Compute whether the form has enough data to save
  const isFormValid = (() => {
    // Campaign must be selected (unless Unknown type)
    if (campaignType !== 'Unknown' && campaignType !== 'Fan-Made' && !campaignName) return false
    if (campaignType === 'Fan-Made' && !customCampaignName.trim()) return false
    if (isContinueMode && !normalizedScenarioName.trim()) return false
    // Must have at least one investigator
    if (investigators.length === 0) return false
    if (investigators.length > MAX_PLAYERS_PER_PLAYTHROUGH) return false
    // Each investigator must have a player name
    if (investigators.some(inv => !inv.playerName.trim())) return false
    return true
  })()

  const handleSubmit = async () => {
    // Date validation
    if (!date) {
      setDateError('Date is required')
      toast.error('Please enter a date')
      return
    }
    const dateObj = new Date(date + 'T00:00:00')
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    if (dateObj > today) {
      setDateError('Date cannot be in the future')
      toast.error('Date cannot be in the future')
      return
    }
    setDateError('')

    if (!campaignName && campaignType !== 'Unknown' && campaignType !== 'Fan-Made') {
      toast.error('Please select a campaign')
      return
    }

    if (campaignType === 'Fan-Made' && !customCampaignName) {
      toast.error('Please enter a custom campaign name')
      return
    }

    if (isContinueMode && !normalizedScenarioName.trim()) {
      toast.error('Please select or enter a scenario')
      return
    }

    if (investigators.length === 0) {
      toast.error('Please add at least one investigator')
      return
    }

    const playerLimitError = getPlayerLimitError({ investigators })
    if (playerLimitError) {
      toast.error(playerLimitError)
      return
    }

    if (campaignName === 'The Dream-Eaters') {
      const pathA = investigators.filter(inv => inv.dreamEatersPath === 'A: The Dream-Quest')
      const pathB = investigators.filter(inv => inv.dreamEatersPath === 'B: The Web of Dreams')
      
      if (pathA.length > 4) {
        toast.error('Cannot assign more than 4 investigators to A: The Dream-Quest')
        return
      }
      
      if (pathB.length > 4) {
        toast.error('Cannot assign more than 4 investigators to B: The Web of Dreams')
        return
      }
    }

    const resolvedLineageId = campaignLineageId || getCampaignLineageId({
      campaignName,
      campaignSet,
      campaignType,
      customCampaignName,
    })

    const persistedInvestigators = investigators.map(inv => {
      const isAutoUnknown = !inv.isUnknown && !inv.investigatorName && !inv.isCustom
      const effectiveInv = isAutoUnknown ? { ...inv, isUnknown: true, investigatorName: 'Unknown', archetype: 'Unknown' as const, archetypes: undefined } : inv
      return {
        playerName: effectiveInv.playerName,
        investigatorName: effectiveInv.isUnknown ? 'Unknown' : effectiveInv.investigatorName,
        archetype: effectiveInv.archetype,
        ...(effectiveInv.archetypes?.length ? { archetypes: effectiveInv.archetypes } : {}),
        ...(effectiveInv.investigatorId ? { investigatorId: effectiveInv.investigatorId } : {}),
        ...(effectiveInv.chapter != null ? { chapter: effectiveInv.chapter } : {}),
        ...(effectiveInv.investigatorSet ? { investigatorSet: effectiveInv.investigatorSet } : {}),
        ...(effectiveInv.isUnknown != null ? { isUnknown: effectiveInv.isUnknown } : {}),
        ...(effectiveInv.isCustom != null ? { isCustom: effectiveInv.isCustom } : {}),
        ...(effectiveInv.customInvestigatorName ? { customInvestigatorName: effectiveInv.customInvestigatorName } : {}),
        ...(effectiveInv.dreamEatersPath ? { dreamEatersPath: effectiveInv.dreamEatersPath } : {}),
      }
    })

    const playerOccurrences = new Map<string, number>()
    const standaloneSeatIds = persistedInvestigators.map((investigator, index) => {
      const normalizedPlayer = investigator.playerName.trim().replace(/\s+/g, ' ').toLowerCase() || `player-${index + 1}`
      const occurrence = (playerOccurrences.get(normalizedPlayer) ?? 0) + 1
      playerOccurrences.set(normalizedPlayer, occurrence)
      return `seat:${normalizedPlayer}:${occurrence}`
    })
    const standaloneInvestigatorOutcomes = campaignType === 'Scenario Pack'
      ? persistedInvestigators.flatMap((investigator, index): CampaignScenarioInvestigatorOutcome[] => {
          const draft = standaloneOutcomes[index] ?? defaultStandaloneOutcomeDraft()
          if (!draft.participated) return []
          const seatId = standaloneSeatIds[index]
          return [{
            seatId,
            slotId: `${seatId}:slot:1`,
            playerName: investigator.playerName,
            investigatorName: investigator.investigatorName,
            status: draft.status,
            xpEarned: parseNonNegativeInteger(draft.xpEarned),
            traumaGainedPhysical: parseNonNegativeInteger(draft.traumaGainedPhysical),
            traumaGainedMental: parseNonNegativeInteger(draft.traumaGainedMental),
          }]
        })
      : undefined

    const playthrough: Omit<Playthrough, 'id'> = {
      date,
      campaignName: campaignType === 'Unknown' ? 'Unknown Campaign' : campaignType === 'Fan-Made' ? customCampaignName.trim() : campaignName,
      campaignType,
      ...(campaignSet ? { campaignSet } : {}),
      ...(resolvedLineageId ? { campaignLineageId: resolvedLineageId } : {}),
      ...(normalizedScenarioName.trim() && (
        isContinueMode ||
        campaignType === 'Scenario Pack' ||
        Boolean(editPlaythrough?.scenarioName)
      )
        ? { scenarioName: normalizedScenarioName.trim() }
        : {}),
      ...(campaignType === 'Fan-Made' && customCampaignName ? { customCampaignName } : {}),
      sideStories: campaignType === 'Scenario Pack'
        ? (editPlaythrough?.sideStories ?? [])
        : (campaignType !== 'Unknown' ? sideStories : []),
      ...(notes.trim() ? { notes: notes.trim() } : { notes: '' }),
      investigators: persistedInvestigators,
      ...(campaignType === 'Scenario Pack'
        ? {
            scenarioType: 'standard' as const,
            resolution: {
              type: resolutionType,
              ...(resolutionType !== 'no_resolution' && resolutionValue.trim()
                ? { value: resolutionValue.trim() }
                : {}),
            },
            investigatorOutcomes: standaloneInvestigatorOutcomes,
          }
        : {}),
    }

    setSaveError('')
    try {
      await onSave(editPlaythrough ? { ...playthrough, id: editPlaythrough.id } : playthrough)
      onOpenChange(false)
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error)
      setSaveError(raw.length > 120 ? `${raw.slice(0, 120)}…` : raw)
    }
  }

  const availableCampaigns = useMemo(() => {
    const campaigns =
      campaignType === 'Full Campaign' ? FULL_CAMPAIGNS :
      campaignType === 'Small Campaign' ? SMALL_CAMPAIGNS :
      SCENARIO_PACK_SCENARIOS

    return orderCampaignsForDisplay(campaigns)
  }, [campaignType])

  const continuationScenarioHistory = useMemo(() => {
    if (!isContinueMode || !seedPlaythrough) return []

    return (campaignHistory.length > 0 ? campaignHistory : [seedPlaythrough])
      .map(log => log.scenarioName ?? '')
  }, [isContinueMode, seedPlaythrough, campaignHistory])

  const continuationResolution = useMemo(() => {
    if (!isContinueMode) return null

    return getNextCampaignScenarioResolution(
      {
        campaignName,
        campaignType,
        campaignSet,
        customCampaignName,
      },
      continuationScenarioHistory,
    )
  }, [
    isContinueMode,
    campaignName,
    campaignType,
    campaignSet,
    customCampaignName,
    continuationScenarioHistory,
  ])

  const continuationScenarioOptions = useMemo(() => {
    if (!isContinueMode) return []

    const canonicalScenarios = getCampaignProgressionScenarioNames({
      campaignName,
      campaignType,
      campaignSet,
      customCampaignName,
    })
    return continuationResolution?.contract?.branchRoutes
      ? continuationResolution.candidates.map(candidate => candidate.name)
      : canonicalScenarios
  }, [
    isContinueMode,
    campaignName,
    campaignType,
    campaignSet,
    customCampaignName,
    continuationResolution,
  ])

  useEffect(() => {
    if (!isContinueMode || !seedPlaythrough) return

    const currentScenario = normalizedScenarioName.trim()
    if (
      currentScenario &&
      (
        continuationScenarioOptions.length === 0 ||
        continuationScenarioOptions.includes(currentScenario)
      )
    ) {
      return
    }

    const suggestedScenario = continuationResolution
      ? getDefaultScenarioFromResolution(continuationResolution)
      : ''
    if (suggestedScenario) {
      setScenarioName(suggestedScenario)
      return
    }

    if (currentScenario && continuationScenarioOptions.length > 0) {
      setScenarioName('')
    }
  }, [
    isContinueMode,
    seedPlaythrough,
    continuationScenarioOptions,
    continuationResolution,
    normalizedScenarioName,
  ])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90dvh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>
            {editPlaythrough ? 'Edit Playthrough' : seedPlaythrough ? 'Continue Campaign' : 'Log New Playthrough'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Enter the campaign details and add up to four players and investigators.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4 overflow-y-auto flex-1 min-h-0 pr-1">
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value)
                setDateError('')
              }}
              className={cn(
                'text-foreground [color-scheme:dark] [-webkit-text-fill-color:currentColor] [&::-webkit-datetime-edit]:text-foreground [&::-webkit-calendar-picker-indicator]:brightness-0 [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-90',
                dateError ? 'border-destructive' : '',
              )}
            />
            {dateError && (
              <p className="text-xs text-destructive">{dateError}</p>
            )}
          </div>

          {!isContinueMode && (
            <div className="space-y-2">
              <Label htmlFor="campaign-type">Campaign Type</Label>
              <Select value={campaignType} onValueChange={(value) => {
                setCampaignType(value as CampaignType)
                setCampaignName('')
                setCampaignSet('')
                setCampaignLineageId('')
                setScenarioName('')
                setCustomCampaignName('')
                setSideStories([])
              }}>
                <SelectTrigger id="campaign-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAMPAIGN_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!isContinueMode && campaignType !== 'Unknown' && campaignType !== 'Fan-Made' && (
            <div className="space-y-2">
              <Label>Campaign</Label>
              <Popover open={campaignSearchOpen} onOpenChange={setCampaignSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                  >
                    {campaignName || 'Select campaign...'}
                    <CaretDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command filter={(value, search) => {
                    if (!search) return 1
                    return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                  }}>
                    <CommandInput placeholder="Search campaigns..." />
                    <CommandEmpty>No campaign found.</CommandEmpty>
                    <CommandList>
                      <CommandGroup>
                        {availableCampaigns.map((campaign) => (
                          <CommandItem
                            key={campaign.name}
                            value={campaign.name}
                            onSelect={() => handleCampaignNameChange(campaign.name)}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                campaignName === campaign.name ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            {campaign.name}
                            {campaign.chapter === 2 && (
                              <span className="ml-2 text-xs font-medium text-violet-400">Ch. 2</span>
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {!isContinueMode && campaignType === 'Fan-Made' && (
            <div className="space-y-2">
              <Label htmlFor="custom-campaign">Custom Campaign Name</Label>
              <Input
                id="custom-campaign"
                value={customCampaignName}
                onChange={(e) => setCustomCampaignName(e.target.value)}
                placeholder="Enter custom campaign name"
              />
            </div>
          )}

          {isContinueMode && (
            <>
              <div className="space-y-2">
                <Label htmlFor="continue-campaign-name">Campaign</Label>
                <div className="rounded-md border border-border/80 bg-muted/20 p-3 space-y-2">
                  <Input
                    id="continue-campaign-name"
                    value={campaignName}
                    readOnly
                    aria-readonly="true"
                    className="h-8 border-border/70 bg-transparent text-foreground font-medium opacity-100"
                  />
                  <p className="text-xs text-muted-foreground">{campaignType}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="scenario-name">Scenario</Label>
                {continuationScenarioOptions.length > 0 ? (
                  <Select
                    value={normalizedScenarioName}
                    onValueChange={(value) => setScenarioName(value || '')}
                  >
                    <SelectTrigger id="scenario-name" aria-label="Scenario" className="text-foreground">
                      <SelectValue placeholder="Select scenario..." />
                    </SelectTrigger>
                    <SelectContent>
                      {continuationScenarioOptions.map(option => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="scenario-name"
                    value={normalizedScenarioName}
                    onChange={(event) => setScenarioName(event.target.value)}
                    placeholder="Enter scenario name"
                    className="text-foreground"
                  />
                )}
                {continuationScenarioOptions.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    {continuationResolution?.status === 'unavailable'
                      ? continuationResolution.notes[0]
                      : 'Canonical scenario progression is unavailable for this campaign. Enter the scenario name manually.'}
                  </p>
                )}
                {continuationScenarioOptions.length > 0 && continuationResolution?.status === 'complete' && (
                  <p className="text-xs text-muted-foreground">
                    All canonical scenarios are already logged. Select a scenario to record a replay.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Continue creates a new scenario log in this campaign lineage.
                </p>
              </div>
            </>
          )}

          {campaignType !== 'Unknown' && campaignType !== 'Scenario Pack' && (
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between"
                onClick={() => setSideStoriesOpen(!sideStoriesOpen)}
              >
                <span className="flex items-center gap-2">
                  <Sparkle size={16} weight="duotone" />
                  Side Stories {sideStories.length > 0 && `(${sideStories.length})`}
                </span>
                <CaretDown className={cn("h-4 w-4 transition-transform", sideStoriesOpen && "rotate-180")} />
              </Button>
              
              {sideStoriesOpen && (
                <div className="border rounded-md p-4 space-y-3">
                  <div className="text-sm text-muted-foreground">
                    Select official scenarios or add your own custom side stories
                  </div>

                  {/* Selected side stories shown as removable badges */}
                  {sideStories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {sideStories.map((story) => (
                        <Badge key={story} variant="secondary" className="gap-1 pr-1">
                          {story}
                          <button
                            type="button"
                            onClick={() => handleToggleSideStory(story)}
                            className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                            aria-label={`Remove ${story}`}
                          >
                            <X size={12} />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Add custom side story */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add custom side story..."
                      value={customSideStory}
                      onChange={(e) => setCustomSideStory(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomSideStory() } }}
                      className="h-8 text-sm flex-1"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 px-2"
                      onClick={handleAddCustomSideStory}
                      disabled={!customSideStory.trim()}
                    >
                      <Plus size={14} />
                    </Button>
                  </div>

                  {/* Official scenarios list with search */}
                  <div className="space-y-2">
                    <Input
                      placeholder="Search official scenarios..."
                      value={sideStorySearch}
                      onChange={(e) => setSideStorySearch(e.target.value)}
                      className="h-8 text-sm"
                    />
                    <ScrollArea className="h-48">
                      <div className="space-y-2">
                        {SCENARIO_PACK_SCENARIOS
                          .filter((scenario) => scenario.name.toLowerCase().includes(sideStorySearch.toLowerCase()))
                          .map((scenario) => (
                          <div key={scenario.name} className="flex items-center space-x-2">
                            <Checkbox
                              id={`side-${scenario.name}`}
                              checked={sideStories.includes(scenario.name)}
                              onCheckedChange={() => handleToggleSideStory(scenario.name)}
                            />
                            <Label
                              htmlFor={`side-${scenario.name}`}
                              className="text-sm font-normal cursor-pointer flex items-center gap-1.5"
                            >
                              {scenario.name}
                              {scenario.chapter === 2 && (
                                <span className="text-xs font-medium text-violet-400">Ch. 2</span>
                              )}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>
                Investigators ({investigators.length}/{MAX_PLAYERS_PER_PLAYTHROUGH})
              </Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddInvestigator}
                disabled={investigators.length >= MAX_PLAYERS_PER_PLAYTHROUGH}
                aria-describedby="player-limit-help"
              >
                <Plus size={16} weight="bold" />
                <span className="ml-2">Add Investigator</span>
              </Button>
            </div>
            <p id="player-limit-help" className="text-xs text-muted-foreground" role="status">
              {investigators.length >= MAX_PLAYERS_PER_PLAYTHROUGH
                ? `Player limit reached (${MAX_PLAYERS_PER_PLAYTHROUGH} maximum).`
                : `Up to ${MAX_PLAYERS_PER_PLAYTHROUGH} players per playthrough.`}
            </p>

            <div className="space-y-3">
              {investigators.map((inv, index) => (
                <InvestigatorRow
                  key={index}
                  investigator={inv}
                  index={index}
                  isDreamEaters={campaignName === 'The Dream-Eaters'}
                  onRemove={() => handleRemoveInvestigator(index)}
                  onChange={(field, value) => handleInvestigatorChange(index, field, value)}
                  canRemove={investigators.length > 1}
                  knownPlayerNames={knownPlayerNames}
                />
              ))}
            </div>
          </div>

          {campaignType === 'Scenario Pack' && (
            <div className="space-y-4 rounded-lg border border-border/80 bg-muted/20 p-4">
              <div>
                <h3 className="font-semibold text-foreground">Scenario Results</h3>
                <p className="text-xs text-muted-foreground">
                  Record participation, outcome, XP, and trauma separately for each investigator.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="standalone-resolution-type">Resolution</Label>
                  <Select
                    value={resolutionType}
                    onValueChange={value => setResolutionType(value as CampaignScenarioResolution['type'])}
                  >
                    <SelectTrigger id="standalone-resolution-type" aria-label="Resolution" className="text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no_resolution">No Resolution</SelectItem>
                      <SelectItem value="numbered">Numbered</SelectItem>
                      <SelectItem value="named">Named</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {resolutionType !== 'no_resolution' && (
                  <div className="space-y-2">
                    <Label htmlFor="standalone-resolution-value">Resolution Detail</Label>
                    <Input
                      id="standalone-resolution-value"
                      value={resolutionValue}
                      onChange={event => setResolutionValue(event.target.value)}
                      className="text-foreground"
                    />
                  </div>
                )}
              </div>

              {investigators.map((investigator, index) => {
                const outcome = standaloneOutcomes[index] ?? defaultStandaloneOutcomeDraft()
                const investigatorLabel = investigator.investigatorName || `Investigator ${index + 1}`
                return (
                  <div key={index} className="space-y-3 rounded-md border border-border/70 bg-background/30 p-3">
                    <p className="font-medium text-foreground">{investigatorLabel}</p>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`standalone-participating-${index}`}
                        checked={outcome.participated}
                        onCheckedChange={checked => updateStandaloneOutcome(index, 'participated', Boolean(checked))}
                      />
                      <Label htmlFor={`standalone-participating-${index}`} className="font-normal">
                        Participated this scenario
                      </Label>
                    </div>
                    {outcome.participated && (
                      <div className="grid gap-3 md:grid-cols-6">
                        <div className="space-y-1 md:col-span-3">
                          <Label className="text-xs text-muted-foreground">Outcome</Label>
                          <Select
                            value={outcome.status}
                            onValueChange={value => updateStandaloneOutcome(
                              index,
                              'status',
                              value as CampaignScenarioInvestigatorStatus,
                            )}
                          >
                            <SelectTrigger aria-label={`Outcome for ${investigatorLabel}`} className="text-foreground">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STANDALONE_OUTCOME_STATUSES.map(status => (
                                <SelectItem key={status} value={status}>
                                  {status.replace(/_/g, ' ')}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {([
                          ['xpEarned', 'XP earned'],
                          ['traumaGainedPhysical', 'Physical trauma'],
                          ['traumaGainedMental', 'Mental trauma'],
                        ] as const).map(([field, label]) => (
                          <div key={field} className="space-y-1">
                            <Label className="text-xs text-muted-foreground">{label}</Label>
                            <Input
                              aria-label={`${label} for ${investigatorLabel}`}
                              type="number"
                              min={0}
                              step={1}
                              value={outcome[field]}
                              onChange={event => updateStandaloneOutcome(index, field, event.target.value)}
                              className="text-foreground"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2 pb-2">
            <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              placeholder="Any memorable moments, house rules, or session notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="resize-none text-foreground"
            />
          </div>
        </div>

        <DialogFooter className="flex-shrink-0">
          {saveError && (
            <p className="text-xs text-destructive flex-1 self-center" role="alert">
              {saveError}
            </p>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isFormValid || isSaving}>
            {isSaving ? 'Saving…' : `${editPlaythrough ? 'Update' : 'Save'} Playthrough`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface InvestigatorRowProps {
  investigator: InvestigatorAssignment
  index: number
  isDreamEaters: boolean
  onRemove: () => void
  onChange: (field: keyof InvestigatorAssignment, value: any) => void
  canRemove: boolean
  knownPlayerNames: string[]
}

function InvestigatorRow({ investigator, index, isDreamEaters, onRemove, onChange, canRemove, knownPlayerNames }: InvestigatorRowProps) {
  const [invSearchOpen, setInvSearchOpen] = useState(false)
  const [playerSearchOpen, setPlayerSearchOpen] = useState(false)
  const [chapterFilter, setChapterFilter] = useState<1 | 2 | null>(null)
  const investigatorData = investigator.investigatorId ? getInvestigatorById(investigator.investigatorId) : null

  const filteredInvestigators = chapterFilter
    ? INVESTIGATORS.filter(inv => inv.chapter === chapterFilter)
    : INVESTIGATORS

  const displayName = investigatorData 
    ? getInvestigatorDisplayName(investigatorData) 
    : investigator.investigatorName || 'Select investigator...'

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-end justify-between gap-2">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Player Name (Optional)</Label>
            <Popover open={playerSearchOpen} onOpenChange={setPlayerSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={playerSearchOpen}
                  className="w-full justify-between font-normal"
                  disabled={investigator.isUnknown}
                >
                  {investigator.playerName || 'Player name'}
                  <CaretDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[250px] p-0" align="start">
                <Command filter={(value, search) => {
                  if (!search) return 1
                  return matchesSearchText(value, search) ? 1 : 0
                }}>
                  <CommandInput
                    placeholder="Search or type new..."
                    value={investigator.playerName}
                    onValueChange={(v) => onChange('playerName', v)}
                  />
                  <CommandList>
                    <CommandEmpty>
                      {investigator.playerName ? (
                        <button
                          className="w-full px-2 py-1.5 text-sm text-left hover:bg-accent rounded cursor-pointer"
                          onClick={() => setPlayerSearchOpen(false)}
                        >
                          Use "{investigator.playerName}"
                        </button>
                      ) : (
                        'Type a player name'
                      )}
                    </CommandEmpty>
                    <CommandGroup>
                      {knownPlayerNames
                        .filter(name => matchesSearchText(name, investigator.playerName || ''))
                        .map(name => (
                          <CommandItem
                            key={name}
                            value={name}
                            onSelect={() => {
                              onChange('playerName', name)
                              setPlayerSearchOpen(false)
                            }}
                          >
                            <Check className={cn('mr-2 h-4 w-4', investigator.playerName === name ? 'opacity-100' : 'opacity-0')} />
                            {name}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Investigator</Label>
            <Popover open={invSearchOpen} onOpenChange={setInvSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                  disabled={investigator.isUnknown}
                >
                  <span className="truncate">{displayName}</span>
                  <CaretDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command filter={(value, search) => {
                  if (!search) return 1
                  return matchesSearchText(value, search) ? 1 : 0
                }}>
                  <CommandInput placeholder="Search investigators..." />
                  <div className="flex gap-1 px-2 py-1.5 border-b">
                    {([null, 1, 2] as const).map((ch) => (
                      <button
                        key={ch ?? 'all'}
                        onClick={() => setChapterFilter(ch)}
                        className={cn(
                          'px-2 py-0.5 text-xs rounded-full border transition-colors',
                          chapterFilter === ch
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-muted/50 hover:bg-muted'
                        )}
                      >
                        {ch === null ? 'All' : `Ch. ${ch}`}
                      </button>
                    ))}
                  </div>
                  <CommandEmpty>No investigator found.</CommandEmpty>
                  <CommandList>
                    <CommandGroup>
                      {filteredInvestigators.map((inv) => (
                        <CommandItem
                          key={inv.id}
                          value={`${inv.name} ${inv.chapter === 2 ? 'chapter 2 ch2' : 'chapter 1 ch1'} ${inv.set}`}
                          onSelect={() => {
                            onChange('investigatorName', inv.id)
                            setInvSearchOpen(false)
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              investigator.investigatorId === inv.id ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          <span className="flex-1">{inv.name}</span>
                          <span className={cn(
                            'ml-2 text-xs font-medium',
                            isChapterBadgeSpecial(inv)
                              ? 'text-violet-400'
                              : 'text-muted-foreground opacity-60'
                          )}>
                            · {getChapterBadgeLabel(inv)}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="shrink-0 self-end border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive focus-visible:border-destructive focus-visible:ring-destructive/50"
            aria-label={`Remove investigator ${index + 1}`}
          >
            <Trash size={16} weight="bold" />
          </Button>
        )}
      </div>

      {investigatorData && investigatorData.archetypes.length > 1 && !investigator.isUnknown && (
        <div className="space-y-2">
          <Label>Class</Label>
          <Select
            value={investigator.archetype}
            onValueChange={(value) => onChange('archetype', value as Archetype)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {investigatorData.archetypes.map((archetype) => (
                <SelectItem key={archetype} value={archetype}>
                  {archetype}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isDreamEaters && !investigator.isUnknown && (
        <div className="space-y-2">
          <Label>Campaign Path</Label>
          <Select
            value={investigator.dreamEatersPath || ''}
            onValueChange={(value) => onChange('dreamEatersPath', value as DreamEatersCampaignPath)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select path..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A: The Dream-Quest">A: The Dream-Quest</SelectItem>
              <SelectItem value="B: The Web of Dreams">B: The Web of Dreams</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center space-x-2">
        <Checkbox
          id={`unknown-${index}`}
          checked={investigator.isUnknown || false}
          onCheckedChange={(checked) => onChange('isUnknown', checked)}
        />
        <Label htmlFor={`unknown-${index}`} className="text-sm font-normal cursor-pointer">
          Mark as unknown investigator
        </Label>
      </div>
    </div>
  )
}
