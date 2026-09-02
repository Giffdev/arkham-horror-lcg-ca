import { useState, useMemo } from 'react'
import { usePlaythroughs } from '@/hooks/usePlaythroughs'
import { useCampaignRuns } from '@/hooks/useCampaignRuns'
import { useAuthState } from '@/hooks/useAuthState'
import { usePlaythroughFilters } from '@/hooks/usePlaythroughFilters'
import { usePasswordLink } from '@/hooks/usePasswordLink'
import { useLegacyDataMigration } from '@/hooks/useLegacyDataMigration'
import { useCommunityStatsSync } from '@/hooks/useCommunityStatsSync'
import { buildCampaignRunFromSourcePlaythrough, CampaignRunMutationError, flattenGameLogs } from '@/lib/campaign-runs'
import { importNormalizedData, promotePlaythroughToCampaignRun } from '@/lib/firestore'
import { Playthrough, CampaignRun, CampaignScenarioLog } from '@/lib/types'
import { User as AuthUser } from '@/lib/auth'
import { buildTopLevelGameRows } from '@/lib/top-level-game-rows'
import { collapseCampaignInvestigatorPlays } from '@/lib/investigator-play-history'
import { getActualCampaignScenarioLogs } from '@/lib/scenario-night-utils'
import type { NormalizedImportPayload } from '@/lib/import-export'

import { PlaythroughForm } from '@/components/PlaythroughForm'
import { CampaignScenarioForm } from '@/components/CampaignScenarioForm'
import { CommunityStats } from '@/components/CommunityStats'
import { CompletionStatsPanel } from '@/components/CompletionStats'
import { InvestigatorHeatmap } from '@/components/InvestigatorHeatmap'
import { AppHeader } from '@/components/AppHeader'
import { GamesTab } from '@/components/GamesTab'
import { PlayersTab } from '@/components/PlayersTab'
import { MobileNav } from '@/components/MobileNav'
import { PasswordLinkDialog } from '@/components/PasswordLinkDialog'

import { BookOpen, User, UsersThree } from '@phosphor-icons/react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Toaster, toast } from 'sonner'
import { PublicHomepage } from '@/components/PublicHomepage'
import { CommunityStats as CommunityStatsType, markCommunityStatsDirty } from '@/lib/community-stats'

interface AuthenticatedAppProps {
  currentUser: AuthUser
  onSignOut: () => void
}

type DeleteTarget =
  | { kind: 'playthrough'; id: string }
  | { kind: 'campaign-run'; campaignRunId: string; campaignName: string }
  | {
      kind: 'campaign-scenario'
      campaignRunId: string
      scenarioLogId: string
      scenarioName: string
    }

function mapCampaignRunSetupToPlaythrough(campaignRun: CampaignRun): Playthrough {
  return {
    id: campaignRun.id,
    date: campaignRun.startedAt,
    campaignName: campaignRun.campaignName,
    campaignSet: campaignRun.campaignSet,
    campaignType: campaignRun.campaignType,
    campaignLineageId: campaignRun.campaignLineageId,
    customCampaignName: campaignRun.customCampaignName,
    investigators: campaignRun.setupSnapshot.investigators,
    notes: campaignRun.setupSnapshot.notes,
  }
}

