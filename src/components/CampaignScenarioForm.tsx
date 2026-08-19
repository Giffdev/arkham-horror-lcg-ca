import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ArchetypeBadge } from '@/components/ArchetypeBadge'
import { getScenarioPackCampaignNames } from '@/lib/campaign-data'
import { getCampaignProgressionScenarioNames, getNextCampaignScenarioResolution } from '@/lib/campaign-progression'
import { getLegacyGroupScenarioOutcome, getNextCampaignSeatSlotId } from '@/lib/campaign-runs'
import { toDateInputValue } from '@/lib/date-utils'
import {
  getChapterBadgeLabel,
  getDisplaySetName,
  getInvestigatorById,
  getInvestigatorByName,
  getInvestigatorDisplayName,
  isChapterBadgeSpecial,
  INVESTIGATORS,
  type Investigator,
} from '@/lib/investigator-data'
import { matchesSearchText } from '@/lib/search'
import { cn } from '@/lib/utils'
import { CaretDown, Check } from '@phosphor-icons/react'
import type {
  Archetype,
  CampaignRun,
  CampaignScenarioAdjustment,
  CampaignScenarioInvestigatorOutcome,
  CampaignScenarioInvestigatorStatus,
  CampaignScenarioLog,
  CampaignScenarioResolution,
  CampaignScenarioRosterChange,
  CampaignScenarioRosterEntry,
  CampaignScenarioSlotEndReason,
  CampaignScenarioType,
  InvestigatorAssignment,
} from '@/lib/types'

const TERMINAL_STATUS_TO_REASON: Partial<Record<CampaignScenarioInvestigatorStatus, CampaignScenarioSlotEndReason>> = {
  killed: 'killed',
  driven_insane: 'driven_insane',
  devoured: 'devoured',
}

const CUSTOM_SIDE_SCENARIO_OPTION = '__custom_side_scenario__'

function toDraftNumericValue(value: number | undefined): string {
  if (!value || value <= 0) return ''
  return String(value)
}

function parseDraftNumericValue(value: string): number {
  const normalized = value.trim()
  if (!normalized) return 0
  const parsed = Number.parseInt(normalized, 10)
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return parsed
}

function normalizeDraftNumericValue(value: string): string {
  const normalized = value.trim()
  if (!normalized) return ''
  return String(parseDraftNumericValue(normalized))
}

const SCENARIO_TYPE_OPTIONS: Array<{ value: 'standard' | 'side_scenario'; label: string }> = [
  { value: 'standard', label: 'Campaign Scenario' },
  { value: 'side_scenario', label: 'Side Scenario' },
]
const INVESTIGATOR_STATUSES: CampaignScenarioInvestigatorStatus[] = [
  'survived',
  'resigned',
  'defeated_physical',
  'defeated_mental',
  'killed',
  'driven_insane',
  'devoured',
]

interface ParticipantDraft {
  seatId: string
  slotId: string
  playerName: string
  investigator: InvestigatorAssignment
  participated: boolean
  status: CampaignScenarioInvestigatorStatus
  xpEarned: string
  traumaGainedPhysical: string
  traumaGainedMental: string
  useReplacement: boolean
  replacementInvestigatorName: string
  replacementInvestigatorId?: string
  replacementArchetypes?: Archetype[]
  replacementArchetype: Archetype
  replacementChapter?: 1 | 2
  replacementInvestigatorSet?: string
}

type ScenarioSavePayload = {
  date: string
  scenarioName: string
  investigators?: InvestigatorAssignment[]
  sideStories?: string[]
  notes?: string
  scenarioType?: CampaignScenarioType
  resolution?: CampaignScenarioResolution
  rosterBefore?: CampaignScenarioRosterEntry[]
  investigatorOutcomes?: CampaignScenarioInvestigatorOutcome[]
  preScenarioAdjustments?: CampaignScenarioAdjustment[]
  rosterChanges?: CampaignScenarioRosterChange[]
  rosterAfter?: CampaignScenarioRosterEntry[]
}

interface CampaignScenarioFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaignRun: CampaignRun
  mode: 'append' | 'edit'
  scenarioLog?: CampaignScenarioLog
  onSave: (payload: ScenarioSavePayload) => Promise<void> | void
  isSaving?: boolean
}

function normalizePlayerName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

function buildSetupRosterSeed(investigators: InvestigatorAssignment[]): CampaignScenarioRosterEntry[] {
  const byPlayer = new Map<string, number>()
  return investigators.map((investigator, index) => {
    const normalized = normalizePlayerName(investigator.playerName || `player-${index + 1}`)
    const occurrence = (byPlayer.get(normalized) ?? 0) + 1
    byPlayer.set(normalized, occurrence)
    const seatId = `seat:${normalized || `player-${index + 1}`}:${occurrence}`
    return {
      seatId,
      slotId: `${seatId}:slot:1`,
      playerName: investigator.playerName,
      investigator: { ...investigator },
      seatStatus: 'active',
      joinedAtScenarioIndex: 0,
      startedAtScenarioIndex: 0,
      xpTotal: 0,
      xpSpent: 0,
      physicalTrauma: 0,
      mentalTrauma: 0,
    }
  })
}

