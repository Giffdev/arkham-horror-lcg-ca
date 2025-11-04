import { useState, useMemo, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { Playthrough, Archetype, CampaignType } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { PlaythroughCard } from '@/components/PlaythroughCard'
import { PlaythroughForm } from '@/components/PlaythroughForm'
import { EmptyState } from '@/components/EmptyState'
import { Filters } from '@/components/Filters'
import { PlayerStats } from '@/components/PlayerStats'
import { PlayersOverview } from '@/components/PlayersOverview'
import { CommunityStats } from '@/components/CommunityStats'

import { Plus, BookOpen, User, SignOut, CaretDown, UsersThree } from '@phosphor-icons/react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Toaster, toast } from 'sonner'
import { getInvestigatorByName } from '@/lib/investigator-data'
import { getCurrentSession, clearCurrentSession, User as AuthUser } from '@/lib/auth'
import { PublicHomepage } from '@/components/PublicHomepage'
import { rebuildCommunityStats } from '@/lib/community-stats'

interface AuthenticatedAppProps {
  currentUser: AuthUser
  playthroughsKey: string
  onSignOut: () => void
}

function AuthenticatedApp({ currentUser, playthroughsKey, onSignOut }: AuthenticatedAppProps) {
  const [playthroughs, setPlaythroughs] = useKV<Playthrough[]>(playthroughsKey, [])
  const [formOpen, setFormOpen] = useState(false)
  const [editingPlaythrough, setEditingPlaythrough] = useState<Playthrough | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [selectedArchetypes, setSelectedArchetypes] = useState<Archetype[]>([])
  const [selectedCampaignTypes, setSelectedCampaignTypes] = useState<CampaignType[]>([])
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)
  const [isLoadingPlaythroughs, setIsLoadingPlaythroughs] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoadingPlaythroughs(false)
    }, 500)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!playthroughs || playthroughs.length === 0) return

    let needsUpdate = false
    const updatedPlaythroughs = playthroughs.map(playthrough => {
      const updatedInvestigators = playthrough.investigators.map(inv => {
        if (inv.isCustom || inv.isUnknown || inv.investigatorName === 'Unknown') {
          return inv
        }
        
        const investigatorData = getInvestigatorByName(inv.investigatorName)
        let hasChanges = false
        const updates: Partial<typeof inv> = {}
        
        if (!inv.investigatorSet && investigatorData) {
          updates.investigatorSet = investigatorData.set
          hasChanges = true
        }
        
        if (!inv.archetypes && investigatorData) {
          updates.archetypes = investigatorData.archetypes
          hasChanges = true
        }
        
        if (hasChanges) {
          needsUpdate = true
          return { ...inv, ...updates }
        }
        
        return inv
      })

      if (JSON.stringify(updatedInvestigators) !== JSON.stringify(playthrough.investigators)) {
        return { ...playthrough, investigators: updatedInvestigators }
      }
      
      return playthrough
    })

    if (needsUpdate) {
      setPlaythroughs(updatedPlaythroughs)
    }
  }, [playthroughs, setPlaythroughs])

  const filteredPlaythroughs = useMemo(() => {
    if (!playthroughs) return []
    
    return playthroughs.filter((playthrough) => {
      if (selectedArchetypes.length > 0) {
        const hasMatchingArchetype = playthrough.investigators.some((inv) => {
          const investigatorArchetypes = inv.archetypes || [inv.archetype]
          return investigatorArchetypes.some(archetype => selectedArchetypes.includes(archetype))
        })
        if (!hasMatchingArchetype) return false
      }

      if (selectedCampaignTypes.length > 0) {
        if (!selectedCampaignTypes.includes(playthrough.campaignType)) {
          return false
        }
      }

      if (selectedCampaigns.length > 0) {
        const campaignName = playthrough.customCampaignName || playthrough.campaignName
        if (!selectedCampaigns.includes(campaignName)) {
          return false
        }
      }

      return true
    })
  }, [playthroughs, selectedArchetypes, selectedCampaignTypes, selectedCampaigns])

  const handleSavePlaythrough = (playthrough: Omit<Playthrough, 'id'> | Playthrough) => {
    setPlaythroughs((current) => {
      const existing = current || []
      if ('id' in playthrough) {
        toast.success('Playthrough updated successfully')
        return existing.map((p) => (p.id === playthrough.id ? playthrough : p))
      } else {
        const newPlaythrough = {
          ...playthrough,
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        } as Playthrough
        toast.success('Playthrough logged successfully')
        return [newPlaythrough, ...existing]
      }
    })
    setEditingPlaythrough(null)
    
    setTimeout(() => {
      rebuildCommunityStats()
    }, 500)
  }

  const handleDeletePlaythrough = () => {
    if (deleteId) {
      setPlaythroughs((current) => (current || []).filter((p) => p.id !== deleteId))
      toast.success('Playthrough deleted')
      setDeleteId(null)
      
      setTimeout(() => {
        rebuildCommunityStats()
      }, 500)
    }
  }

  const handleEdit = (playthrough: Playthrough) => {
    setEditingPlaythrough(playthrough)
    setFormOpen(true)
  }

  const handleNewGame = () => {
    setEditingPlaythrough(null)
    setFormOpen(true)
  }

  const handleArchetypeToggle = (archetype: Archetype) => {
    setSelectedArchetypes((current) =>
      current.includes(archetype)
        ? current.filter((a) => a !== archetype)
        : [...current, archetype]
    )
  }

  const handleCampaignTypeToggle = (type: CampaignType) => {
    setSelectedCampaignTypes((current) =>
      current.includes(type)
        ? current.filter((t) => t !== type)
        : [...current, type]
    )
    if (selectedCampaignTypes.includes(type)) {
      setSelectedCampaigns([])
    }
  }

  const handleCampaignToggle = (campaign: string) => {
    setSelectedCampaigns((current) =>
      current.includes(campaign)
        ? current.filter((c) => c !== campaign)
        : [...current, campaign]
    )
  }

  const handleClearFilters = () => {
    setSelectedArchetypes([])
    setSelectedCampaignTypes([])
    setSelectedCampaigns([])
  }

  const allPlayers = useMemo(() => {
    if (!playthroughs) return []
    
    const playerSet = new Set<string>()
    playthroughs.forEach(playthrough => {
      playthrough.investigators.forEach(inv => {
        if (inv.playerName.trim()) {
          playerSet.add(inv.playerName)
        }
      })
    })
    
    return Array.from(playerSet).sort((a, b) => a.localeCompare(b))
  }, [playthroughs])

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" />
      
      <header className="border-b bg-card/50 backdrop-blur-sm md:sticky md:top-0 z-10">
        <div className="container mx-auto px-6 py-4 md:py-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
              <BookOpen size={24} className="md:w-8 md:h-8 text-primary flex-shrink-0" weight="duotone" />
              <h1 className="text-lg md:text-3xl font-bold truncate text-foreground">Arkham Horror LCG Tracker</h1>
            </div>
            <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
              <Button onClick={handleNewGame} className="gap-1.5 md:gap-2 text-xs md:text-sm">
                <Plus size={18} className="md:w-5 md:h-5" weight="bold" />
                <span className="hidden sm:inline">Log New Game</span>
                <span className="sm:hidden">New</span>
              </Button>
              {currentUser && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="gap-2 px-3 py-2"
                    >
                      <User size={16} weight="fill" className="text-primary" />
                      <span className="text-sm hidden sm:inline">{currentUser.email}</span>
                      <span className="text-sm sm:hidden">Profile</span>
                      <CaretDown size={14} weight="bold" className="opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem 
                      onClick={onSignOut}
                      variant="destructive"
                      className="gap-2 cursor-pointer"
                    >
                      <SignOut size={16} weight="bold" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <Tabs defaultValue="games" className="space-y-6">
          <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-3">
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
            <Filters
              selectedArchetypes={selectedArchetypes}
              selectedCampaignTypes={selectedCampaignTypes}
              selectedCampaigns={selectedCampaigns}
              onArchetypeToggle={handleArchetypeToggle}
              onCampaignTypeToggle={handleCampaignTypeToggle}
              onCampaignToggle={handleCampaignToggle}
              onClearFilters={handleClearFilters}
              playthroughs={playthroughs || []}
            />

            {isLoadingPlaythroughs ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <BookOpen size={48} className="text-primary mb-4 animate-pulse" weight="duotone" />
                <p className="text-muted-foreground">Loading playthroughs...</p>
              </div>
            ) : playthroughs && playthroughs.length === 0 ? (
              <EmptyState />
            ) : filteredPlaythroughs.length === 0 && playthroughs && playthroughs.length > 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground">
                  No playthroughs match your selected filters.
                </p>
              </div>
            ) : playthroughs && playthroughs.length > 0 ? (
              <div className="space-y-3">
                {filteredPlaythroughs.map((playthrough) => (
                  <PlaythroughCard
                    key={playthrough.id}
                    playthrough={playthrough}
                    onEdit={handleEdit}
                    onDelete={setDeleteId}
                    activeArchetypeFilters={selectedArchetypes}
                  />
                ))}
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="players" className="space-y-6">
            {isLoadingPlaythroughs ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <BookOpen size={48} className="text-primary mb-4 animate-pulse" weight="duotone" />
                <p className="text-muted-foreground">Loading playthroughs...</p>
              </div>
            ) : playthroughs && playthroughs.length === 0 ? (
              <EmptyState />
            ) : playthroughs && playthroughs.length > 0 && allPlayers.length === 0 ? (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">
                  No players found. Add player names when logging games to see player statistics.
                </p>
              </Card>
            ) : playthroughs && playthroughs.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-1">
                  <Card className="p-4">
                    <h3 className="font-semibold mb-4">Players ({allPlayers.length})</h3>
                    <div className="space-y-2">
                      {allPlayers.map((player) => (
                        <Button
                          key={player}
                          variant={selectedPlayer === player ? 'default' : 'ghost'}
                          className="w-full justify-start gap-2"
                          onClick={() => {
                            setSelectedPlayer(selectedPlayer === player ? null : player)
                          }}
                        >
                          <User size={16} weight={selectedPlayer === player ? 'fill' : 'regular'} />
                          {player}
                        </Button>
                      ))}
                    </div>
                  </Card>
                </div>

                <div className="lg:col-span-3">
                  {selectedPlayer ? (
                    <PlayerStats playerName={selectedPlayer} playthroughs={playthroughs} />
                  ) : (
                    <PlayersOverview playthroughs={playthroughs} />
                  )}
                </div>
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="community" className="space-y-6">
            <CommunityStats />
          </TabsContent>
        </Tabs>
      </main>

      <PlaythroughForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSave={handleSavePlaythrough}
        editPlaythrough={editingPlaythrough}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Playthrough?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This playthrough will be permanently removed from your log.
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
    </div>
  )
}