function AuthenticatedApp({ currentUser, onSignOut }: AuthenticatedAppProps) {
  const [playthroughs, playthroughActions, isLoadingPlaythroughs] = usePlaythroughs(currentUser.id)
  const [campaignRuns, campaignRunActions, isLoadingCampaignRuns] = useCampaignRuns(currentUser.id)
  const [formOpen, setFormOpen] = useState(false)
  const [editingTarget, setEditingTarget] = useState<
    | { kind: 'playthrough'; playthrough: Playthrough }
    | { kind: 'campaign-run'; campaignRunId: string }
    | { kind: 'campaign-scenario'; campaignRunId: string; scenarioLogId: string }
    | null
  >(null)
  const [continuationCampaignRunId, setContinuationCampaignRunId] = useState<string | null>(null)
  const [pendingContinuationRun, setPendingContinuationRun] = useState<CampaignRun | null>(null)
  const [expandedCampaignRunIds, setExpandedCampaignRunIds] = useState<Set<string>>(() => new Set())
  const [isSaving, setIsSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('games')

  const flattenedPlaythroughs = useMemo(() => (
    flattenGameLogs({
      playthroughs,
      campaignRuns,
    })
  ), [campaignRuns, playthroughs])

  const investigatorPlaythroughs = useMemo(
    () => collapseCampaignInvestigatorPlays(flattenedPlaythroughs, campaignRuns),
    [campaignRuns, flattenedPlaythroughs],
  )

  const topLevelRows = useMemo(() => (
    buildTopLevelGameRows(playthroughs, campaignRuns)
  ), [campaignRuns, playthroughs])
  const isLoadingGames = isLoadingPlaythroughs || isLoadingCampaignRuns

  const topLevelFilterPlaythroughs = useMemo(
    () => topLevelRows.map((row) => row.filterPlaythrough),
    [topLevelRows],
  )

  const { filters, handlers: filterHandlers, filteredPlaythroughs } = usePlaythroughFilters(topLevelFilterPlaythroughs)
  const filteredTopLevelRows = useMemo(() => {
    const allowedFilterIds = new Set(filteredPlaythroughs.map((playthrough) => playthrough.id))
    return topLevelRows.filter((row) => allowedFilterIds.has(row.filterPlaythrough.id))
  }, [filteredPlaythroughs, topLevelRows])
  const passwordLink = usePasswordLink(currentUser)
  useLegacyDataMigration(playthroughs, playthroughActions.update)

  const [communityStats, setCommunityStats] = useState<CommunityStatsType | null>(null)
  useCommunityStatsSync(flattenedPlaythroughs, setCommunityStats)
  const markCommunityStatsPending = () => {
    markCommunityStatsDirty(communityStats?.lastUpdated)
  }

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    window.scrollTo(0, 0)
  }

  const knownPlayerNames = useMemo(() => {
    if (!flattenedPlaythroughs) return []
    const names = new Set<string>()
    flattenedPlaythroughs.forEach(p => p.investigators.forEach(inv => {
      if (inv.playerName?.trim()) names.add(inv.playerName.trim())
    }))
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [flattenedPlaythroughs])

  const allPlayers = useMemo(() => {
    if (!investigatorPlaythroughs) return []
    const playerSet = new Set<string>()
    investigatorPlaythroughs.forEach(playthrough => {
      playthrough.investigators.forEach(inv => {
        if (inv.playerName.trim()) {
          playerSet.add(inv.playerName)
        }
      })
    })
    return Array.from(playerSet).sort((a, b) => a.localeCompare(b))
  }, [investigatorPlaythroughs])

  const editingCampaignRun = useMemo(() => {
    if (editingTarget?.kind !== 'campaign-run') return null
    return campaignRuns.find((campaignRun) => campaignRun.id === editingTarget.campaignRunId) ?? null
  }, [campaignRuns, editingTarget])

  const editingScenarioContext = useMemo(() => {
    if (editingTarget?.kind !== 'campaign-scenario') return null
    const campaignRun = campaignRuns.find((run) => run.id === editingTarget.campaignRunId)
    if (!campaignRun) return null
    const scenarioLog = campaignRun.scenarioLogs.find((log) => log.id === editingTarget.scenarioLogId)
    if (!scenarioLog) return null
    return { campaignRun, scenarioLog }
  }, [campaignRuns, editingTarget])

  const continuationCampaignRun = useMemo(() => {
    if (!continuationCampaignRunId) return null
    const liveRun = campaignRuns.find((campaignRun) => campaignRun.id === continuationCampaignRunId)
    if (liveRun) return liveRun
    if (pendingContinuationRun?.id === continuationCampaignRunId) return pendingContinuationRun
    return null
  }, [campaignRuns, continuationCampaignRunId, pendingContinuationRun])

  const editPlaythroughForForm = useMemo(() => {
    if (editingTarget?.kind === 'playthrough') return editingTarget.playthrough
    if (editingCampaignRun) return mapCampaignRunSetupToPlaythrough(editingCampaignRun)
    return null
  }, [editingCampaignRun, editingTarget])

  const activeScenarioFormRun = editingScenarioContext?.campaignRun ?? continuationCampaignRun
  const activeScenarioLog = editingScenarioContext?.scenarioLog ?? undefined
  const isScenarioFormOpen = formOpen && Boolean(activeScenarioFormRun) && (Boolean(editingScenarioContext) || Boolean(continuationCampaignRunId))

  const handleSavePlaythrough = async (playthrough: Omit<Playthrough, 'id'> | Playthrough) => {
    setIsSaving(true)
    try {
      if (editingCampaignRun) {
        const payload = playthrough as Omit<Playthrough, 'id'> | Playthrough
        await campaignRunActions.edit(editingCampaignRun.id, {
          campaignName: payload.campaignName,
          campaignSet: payload.campaignSet,
          campaignType: payload.campaignType,
          customCampaignName: payload.customCampaignName,
          startedAt: payload.date,
          setupSnapshot: {
            date: payload.date,
            investigators: payload.investigators,
            notes: payload.notes,
          },
        })
        markCommunityStatsPending()
        toast.success('Campaign setup updated')
      } else if ('id' in playthrough) {
        await playthroughActions.update(playthrough)
        markCommunityStatsPending()
        toast.success('Playthrough updated successfully')
      } else {
        await playthroughActions.add(playthrough)
        markCommunityStatsPending()
        toast.success('Playthrough logged successfully')
      }
      setEditingTarget(null)
      setContinuationCampaignRunId(null)
      setPendingContinuationRun(null)
    } catch (error) {
      console.error('Failed to save playthrough:', error)
      const raw = error instanceof Error ? error.message : String(error)
      const display = raw.length > 120 ? `${raw.slice(0, 120)}…` : raw
      toast.error(`Failed to save playthrough: ${display}`)
      throw error
    } finally {
      setIsSaving(false)
    }
  }

  const getScenarioMutationErrorMessage = (error: unknown): string => {
    if (error instanceof CampaignRunMutationError) {
      if (error.code === 'CAMPAIGN_SCENARIO_LOG_STATEFUL_EDIT_BLOCKED') {
        return 'Only notes and metadata can be edited on non-latest scenario logs. Update the latest scenario for roster/outcome changes.'
      }
      if (error.code === 'CAMPAIGN_SCENARIO_LOG_DELETE_BLOCKED') {
        return 'Only the latest scenario log can be deleted to protect campaign history.'
      }
      if (error.code === 'CAMPAIGN_RUN_SETUP_INVESTIGATORS_LOCKED') {
        return 'Campaign setup investigators are locked once scenario history exists. Continue the campaign to adjust roster state.'
      }
      return error.message
    }
    return error instanceof Error ? error.message : 'Failed to save campaign scenario log.'
  }

  const handleSaveCampaignScenario = async (payload: {
    date: string
    scenarioName: string
    investigators?: Playthrough['investigators']
    sideStories?: string[]
    notes?: string
    scenarioType?: CampaignScenarioLog['scenarioType']
    resolution?: CampaignScenarioLog['resolution']
    rosterBefore?: CampaignScenarioLog['rosterBefore']
    investigatorOutcomes?: CampaignScenarioLog['investigatorOutcomes']
    preScenarioAdjustments?: CampaignScenarioLog['preScenarioAdjustments']
    rosterChanges?: CampaignScenarioLog['rosterChanges']
    rosterAfter?: CampaignScenarioLog['rosterAfter']
  }) => {
    setIsSaving(true)
    try {
      if (editingScenarioContext) {
        await campaignRunActions.editScenario(
          editingScenarioContext.campaignRun.id,
          editingScenarioContext.scenarioLog.id,
          payload,
        )
        markCommunityStatsPending()
        setExpandedCampaignRunIds((current) => {
          const next = new Set(current)
          next.add(editingScenarioContext.campaignRun.id)
          return next
        })
        toast.success('Scenario log updated')
      } else if (continuationCampaignRunId) {
        if (!payload.investigators) {
          throw new Error('Investigator participation is required when logging a new scenario.')
        }
        await campaignRunActions.appendScenario(continuationCampaignRunId, {
          ...payload,
          investigators: payload.investigators,
        })
        markCommunityStatsPending()
        setExpandedCampaignRunIds((current) => {
          const next = new Set(current)
          next.add(continuationCampaignRunId)
          return next
        })
        toast.success('Scenario logged to campaign run')
      } else {
        throw new Error('No campaign run is selected for this scenario log.')
      }
      setEditingTarget(null)
      setContinuationCampaignRunId(null)
      setPendingContinuationRun(null)
    } catch (error) {
      const message = getScenarioMutationErrorMessage(error)
      toast.error(message)
      throw new Error(message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleImportData = async (payload: NormalizedImportPayload) => {
    await importNormalizedData(currentUser.id, payload)
    markCommunityStatsPending()
  }

  const handleDeletePlaythrough = async () => {
    if (!deleteTarget) return
    try {
      if (deleteTarget.kind === 'playthrough') {
        await playthroughActions.remove(deleteTarget.id)
        markCommunityStatsPending()
        toast.success('Playthrough deleted')
      } else if (deleteTarget.kind === 'campaign-run') {
        await campaignRunActions.remove(deleteTarget.campaignRunId)
        markCommunityStatsPending()
        setExpandedCampaignRunIds((current) => {
          const next = new Set(current)
          next.delete(deleteTarget.campaignRunId)
          return next
        })
        toast.success('Campaign run deleted')
      } else if (deleteTarget.kind === 'campaign-scenario') {
        await campaignRunActions.removeScenario(deleteTarget.campaignRunId, deleteTarget.scenarioLogId)
        markCommunityStatsPending()
        toast.success('Scenario log deleted')
      }
    } catch (error) {
      console.error('Failed to delete record:', error)
      toast.error(getScenarioMutationErrorMessage(error))
    } finally {
      setDeleteTarget(null)
    }
  }

  const handleEdit = (playthrough: Playthrough) => {
    setEditingTarget({ kind: 'playthrough', playthrough })
    setContinuationCampaignRunId(null)
    setPendingContinuationRun(null)
    setFormOpen(true)
  }

  const handleContinueCampaign = async (playthrough: Playthrough) => {
    try {
      const promotion = await promotePlaythroughToCampaignRun(currentUser.id, playthrough.id)
      if (promotion.status !== 'already-promoted') {
        markCommunityStatsPending()
      }
      const promotedRun = campaignRuns.find((campaignRun) => campaignRun.id === promotion.campaignRunId)
      setEditingTarget(null)
      setContinuationCampaignRunId(promotion.campaignRunId)
      setPendingContinuationRun(
        promotedRun ??
        buildCampaignRunFromSourcePlaythrough(playthrough, {
          campaignRunId: promotion.campaignRunId,
        }),
      )
      setFormOpen(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to continue campaign'
      toast.error(message)
    }
  }

  const handleContinueCampaignRun = (campaignRun: CampaignRun) => {
    if (campaignRun.campaignType === 'Scenario Pack' && getActualCampaignScenarioLogs(campaignRun).length > 0) {
      toast.error('Standalone Scenario Packs can record only one scenario result.')
      return
    }
    setEditingTarget(null)
    setContinuationCampaignRunId(campaignRun.id)
    setPendingContinuationRun(campaignRun)
    setFormOpen(true)
  }

  const handleEditCampaignRun = (campaignRun: CampaignRun) => {
    setEditingTarget({ kind: 'campaign-run', campaignRunId: campaignRun.id })
    setContinuationCampaignRunId(null)
    setPendingContinuationRun(null)
    setFormOpen(true)
  }

  const handleEditCampaignScenario = (campaignRun: CampaignRun, scenarioLog: CampaignScenarioLog) => {
    setEditingTarget({
      kind: 'campaign-scenario',
      campaignRunId: campaignRun.id,
      scenarioLogId: scenarioLog.id,
    })
    setContinuationCampaignRunId(null)
    setPendingContinuationRun(null)
    setFormOpen(true)
  }

  const handleNewGame = () => {
    setEditingTarget(null)
    setContinuationCampaignRunId(null)
    setPendingContinuationRun(null)
    setFormOpen(true)
  }

  const handleFormOpenChange = (open: boolean) => {
    setFormOpen(open)
    if (!open) {
      setEditingTarget(null)
      setContinuationCampaignRunId(null)
      setPendingContinuationRun(null)
    }
  }

  const toggleCampaignRunExpanded = (campaignRunId: string) => {
    setExpandedCampaignRunIds((current) => {
      const next = new Set(current)
      if (next.has(campaignRunId)) {
        next.delete(campaignRunId)
      } else {
        next.add(campaignRunId)
      }
      return next
    })
  }

  const deleteDialogTitle = deleteTarget?.kind === 'campaign-run'
    ? 'Delete Campaign Run?'
    : deleteTarget?.kind === 'campaign-scenario'
      ? 'Delete Scenario Log?'
      : 'Delete Playthrough?'

  const deleteDialogDescription = deleteTarget?.kind === 'campaign-run'
    ? `This action cannot be undone. "${deleteTarget.campaignName}" and its scenario logs will be removed from this view.`
    : deleteTarget?.kind === 'campaign-scenario'
      ? `This action cannot be undone. "${deleteTarget.scenarioName}" will be removed from this campaign run.`
      : 'This action cannot be undone. This playthrough will be permanently removed from your log.'

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster position="top-center" />

      <AppHeader
        currentUser={currentUser}
        onNewGame={handleNewGame}
        onSignOut={onSignOut}
        isGoogleUser={passwordLink.isGoogleUser}
        hasPasswordLinked={passwordLink.hasPasswordLinked}
        onOpenPasswordLink={() => passwordLink.setLinkPasswordOpen(true)}
        playthroughs={playthroughs}
        campaignRuns={campaignRuns}
        onImportData={handleImportData}
      />

      <main className="container mx-auto px-6 py-8 md:pb-8 pb-24">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="hidden md:grid w-full max-w-2xl mx-auto grid-cols-3">
            <TabsTrigger value="games" className="gap-2">
              <BookOpen size={18} weight="duotone" />
              All Games
            </TabsTrigger>
            <TabsTrigger value="players" className="gap-2">
              <User size={18} weight="duotone" />
              Players
            </TabsTrigger>
            <TabsTrigger value="community" className="gap-2">
              <UsersThree size={18} weight="duotone" />
              Community
            </TabsTrigger>
          </TabsList>

          <TabsContent value="games" className="space-y-6">
            <GamesTab
              isLoading={isLoadingGames}
              playthroughs={playthroughs}
              campaignRuns={campaignRuns}
              topLevelRows={topLevelRows}
              filteredTopLevelRows={filteredTopLevelRows}
              filterPlaythroughs={topLevelFilterPlaythroughs}
              filters={filters}
              filterHandlers={filterHandlers}
              onEdit={handleEdit}
              onContinueCampaign={handleContinueCampaign}
              onContinueCampaignRun={handleContinueCampaignRun}
              onEditCampaignRun={handleEditCampaignRun}
              onDeleteCampaignRun={(campaignRun) => {
                setDeleteTarget({
                  kind: 'campaign-run',
                  campaignRunId: campaignRun.id,
                  campaignName: campaignRun.customCampaignName || campaignRun.campaignName,
                })
              }}
              onEditCampaignScenario={handleEditCampaignScenario}
              onDeleteCampaignScenario={(campaignRun, scenarioLog) => {
                setDeleteTarget({
                  kind: 'campaign-scenario',
                  campaignRunId: campaignRun.id,
                  scenarioLogId: scenarioLog.id,
                  scenarioName: scenarioLog.scenarioName,
                })
              }}
              expandedCampaignRunIds={expandedCampaignRunIds}
              onToggleCampaignRunExpanded={toggleCampaignRunExpanded}
              onDelete={(id) => setDeleteTarget({ kind: 'playthrough', id })}
            />
          </TabsContent>

          <TabsContent value="players" className="space-y-6">
            <PlayersTab
              isLoading={isLoadingGames}
              playthroughs={investigatorPlaythroughs}
              allPlayers={allPlayers}
              selectedPlayer={selectedPlayer}
              onSelectPlayer={setSelectedPlayer}
            />
          </TabsContent>

          <TabsContent value="community" className="space-y-6">
            <CommunityStats />
            <CompletionStatsPanel
              playthroughs={flattenedPlaythroughs}
              communityBreakdown={communityStats?.completionBreakdown}
              communityTotal={communityStats?.totalGames}
            />
            <InvestigatorHeatmap
              playthroughs={flattenedPlaythroughs}
              communityPairings={communityStats?.topPairings}
            />
          </TabsContent>
        </Tabs>
      </main>

      <PlaythroughForm
        open={formOpen && !isScenarioFormOpen}
        onOpenChange={handleFormOpenChange}
        onSave={handleSavePlaythrough}
        editPlaythrough={editPlaythroughForForm}
        knownPlayerNames={knownPlayerNames}
        isSaving={isSaving}
      />

      {activeScenarioFormRun && (
        <CampaignScenarioForm
          open={isScenarioFormOpen}
          onOpenChange={handleFormOpenChange}
          campaignRun={activeScenarioFormRun}
          mode={editingScenarioContext ? 'edit' : 'append'}
          scenarioLog={activeScenarioLog}
          onSave={handleSaveCampaignScenario}
          isSaving={isSaving}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteDialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialogDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePlaythrough} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PasswordLinkDialog
        currentUser={currentUser}
        open={passwordLink.linkPasswordOpen}
        onOpenChange={passwordLink.setLinkPasswordOpen}
        password={passwordLink.linkPassword}
        onPasswordChange={passwordLink.setLinkPassword}
        passwordConfirm={passwordLink.linkPasswordConfirm}
        onPasswordConfirmChange={passwordLink.setLinkPasswordConfirm}
        loading={passwordLink.linkPasswordLoading}
        onSubmit={passwordLink.handleLinkPassword}
      />

      <MobileNav activeTab={activeTab} onTabChange={handleTabChange} />
    </div>
  )
}

function App() {
  const { currentUser, isLoading, signOut } = useAuthState()

  const handleAuthSuccess = async (_user: AuthUser) => {}

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <BookOpen size={48} className="text-primary mx-auto mb-4" weight="duotone" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return <PublicHomepage onAuthSuccess={handleAuthSuccess} />
  }

  return (
    <AuthenticatedApp
      currentUser={currentUser}
      onSignOut={signOut}
    />
  )
}

export default App