function getRosterSeedForForm(campaignRun: CampaignRun, scenarioLog?: CampaignScenarioLog): CampaignScenarioRosterEntry[] {
  if (scenarioLog?.rosterBefore?.length) return scenarioLog.rosterBefore.map(entry => ({ ...entry, investigator: { ...entry.investigator } }))
  if (campaignRun.currentRoster?.length) {
    const latestOutcomeBySlot = new Map<string, CampaignScenarioInvestigatorStatus>()
    campaignRun.scenarioLogs.forEach((log) => {
      log.investigatorOutcomes?.forEach((outcome) => {
        latestOutcomeBySlot.set(outcome.slotId, outcome.status)
      })
    })
    return campaignRun.currentRoster
      .filter(entry => (
        entry.seatStatus !== 'eliminated' &&
        (entry.seatStatus !== 'left' || latestOutcomeBySlot.get(entry.slotId) === 'resigned')
      ))
      .map(entry => ({
        ...entry,
        ...(entry.seatStatus === 'left' && latestOutcomeBySlot.get(entry.slotId) === 'resigned'
          ? { seatStatus: 'active' as const, endedAtScenarioIndex: undefined }
          : {}),
        investigator: { ...entry.investigator },
      }))
  }
  return buildSetupRosterSeed(campaignRun.setupSnapshot.investigators)
}

function deriveParticipants(campaignRun: CampaignRun, scenarioLog: CampaignScenarioLog | undefined, mode: 'append' | 'edit'): ParticipantDraft[] {
  const rosterSeed = getRosterSeedForForm(campaignRun, scenarioLog)
  const outcomesBySlot = new Map<string, CampaignScenarioInvestigatorOutcome>()
  const replacementsBySlot = new Map<string, CampaignScenarioRosterChange>()

  scenarioLog?.investigatorOutcomes?.forEach((outcome) => outcomesBySlot.set(outcome.slotId, outcome))
  scenarioLog?.rosterChanges?.forEach((change) => {
    if (change.type === 'replacement') replacementsBySlot.set(change.previousSlotId, change)
  })

  return rosterSeed.map((entry) => {
    const outcome = outcomesBySlot.get(entry.slotId)
    const replacement = replacementsBySlot.get(entry.slotId)
    const participated = mode === 'append'
      ? true
      : Boolean(
          outcome ||
          scenarioLog?.investigators.some((investigator) => (
            normalizePlayerName(investigator.playerName) === normalizePlayerName(entry.playerName) &&
            investigator.investigatorName === entry.investigator.investigatorName
          )),
        )

    return {
      seatId: entry.seatId,
      slotId: entry.slotId,
      playerName: entry.playerName,
      investigator: { ...entry.investigator, playerName: entry.playerName },
      participated,
      status: outcome?.status ?? 'survived',
      xpEarned: toDraftNumericValue(outcome?.xpEarned),
      traumaGainedPhysical: toDraftNumericValue(outcome?.traumaGainedPhysical),
      traumaGainedMental: toDraftNumericValue(outcome?.traumaGainedMental),
      useReplacement: Boolean(replacement),
      replacementInvestigatorName: replacement?.newEntry.investigator.investigatorName ?? '',
      replacementInvestigatorId: replacement?.newEntry.investigator.investigatorId,
      replacementArchetypes: replacement?.newEntry.investigator.archetypes,
      replacementArchetype: replacement?.newEntry.investigator.archetype ?? 'Unknown',
      replacementChapter: replacement?.newEntry.investigator.chapter,
      replacementInvestigatorSet: replacement?.newEntry.investigator.investigatorSet,
    }
  })
}

function getDefaultScenarioName(
  campaignRun: CampaignRun,
  mode: 'append' | 'edit',
  scenarioLog: CampaignScenarioLog | undefined,
): string {
  if (mode === 'edit') return scenarioLog?.scenarioName ?? ''
  if (campaignRun.campaignType === 'Scenario Pack') return campaignRun.campaignName
  const history = campaignRun.scenarioLogs
    .filter((log) => log.scenarioType !== 'side_scenario')
    .map((log) => log.scenarioName)
  const resolution = getNextCampaignScenarioResolution(
    {
      campaignName: campaignRun.campaignName,
      campaignSet: campaignRun.campaignSet,
      campaignType: campaignRun.campaignType,
      customCampaignName: campaignRun.customCampaignName,
    },
    history,
  )

  if (resolution.status === 'single' && resolution.automaticCandidates[0]) {
    return resolution.automaticCandidates[0].name
  }
  if (resolution.status === 'choice' && resolution.automaticCandidates[0]) {
    return resolution.automaticCandidates[0].name
  }
  if (resolution.status === 'manual' && resolution.manualCandidates[0]) {
    return resolution.manualCandidates[0].name
  }
  return ''
}

function toStatusLabel(status: CampaignScenarioInvestigatorStatus): string {
  switch (status) {
    case 'defeated_physical':
      return 'Defeated (Physical)'
    case 'defeated_mental':
      return 'Defeated (Mental)'
    case 'driven_insane':
      return 'Driven Insane'
    default:
      return status.charAt(0).toUpperCase() + status.slice(1)
  }
}

function isTerminalStatus(status: CampaignScenarioInvestigatorStatus): boolean {
  return status === 'killed' || status === 'driven_insane' || status === 'devoured'
}

function resolveReplacementInvestigator(participant: ParticipantDraft): Investigator | undefined {
  if (participant.replacementInvestigatorId) {
    const byId = getInvestigatorById(participant.replacementInvestigatorId)
    if (byId) return byId
  }
  if (!participant.replacementInvestigatorName.trim()) return undefined
  return getInvestigatorByName(participant.replacementInvestigatorName.trim(), participant.replacementChapter)
}

function isSameInvestigatorAsParticipant(participant: ParticipantDraft, candidate: Investigator): boolean {
  if (participant.investigator.investigatorId) {
    return participant.investigator.investigatorId === candidate.id
  }
  const participantName = participant.investigator.investigatorName.trim().toLocaleLowerCase()
  if (!participantName) return false
  const candidateName = candidate.name.trim().toLocaleLowerCase()
  if (participantName !== candidateName) return false
  if (participant.investigator.chapter) return participant.investigator.chapter === candidate.chapter
  return true
}