function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [playthroughsKey, setPlaythroughsKey] = useState<string>('')

  useEffect(() => {
    async function loadSession() {
      try {
        const session = await getCurrentSession()
        if (session) {
          setCurrentUser({ 
            id: session.userId, 
            email: session.email,
            createdAt: Date.now(),
            authProvider: session.authProvider
          })
          const newKey = `${session.userId}_playthroughs`
          setPlaythroughsKey(newKey)
          
          const existingData = await spark.kv.get<Playthrough[]>(newKey)
          if (!existingData || existingData.length === 0) {
            const oldData = await spark.kv.get<Playthrough[]>('playthroughs')
            if (oldData && oldData.length > 0) {
              await spark.kv.set(newKey, oldData)
              await spark.kv.delete('playthroughs')
              toast.success(`Migrated ${oldData.length} playthroughs to your account`)
              await rebuildCommunityStats()
            }
          } else {
            await rebuildCommunityStats()
          }
        } else {
          await rebuildCommunityStats()
        }
      } catch (error) {
        console.error('Failed to load session:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadSession()
  }, [])



  const handleAuthSuccess = async (user: AuthUser) => {
    setCurrentUser(user)
    const newKey = `${user.id}_playthroughs`
    setPlaythroughsKey(newKey)
    
    const existingData = await spark.kv.get<Playthrough[]>(newKey)
    if (!existingData || existingData.length === 0) {
      const oldData = await spark.kv.get<Playthrough[]>('playthroughs')
      if (oldData && oldData.length > 0) {
        await spark.kv.set(newKey, oldData)
        await spark.kv.delete('playthroughs')
        toast.success(`Migrated ${oldData.length} playthroughs to your account`)
        await rebuildCommunityStats()
      }
    } else {
      await rebuildCommunityStats()
    }
  }

  const handleSignOut = async () => {
    await clearCurrentSession()
    setCurrentUser(null)
    setPlaythroughsKey('')
    toast.success('Signed out successfully')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <BookOpen size={48} className="text-primary mx-auto mb-4" weight="duotone" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!currentUser || !playthroughsKey) {
    return <PublicHomepage onAuthSuccess={handleAuthSuccess} />
  }

  return (
    <AuthenticatedApp
      currentUser={currentUser}
      playthroughsKey={playthroughsKey}
      onSignOut={handleSignOut}
    />
  )
}

export default App
