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
import { PublicHomepage } from '@/components/PublicHomepage'
import { Plus, BookOpen, User, SignOut } from '@phosphor-icons/react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Toaster, toast } from 'sonner'
import { getInvestigatorByName } from '@/lib/investigator-data'
import { getCurrentSession, clearCurrentSession, User as AuthUser } from '@/lib/auth'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [userKVKey, setUserKVKey] = useState<string>('')
  const [playthroughs, setPlaythroughs] = useKV<Playthrough[]>(userKVKey || 'temp', [])
  const [formOpen, setFormOpen] = useState(false)
  const [editingPlaythrough, setEditingPlaythrough] = useState<Playthrough | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [selectedArchetypes, setSelectedArchetypes] = useState<Archetype[]>([])
  const [selectedCampaignTypes, setSelectedCampaignTypes] = useState<CampaignType[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)

  useEffect(() => {
    async function loadUser() {
      try {
        const session = await getCurrentSession()
        if (session) {
          setCurrentUser({ id: session.userId, email: session.email, createdAt: Date.now() })
          setUserKVKey(`${session.userId}_playthroughs`)
        } else {
          setCurrentUser(null)
        }
      } catch (error) {
        console.log('No active session')
        setCurrentUser(null)
      } finally {
        setLoading(false)
      }
    }
    loadUser()
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

      return true
    })
  }, [playthroughs, selectedArchetypes, selectedCampaignTypes])

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
  }

  const handleDeletePlaythrough = () => {
    if (deleteId) {
      setPlaythroughs((current) => (current || []).filter((p) => p.id !== deleteId))
      toast.success('Playthrough deleted')
      setDeleteId(null)
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
  }

  const handleClearFilters = () => {
    setSelectedArchetypes([])
    setSelectedCampaignTypes([])
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

  const handleAuthSuccess = (user: AuthUser) => {
    setCurrentUser(user)
    setUserKVKey(`${user.id}_playthroughs`)
  }

  const handleSignOut = async () => {
    await clearCurrentSession()
    setCurrentUser(null)
    setUserKVKey('')
    toast.success('Signed out successfully')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <BookOpen size={48} className="text-primary animate-pulse" weight="duotone" />
      </div>
    )
  }

  if (!currentUser) {
    return <PublicHomepage onAuthSuccess={handleAuthSuccess} />
  }

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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 md:h-10 md:w-10 rounded-full p-0">
                    <User size={24} weight="fill" className="text-primary" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{currentUser.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={handleSignOut} 
                    className="text-destructive focus:text-destructive"
                  >
                    <SignOut size={16} className="mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <Tabs defaultValue="games" className="space-y-6">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
            <TabsTrigger value="games" className="gap-2">
              <BookOpen size={18} weight="duotone" />
              All Games
            </TabsTrigger>
            <TabsTrigger value="players" className="gap-2">
              <User size={18} weight="duotone" />
              Players
            </TabsTrigger>
          </TabsList>

          <TabsContent value="games" className="space-y-6">
            <Filters
              selectedArchetypes={selectedArchetypes}
              selectedCampaignTypes={selectedCampaignTypes}
              onArchetypeToggle={handleArchetypeToggle}
              onCampaignTypeToggle={handleCampaignTypeToggle}
              onClearFilters={handleClearFilters}
            />

            {!playthroughs || playthroughs.length === 0 ? (
              <EmptyState />
            ) : filteredPlaythroughs.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground">
                  No playthroughs match your selected filters.
                </p>
              </div>
            ) : (
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
            )}
          </TabsContent>

          <TabsContent value="players" className="space-y-6">
            {!playthroughs || playthroughs.length === 0 ? (
              <EmptyState />
            ) : allPlayers.length === 0 ? (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">
                  No players found. Add player names when logging games to see player statistics.
                </p>
              </Card>
            ) : (
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
            )}
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

export default App