interface ReplacementInvestigatorPickerProps {
  participant: ParticipantDraft
  disabled: boolean
  onSelect: (slotId: string, investigator: Investigator) => void
}

function ReplacementInvestigatorPicker({ participant, disabled, onSelect }: ReplacementInvestigatorPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const selectedInvestigator = resolveReplacementInvestigator(participant)
  const selectableInvestigators = useMemo(
    () => INVESTIGATORS.filter((candidate) => !isSameInvestigatorAsParticipant(participant, candidate)),
    [participant],
  )
  const filteredInvestigators = useMemo(
    () => selectableInvestigators.filter((candidate) => (
      matchesSearchText(
        `${candidate.name} ${candidate.chapter === 2 ? 'chapter 2 ch2' : 'chapter 1 ch1'} ${candidate.set}`,
        search,
      )
    )),
    [search, selectableInvestigators],
  )

  const handleSelect = (investigator: Investigator) => {
    onSelect(participant.slotId, investigator)
    setOpen(false)
    setSearch('')
  }

  const chapterLabel = selectedInvestigator
    ? getChapterBadgeLabel({ set: selectedInvestigator.set, chapter: selectedInvestigator.chapter })
    : null

  return (
    <div className="space-y-1">
      <Label htmlFor={`replacement-investigator-${participant.slotId}`} className="text-xs text-muted-foreground">Replacement Investigator</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={`replacement-investigator-${participant.slotId}`}
            variant="outline"
            role="combobox"
            aria-label="Replacement Investigator"
            className="w-full justify-between text-foreground"
            disabled={disabled}
          >
            <span className="truncate">
              {selectedInvestigator ? getInvestigatorDisplayName(selectedInvestigator) : participant.replacementInvestigatorName || 'Select investigator...'}
            </span>
            <CaretDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command filter={(value, input) => (matchesSearchText(value, input) ? 1 : 0)}>
            <CommandInput
              placeholder="Search investigators..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>No investigator found.</CommandEmpty>
              <CommandGroup>
                {filteredInvestigators.map((investigator) => (
                  <CommandItem
                    key={investigator.id}
                    value={`${investigator.name} ${investigator.chapter === 2 ? 'chapter 2 ch2' : 'chapter 1 ch1'} ${investigator.set}`}
                    onSelect={() => handleSelect(investigator)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        participant.replacementInvestigatorId === investigator.id ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span className="flex-1">{getInvestigatorDisplayName(investigator)}</span>
                    <span className={cn(
                      'ml-2 text-xs font-medium',
                      isChapterBadgeSpecial({ set: investigator.set, chapter: investigator.chapter })
                        ? 'text-violet-400'
                        : 'text-muted-foreground opacity-60',
                    )}>
                      · {getChapterBadgeLabel(investigator)}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedInvestigator && (
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs" data-testid={`replacement-metadata-${participant.slotId}`}>
          <ArchetypeBadge
            archetype={participant.replacementArchetype}
            className="text-xs h-5"
            investigatorName={selectedInvestigator.name}
            investigatorId={selectedInvestigator.id}
            investigatorSet={selectedInvestigator.set}
            chapter={selectedInvestigator.chapter}
          />
          {chapterLabel && (
            <span className={cn(
              'font-medium',
              isChapterBadgeSpecial({ set: selectedInvestigator.set, chapter: selectedInvestigator.chapter })
                ? 'text-violet-400'
                : 'text-muted-foreground opacity-70',
            )}>
              · {chapterLabel}
            </span>
          )}
          <span className="text-muted-foreground/90">
            {getDisplaySetName(selectedInvestigator.name, selectedInvestigator.set)}
          </span>
        </div>
      )}
    </div>
  )
}

export function CampaignScenarioForm({
  open,
  onOpenChange,
  campaignRun,
  mode,
  scenarioLog,
  onSave,
  isSaving = false,
}: CampaignScenarioFormProps) {
  const isStandaloneScenario = campaignRun.campaignType === 'Scenario Pack'
  const isFanMadeCampaign = campaignRun.campaignType === 'Fan-Made'
  const scenarioIndex = useMemo(() => {
    if (mode === 'append') return campaignRun.scenarioLogs.length
    const index = campaignRun.scenarioLogs.findIndex(log => log.id === scenarioLog?.id)
    return index >= 0 ? index : campaignRun.scenarioLogs.length - 1
  }, [campaignRun.scenarioLogs, mode, scenarioLog?.id])

  const isLatestScenario = mode === 'append' || scenarioIndex === campaignRun.scenarioLogs.length - 1
  const lockStatefulFields = mode === 'edit' && !isLatestScenario
  const sideScenarioOptions = useMemo(() => getScenarioPackCampaignNames(), [])
  const campaignScenarioHistory = useMemo(
    () => campaignRun.scenarioLogs
      .filter((log) => log.scenarioType !== 'side_scenario')
      .map((log) => log.scenarioName),
    [campaignRun.scenarioLogs],
  )

  const continuationResolution = useMemo(() => getNextCampaignScenarioResolution(
    {
      campaignName: campaignRun.campaignName,
      campaignSet: campaignRun.campaignSet,
      campaignType: campaignRun.campaignType,
      customCampaignName: campaignRun.customCampaignName,
    },
    campaignScenarioHistory,
  ), [campaignRun.campaignName, campaignRun.campaignSet, campaignRun.campaignType, campaignRun.customCampaignName, campaignScenarioHistory])
  const availableScenarios = useMemo(() => {
    if (isStandaloneScenario) return [campaignRun.campaignName]

    const canonicalScenarios = getCampaignProgressionScenarioNames({
      campaignName: campaignRun.campaignName,
      campaignSet: campaignRun.campaignSet,
      campaignType: campaignRun.campaignType,
      customCampaignName: campaignRun.customCampaignName,
    })
    if (mode === 'append' && continuationResolution.contract?.branchRoutes) {
      return continuationResolution.candidates.map(candidate => candidate.name)
    }
    return canonicalScenarios
  }, [
    campaignRun.campaignName,
    campaignRun.campaignSet,
    campaignRun.campaignType,
    campaignRun.customCampaignName,
    continuationResolution,
    isStandaloneScenario,
    mode,
  ])

  const [date, setDate] = useState('')
  const [scenarioName, setScenarioName] = useState('')
  const [scenarioType, setScenarioType] = useState<'standard' | 'side_scenario'>('standard')
  const [resolutionType, setResolutionType] = useState<CampaignScenarioResolution['type']>('no_resolution')
  const [resolutionValue, setResolutionValue] = useState('')
  const [campaignScenarioOpen, setCampaignScenarioOpen] = useState(false)
  const [campaignScenarioSearch, setCampaignScenarioSearch] = useState('')
  const [sideScenarioOpen, setSideScenarioOpen] = useState(false)
  const [sideScenarioSearch, setSideScenarioSearch] = useState('')
  const [sideScenarioSelection, setSideScenarioSelection] = useState('')
  const [customSideScenarioName, setCustomSideScenarioName] = useState('')
  const [notes, setNotes] = useState('')
  const [participants, setParticipants] = useState<ParticipantDraft[]>([])
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (!open) return
    const seededScenarioName = getDefaultScenarioName(campaignRun, mode, scenarioLog)
    const seededScenarioType: 'standard' | 'side_scenario' =
      !isStandaloneScenario && scenarioLog?.scenarioType === 'side_scenario' ? 'side_scenario' : 'standard'
    setDate(toDateInputValue(mode === 'edit' ? (scenarioLog?.date ?? campaignRun.startedAt) : new Date().toISOString()))
    setScenarioName(seededScenarioName)
    setScenarioType(seededScenarioType)
    setResolutionType(scenarioLog?.resolution?.type ?? 'no_resolution')
    setResolutionValue(scenarioLog?.resolution?.value ?? '')
    setCampaignScenarioOpen(false)
    setCampaignScenarioSearch('')
    setSideScenarioOpen(false)
    setSideScenarioSearch('')
    if (seededScenarioType === 'side_scenario') {
      const seededSideName = scenarioLog?.scenarioName?.trim() ?? ''
      if (seededSideName && sideScenarioOptions.includes(seededSideName)) {
        setSideScenarioSelection(seededSideName)
        setCustomSideScenarioName('')
      } else {
        setSideScenarioSelection(CUSTOM_SIDE_SCENARIO_OPTION)
        setCustomSideScenarioName(seededSideName)
      }
    } else {
      setSideScenarioSelection('')
      setCustomSideScenarioName('')
    }
    setNotes(scenarioLog?.notes ?? '')
    setParticipants(deriveParticipants(campaignRun, scenarioLog, mode))
    setSaveError('')
  }, [open, campaignRun, mode, scenarioLog, sideScenarioOptions, isStandaloneScenario])

  useEffect(() => {
    if (!open || mode !== 'append') return
    if (scenarioType === 'side_scenario') return
    if (scenarioName.trim()) return
    const defaultName = getDefaultScenarioName(campaignRun, mode, scenarioLog)
    if (defaultName) setScenarioName(defaultName)
  }, [campaignRun, mode, open, scenarioLog, scenarioName, scenarioType])

  const isSideScenario = scenarioType === 'side_scenario'
  const filteredCampaignScenarios = useMemo(() => {
    const normalizedSearch = campaignScenarioSearch.trim().toLowerCase()
    if (!normalizedSearch) return availableScenarios
    return availableScenarios.filter((option) => option.toLowerCase().includes(normalizedSearch))
  }, [availableScenarios, campaignScenarioSearch])
  const filteredSideScenarios = useMemo(() => {
    const normalizedSearch = sideScenarioSearch.trim().toLowerCase()
    if (!normalizedSearch) return sideScenarioOptions
    return sideScenarioOptions.filter((option) => option.toLowerCase().includes(normalizedSearch))
  }, [sideScenarioOptions, sideScenarioSearch])

  const selectScenarioType = (nextType: 'standard' | 'side_scenario') => {
    if (isStandaloneScenario && nextType === 'side_scenario') return
    if (nextType === 'side_scenario') {
      setScenarioType('side_scenario')
      setScenarioName('')
      setSideScenarioSelection('')
      setCustomSideScenarioName('')
      setSideScenarioSearch('')
      setSaveError('')
      return
    }

    setScenarioType('standard')
    setScenarioName(getDefaultScenarioName(campaignRun, mode, scenarioLog))
    setSideScenarioSelection('')
    setCustomSideScenarioName('')
    setCampaignScenarioSearch('')
    setSaveError('')
  }

  const handleSelectCampaignScenario = (nextScenarioName: string) => {
    setScenarioName(nextScenarioName)
    setCampaignScenarioOpen(false)
    setCampaignScenarioSearch('')
    setSaveError('')
  }

  const handleSelectSideScenario = (nextScenarioName: string) => {
    if (nextScenarioName === CUSTOM_SIDE_SCENARIO_OPTION) {
      setSideScenarioSelection(CUSTOM_SIDE_SCENARIO_OPTION)
      setScenarioName(customSideScenarioName.trim())
      setSideScenarioOpen(false)
      setSaveError('')
      return
    }

    setSideScenarioSelection(nextScenarioName)
    setCustomSideScenarioName('')
    setScenarioName(nextScenarioName)
    setSideScenarioOpen(false)
    setSideScenarioSearch('')
    setSaveError('')
  }

  const summaryText = useMemo(() => {
    const participantCount = participants.filter(participant => participant.participated).length
    return `${participantCount} participating · individual XP and trauma`
  }, [participants])
  const legacyGroupOutcome = useMemo(
    () => scenarioLog ? getLegacyGroupScenarioOutcome(scenarioLog) : null,
    [scenarioLog],
  )
  const legacyGroupOutcomeSummary = useMemo(() => {
    if (!legacyGroupOutcome) return null
    const parts: string[] = []
    if (legacyGroupOutcome.xpEarned !== undefined) parts.push(`${legacyGroupOutcome.xpEarned} XP`)
    if (legacyGroupOutcome.victoryDisplayTotal !== undefined) parts.push(`victory ${legacyGroupOutcome.victoryDisplayTotal}`)
    if (legacyGroupOutcome.xpBonusPenalty !== undefined) parts.push(`adjustment ${legacyGroupOutcome.xpBonusPenalty}`)
    if (legacyGroupOutcome.physicalTrauma !== undefined || legacyGroupOutcome.mentalTrauma !== undefined) {
      parts.push(`trauma P${legacyGroupOutcome.physicalTrauma ?? 0}/M${legacyGroupOutcome.mentalTrauma ?? 0}`)
    }
    return parts.join(' · ')
  }, [legacyGroupOutcome])

  const updateParticipant = <K extends keyof ParticipantDraft>(
    slotId: string,
    field: K,
    value: ParticipantDraft[K],
  ) => {
    setParticipants(current => current.map(participant => (
      participant.slotId === slotId
        ? { ...participant, [field]: value }
        : participant
    )))
  }

  const clearReplacementFields = (participant: ParticipantDraft): ParticipantDraft => ({
    ...participant,
    useReplacement: false,
    replacementInvestigatorName: '',
    replacementInvestigatorId: undefined,
    replacementArchetypes: undefined,
    replacementArchetype: 'Unknown',
    replacementChapter: undefined,
    replacementInvestigatorSet: undefined,
  })

  const updateParticipantStatus = (slotId: string, status: CampaignScenarioInvestigatorStatus) => {
    setParticipants(current => current.map((participant) => {
      if (participant.slotId !== slotId) return participant
      const next = { ...participant, status }
      if (!isTerminalStatus(status)) {
        return clearReplacementFields(next)
      }
      return next
    }))
  }

  const toggleParticipantReplacement = (slotId: string, enabled: boolean) => {
    setParticipants(current => current.map((participant) => {
      if (participant.slotId !== slotId) return participant
      if (!enabled) return clearReplacementFields(participant)
      return { ...participant, useReplacement: true }
    }))
  }

  const selectReplacementInvestigator = (slotId: string, investigator: Investigator) => {
    setParticipants(current => current.map((participant) => {
      if (participant.slotId !== slotId) return participant
      return {
        ...participant,
        useReplacement: true,
        replacementInvestigatorName: investigator.name,
        replacementInvestigatorId: investigator.id,
        replacementArchetypes: investigator.archetypes,
        replacementArchetype: investigator.archetypes[0] ?? 'Unknown',
        replacementChapter: investigator.chapter,
        replacementInvestigatorSet: investigator.set,
      }
    }))
  }

  const handleSubmit = async () => {
    if (isStandaloneScenario && scenarioType === 'side_scenario') {
      setSaveError('Standalone Scenario Packs cannot contain side-scenario logs.')
      return
    }
    const resolvedScenarioName = isSideScenario && sideScenarioSelection === CUSTOM_SIDE_SCENARIO_OPTION
      ? customSideScenarioName.trim()
      : scenarioName.trim()

    if (!date) {
      setSaveError('Date is required.')
      return
    }
    if (!resolvedScenarioName) {
      setSaveError(isSideScenario ? 'Select a side scenario name.' : 'Scenario name is required.')
      return
    }
    if (isSideScenario && sideScenarioSelection === CUSTOM_SIDE_SCENARIO_OPTION && !customSideScenarioName.trim()) {
      setSaveError('Custom side scenario name is required.')
      return
    }
    const resolution: CampaignScenarioResolution | undefined = resolutionType
      ? {
          type: resolutionType,
          ...(resolutionType !== 'no_resolution' && resolutionValue.trim()
            ? { value: resolutionValue.trim() }
            : {}),
        }
      : undefined

    if (lockStatefulFields) {
      try {
        await onSave({
          date,
          scenarioName: resolvedScenarioName,
          scenarioType,
          resolution,
          notes: notes.trim(),
        })
        onOpenChange(false)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to save scenario log.'
        setSaveError(message)
      }
      return
    }

    if (participants.some((participant) => (
      participant.participated &&
      isTerminalStatus(participant.status) &&
      participant.useReplacement &&
      !participant.replacementInvestigatorName.trim()
    ))) {
      setSaveError('Choose a replacement investigator before saving.')
      return
    }

    const rosterBeforeSeed = getRosterSeedForForm(campaignRun, scenarioLog).map((entry) => ({ ...entry, investigator: { ...entry.investigator } }))
    const rosterBeforeBySlot = new Map<string, CampaignScenarioRosterEntry>()
    rosterBeforeSeed.forEach((entry) => rosterBeforeBySlot.set(entry.slotId, entry))

    const rosterBefore = Array.from(rosterBeforeBySlot.values())
    const rosterAfter = rosterBefore.map(entry => ({ ...entry, investigator: { ...entry.investigator } }))
    const rosterAfterBySlot = new Map<string, CampaignScenarioRosterEntry>()
    rosterAfter.forEach((entry) => rosterAfterBySlot.set(entry.slotId, entry))

    const investigatorOutcomes: CampaignScenarioInvestigatorOutcome[] = []
    const rosterChanges: CampaignScenarioRosterChange[] = []
    const participatingInvestigators: InvestigatorAssignment[] = []

    for (const participant of participants) {
      if (!participant.participated) continue

      participatingInvestigators.push({
        ...participant.investigator,
        playerName: participant.playerName,
      })

      const xpEarned = parseDraftNumericValue(participant.xpEarned)
      const traumaGainedPhysical = parseDraftNumericValue(participant.traumaGainedPhysical)
      const traumaGainedMental = parseDraftNumericValue(participant.traumaGainedMental)

      investigatorOutcomes.push({
        seatId: participant.seatId,
        slotId: participant.slotId,
        playerName: participant.playerName,
        investigatorName: participant.investigator.investigatorName,
        status: participant.status,
        xpEarned,
        traumaGainedPhysical,
        traumaGainedMental,
      })

      const targetEntry = rosterAfterBySlot.get(participant.slotId)
      if (!targetEntry) continue
      targetEntry.xpTotal += xpEarned
      targetEntry.physicalTrauma += traumaGainedPhysical
      targetEntry.mentalTrauma += traumaGainedMental

      const endReason = TERMINAL_STATUS_TO_REASON[participant.status]
      if (endReason) {
        targetEntry.seatStatus = 'eliminated'
        targetEntry.endReason = endReason
        targetEntry.endedAtScenarioIndex = scenarioIndex

        if (participant.useReplacement && participant.replacementInvestigatorName.trim()) {
          const nextSlotId = getNextCampaignSeatSlotId(rosterAfter, participant.seatId)
          const newEntry: CampaignScenarioRosterEntry = {
            seatId: participant.seatId,
            slotId: nextSlotId,
            playerName: participant.playerName,
            investigator: {
              playerName: participant.playerName,
              investigatorName: participant.replacementInvestigatorName.trim(),
              archetype: participant.replacementArchetype,
              ...(participant.replacementArchetypes?.length ? { archetypes: participant.replacementArchetypes } : {}),
              ...(participant.replacementInvestigatorId ? { investigatorId: participant.replacementInvestigatorId } : {}),
              ...(participant.replacementChapter ? { chapter: participant.replacementChapter } : {}),
              ...(participant.replacementInvestigatorSet ? { investigatorSet: participant.replacementInvestigatorSet } : {}),
            },
            seatStatus: 'active',
            joinedAtScenarioIndex: scenarioIndex,
            startedAtScenarioIndex: scenarioIndex,
            xpTotal: 0,
            xpSpent: 0,
            physicalTrauma: 0,
            mentalTrauma: 0,
          }
          rosterAfter.push(newEntry)
          rosterChanges.push({
            type: 'replacement',
            seatId: participant.seatId,
            previousSlotId: participant.slotId,
            reason: endReason,
            newEntry,
          })
        }
      }
    }

    try {
      await onSave({
        date,
        scenarioName: resolvedScenarioName,
        investigators: participatingInvestigators,
        notes: notes.trim(),
        scenarioType,
        resolution,
        rosterBefore,
        investigatorOutcomes,
        rosterChanges: rosterChanges.length > 0 ? rosterChanges : undefined,
        rosterAfter,
      })
      onOpenChange(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save scenario log.'
      setSaveError(message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90dvh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {mode === 'append'
              ? (isStandaloneScenario ? 'Log Scenario Result' : 'Continue Campaign')
              : 'Edit Scenario Log'}
          </DialogTitle>
          <DialogDescription className="text-left">
            {mode === 'append'
              ? (isStandaloneScenario
                  ? 'Record the result for this standalone scenario.'
                  : 'Add a new scenario night to this campaign run.')
              : 'Update this scenario log. Historical stateful edits are restricted on non-latest logs.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto pr-1 py-1">
          {lockStatefulFields && (
            <div className="rounded-md border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              Historical state is locked for non-latest scenario logs. You can edit date, scenario name, type, resolution, and notes only.
            </div>
          )}

          <div className="rounded-md border border-border/80 bg-muted/20 p-3 space-y-2">
            <Label htmlFor="scenario-campaign-name">Campaign</Label>
            <Input
              id="scenario-campaign-name"
              readOnly
              aria-readonly="true"
              value={campaignRun.customCampaignName || campaignRun.campaignName}
              className="text-foreground font-medium opacity-100"
            />
            <p className="text-xs text-muted-foreground">{campaignRun.campaignType}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="scenario-date">Date</Label>
              <Input
                id="scenario-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="text-foreground [color-scheme:dark] [-webkit-text-fill-color:currentColor] [&::-webkit-datetime-edit]:text-foreground [&::-webkit-calendar-picker-indicator]:brightness-0 [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-90"
              />
            </div>
            {!isStandaloneScenario && (
              <div className="space-y-2">
                <Label htmlFor="scenario-type">Scenario Type</Label>
                <Select value={scenarioType} onValueChange={(value) => selectScenarioType(value as 'standard' | 'side_scenario')}>
                  <SelectTrigger id="scenario-type" className="text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCENARIO_TYPE_OPTIONS.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="scenario-name">
              {scenarioType === 'standard' && isFanMadeCampaign ? 'Custom Scenario Name' : 'Scenario'}
            </Label>
            {scenarioType === 'standard' ? (
              <>
                {availableScenarios.length > 0 ? (
                  <Popover open={campaignScenarioOpen} onOpenChange={setCampaignScenarioOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="scenario-name"
                        variant="outline"
                        role="combobox"
                        aria-label="Scenario"
                        className="w-full justify-between text-foreground"
                      >
                        <span className="truncate">
                          {scenarioName || 'Select scenario...'}
                        </span>
                        <CaretDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Search scenarios..."
                          value={campaignScenarioSearch}
                          onValueChange={setCampaignScenarioSearch}
                        />
                        <CommandList>
                          <CommandEmpty>No campaign scenario found.</CommandEmpty>
                          <CommandGroup>
                            {filteredCampaignScenarios.map((option) => (
                              <CommandItem
                                key={option}
                                value={option}
                                onSelect={() => handleSelectCampaignScenario(option)}
                              >
                                <Check
                                  className={cn(
                                    'mr-2 h-4 w-4',
                                    scenarioName === option ? 'opacity-100' : 'opacity-0',
                                  )}
                                />
                                {option}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                ) : isFanMadeCampaign ? (
                  <Input
                    id="scenario-name"
                    value={scenarioName}
                    onChange={(event) => setScenarioName(event.target.value)}
                    placeholder="Enter custom scenario name"
                    className="text-foreground"
                  />
                ) : (
                  <Input
                    id="scenario-name"
                    value=""
                    placeholder="Guide-backed scenarios unavailable"
                    className="text-foreground"
                    disabled
                    readOnly
                  />
                )}
                {availableScenarios.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    {isFanMadeCampaign
                      ? 'Fan-made campaigns use custom scenario names and preserve them in logged order.'
                      : continuationResolution.status === 'unavailable'
                      ? continuationResolution.notes[0]
                      : 'Canonical progression metadata is unavailable for this official campaign.'}
                  </p>
                )}
                {availableScenarios.length > 0 && continuationResolution.status === 'complete' && (
                  <p className="text-xs text-muted-foreground">
                    All canonical scenarios are already logged. Select a scenario to record a replay.
                  </p>
                )}
              </>
            ) : (
              <>
                <Popover open={sideScenarioOpen} onOpenChange={setSideScenarioOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="scenario-name"
                      variant="outline"
                      role="combobox"
                      aria-label="Scenario"
                      className="w-full justify-between text-foreground"
                    >
                      <span className="truncate">
                        {sideScenarioSelection === CUSTOM_SIDE_SCENARIO_OPTION
                          ? customSideScenarioName.trim() || 'Other / Custom Side Scenario'
                          : sideScenarioSelection || 'Select side scenario...'}
                      </span>
                      <CaretDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Search side scenarios..."
                        value={sideScenarioSearch}
                        onValueChange={setSideScenarioSearch}
                      />
                      <CommandList>
                        <CommandEmpty>No side scenario found.</CommandEmpty>
                        <CommandGroup>
                          {filteredSideScenarios.map((option) => (
                            <CommandItem
                              key={option}
                              value={option}
                              onSelect={() => handleSelectSideScenario(option)}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  sideScenarioSelection === option ? 'opacity-100' : 'opacity-0',
                                )}
                              />
                              {option}
                            </CommandItem>
                          ))}
                          <CommandItem
                            value="Other / Custom Side Scenario"
                            onSelect={() => handleSelectSideScenario(CUSTOM_SIDE_SCENARIO_OPTION)}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                sideScenarioSelection === CUSTOM_SIDE_SCENARIO_OPTION ? 'opacity-100' : 'opacity-0',
                              )}
                            />
                            Other / Custom Side Scenario
                          </CommandItem>
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {sideScenarioSelection === CUSTOM_SIDE_SCENARIO_OPTION && (
                  <div className="space-y-2">
                    <Label htmlFor="custom-side-scenario-name">Custom Side Scenario Name</Label>
                    <Input
                      id="custom-side-scenario-name"
                      value={customSideScenarioName}
                      onChange={(event) => {
                        const nextName = event.target.value
                        setCustomSideScenarioName(nextName)
                        setScenarioName(nextName.trim())
                      }}
                      placeholder="Enter side scenario name"
                      className="text-foreground"
                    />
                  </div>
                )}
              </>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="resolution-type">Resolution</Label>
              <Select value={resolutionType} onValueChange={(value) => setResolutionType(value as CampaignScenarioResolution['type'])}>
                <SelectTrigger id="resolution-type" className="text-foreground">
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
                <Label htmlFor="resolution-value">Resolution Detail</Label>
                <Input
                  id="resolution-value"
                  value={resolutionValue}
                  onChange={(event) => setResolutionValue(event.target.value)}
                  placeholder="e.g. Resolution 2"
                  className="text-foreground"
                />
              </div>
            )}
          </div>

          <div className="rounded-md border border-border/80 bg-muted/20 p-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-foreground">Participating Investigators</h3>
              <p className="text-xs text-muted-foreground">{summaryText}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter XP earned and trauma gained separately for each investigator.
            </p>
            {legacyGroupOutcome && (
              <p className="rounded-md border border-amber-400/40 bg-amber-400/10 p-2 text-xs text-amber-200">
                This legacy log contains group-level totals{legacyGroupOutcomeSummary ? ` (${legacyGroupOutcomeSummary})` : ''}. They remain unallocated and will not be split across investigators automatically.
              </p>
            )}
            <div className="space-y-3">
              {participants.map((participant) => {
                const participantDisabled = lockStatefulFields
                const showReplacement = isTerminalStatus(participant.status)
                return (
                  <div key={participant.slotId} className="rounded-md border border-border/70 bg-background/60 p-3 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {participant.playerName || 'Unnamed player'} — {participant.investigator.investigatorName}
                      </p>
                      <span className="text-xs text-muted-foreground">{participant.investigator.archetype}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`participating-${participant.slotId}`}
                        checked={participant.participated}
                        onCheckedChange={(checked) => updateParticipant(participant.slotId, 'participated', Boolean(checked))}
                        disabled={participantDisabled}
                      />
                      <Label htmlFor={`participating-${participant.slotId}`} className="text-sm font-normal text-foreground">
                        Participated this scenario
                      </Label>
                    </div>

                    {participant.participated && (
                      <div
                        className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-6"
                        data-testid={`participant-outcome-grid-${participant.slotId}`}
                      >
                        <div className="flex h-full flex-col justify-end gap-1 md:col-span-3" data-testid={`outcome-cell-${participant.slotId}`}>
                          <Label htmlFor={`status-${participant.slotId}`} className="min-h-[2rem] text-xs leading-snug text-muted-foreground flex items-end">Outcome</Label>
                          <Select
                            value={participant.status}
                            onValueChange={(value) => updateParticipantStatus(participant.slotId, value as CampaignScenarioInvestigatorStatus)}
                            disabled={participantDisabled}
                          >
                            <SelectTrigger id={`status-${participant.slotId}`} className="text-foreground min-w-[14rem] md:min-w-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {INVESTIGATOR_STATUSES.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {toStatusLabel(status)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex h-full flex-col justify-end gap-1 md:col-span-1" data-testid={`numeric-cell-xp-earned-${participant.slotId}`}>
                          <Label htmlFor={`xp-earned-${participant.slotId}`} className="min-h-[2rem] text-xs leading-snug text-muted-foreground flex items-end">XP Earned</Label>
                          <Input
                            id={`xp-earned-${participant.slotId}`}
                            aria-label={`XP earned for ${participant.investigator.investigatorName}`}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={1}
                            hideNumberSpinners
                            placeholder="0"
                            value={participant.xpEarned}
                            onChange={(event) => updateParticipant(participant.slotId, 'xpEarned', event.target.value)}
                            onBlur={(event) => updateParticipant(participant.slotId, 'xpEarned', normalizeDraftNumericValue(event.target.value))}
                            disabled={participantDisabled}
                          />
                        </div>
                        <div className="flex h-full flex-col justify-end gap-1 md:col-span-1" data-testid={`numeric-cell-trauma-physical-${participant.slotId}`}>
                          <Label htmlFor={`trauma-physical-${participant.slotId}`} className="min-h-[2rem] text-xs leading-snug text-muted-foreground flex items-end">Physical Trauma</Label>
                          <Input
                            id={`trauma-physical-${participant.slotId}`}
                            aria-label={`Physical trauma for ${participant.investigator.investigatorName}`}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={1}
                            hideNumberSpinners
                            placeholder="0"
                            value={participant.traumaGainedPhysical}
                            onChange={(event) => updateParticipant(participant.slotId, 'traumaGainedPhysical', event.target.value)}
                            onBlur={(event) => updateParticipant(participant.slotId, 'traumaGainedPhysical', normalizeDraftNumericValue(event.target.value))}
                            disabled={participantDisabled}
                          />
                        </div>
                        <div className="flex h-full flex-col justify-end gap-1 md:col-span-1" data-testid={`numeric-cell-trauma-mental-${participant.slotId}`}>
                          <Label htmlFor={`trauma-mental-${participant.slotId}`} className="min-h-[2rem] text-xs leading-snug text-muted-foreground flex items-end">Mental Trauma</Label>
                          <Input
                            id={`trauma-mental-${participant.slotId}`}
                            aria-label={`Mental trauma for ${participant.investigator.investigatorName}`}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={1}
                            hideNumberSpinners
                            placeholder="0"
                            value={participant.traumaGainedMental}
                            onChange={(event) => updateParticipant(participant.slotId, 'traumaGainedMental', event.target.value)}
                            onBlur={(event) => updateParticipant(participant.slotId, 'traumaGainedMental', normalizeDraftNumericValue(event.target.value))}
                            disabled={participantDisabled}
                          />
                        </div>
                      </div>
                    )}

                    {participant.participated && showReplacement && (
                      <div className="rounded-md border border-border/60 bg-muted/30 p-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`replacement-enabled-${participant.slotId}`}
                            checked={participant.useReplacement}
                            onCheckedChange={(checked) => toggleParticipantReplacement(participant.slotId, Boolean(checked))}
                            disabled={participantDisabled}
                          />
                          <Label htmlFor={`replacement-enabled-${participant.slotId}`} className="text-sm font-medium text-foreground">
                            Add replacement investigator
                          </Label>
                        </div>

                        {participant.useReplacement && (
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-1">
                              <Label htmlFor={`replacement-player-${participant.slotId}`} className="text-xs text-muted-foreground">Player Slot</Label>
                              <Input
                                id={`replacement-player-${participant.slotId}`}
                                readOnly
                                aria-readonly="true"
                                aria-describedby={`replacement-player-help-${participant.slotId}`}
                                value={participant.playerName || 'Unnamed player'}
                                className="text-foreground font-medium opacity-100"
                              />
                              <p id={`replacement-player-help-${participant.slotId}`} className="text-[11px] text-muted-foreground">
                                Replacement stays on this player slot to preserve campaign continuity.
                              </p>
                            </div>
                            <ReplacementInvestigatorPicker
                              participant={participant}
                              disabled={participantDisabled}
                              onSelect={selectReplacementInvestigator}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scenario-notes">Notes</Label>
            <Textarea
              id="scenario-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              className="resize-none text-foreground"
            />
          </div>
        </div>

        <DialogFooter>
          {saveError && <p className="text-xs text-destructive mr-auto" role="alert">{saveError}</p>}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? 'Saving…' : mode === 'append' ? 'Log Scenario' : 'Save Scenario'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
