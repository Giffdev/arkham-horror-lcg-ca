import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BookOpen, SignIn, Users, ChartBar, Sparkle } from '@phosphor-icons/react'
import { AuthDialog } from '@/components/AuthDialog'
import { User } from '@/lib/auth'

interface PublicHomepageProps {
  onAuthSuccess: (user: User) => void
}

export function PublicHomepage({ onAuthSuccess }: PublicHomepageProps) {
  const [authDialogOpen, setAuthDialogOpen] = useState(false)

  const handleLogin = () => {
    setAuthDialogOpen(true)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4 md:py-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 md:gap-3">
              <BookOpen size={24} className="md:w-8 md:h-8 text-primary" weight="duotone" />
              <h1 className="text-lg md:text-3xl font-bold text-foreground">Arkham Horror LCG Tracker</h1>
            </div>
            <Button onClick={handleLogin} className="gap-2">
              <SignIn size={18} weight="bold" />
              Sign In
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground">
              Track Your Arkham Horror Adventures
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Log your campaign playthroughs, track investigators and players, and explore your gaming history.
              Create an account to get started.
            </p>
            <div className="pt-4">
              <Button onClick={handleLogin} size="lg" className="gap-2">
                <SignIn size={20} weight="bold" />
                Sign In to Get Started
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto mb-2 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BookOpen size={24} className="text-primary" weight="duotone" />
                </div>
                <CardTitle className="text-foreground">Log Campaigns</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Record your full campaigns, standalone scenarios, and custom fan-made adventures with complete investigator details.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto mb-2 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users size={24} className="text-primary" weight="duotone" />
                </div>
                <CardTitle className="text-foreground">Track Players</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  View detailed statistics for each player including campaigns played, favorite investigators, and most-used classes.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto mb-2 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ChartBar size={24} className="text-primary" weight="duotone" />
                </div>
                <CardTitle className="text-foreground">Analyze History</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Filter by archetype or campaign type, and discover patterns in your gaming sessions over time.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkle size={24} className="text-primary" weight="duotone" />
                <CardTitle className="text-foreground">Features</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                <p className="text-foreground">
                  <span className="font-medium">Comprehensive Campaign Library</span> - Choose from all official campaigns, standalone scenarios, or log custom fan-made content
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                <p className="text-foreground">
                  <span className="font-medium">Complete Investigator Database</span> - Auto-detect investigator classes from the entire card pool with support for dual-class characters
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                <p className="text-foreground">
                  <span className="font-medium">Side Story Tracking</span> - Record which standalone scenarios you included during campaign playthroughs
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                <p className="text-foreground">
                  <span className="font-medium">Player Statistics</span> - View detailed breakdowns for each player including their favorite classes and campaign history
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                <p className="text-foreground">
                  <span className="font-medium">Flexible Filtering</span> - Filter your playthrough history by investigator archetype or campaign type
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                <p className="text-foreground">
                  <span className="font-medium">Data Import/Export</span> - Backup your data or share playthroughs with friends via JSON export
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="text-center">
            <Button onClick={handleLogin} size="lg" className="gap-2">
              <SignIn size={20} weight="bold" />
              Create Account or Sign In
            </Button>
            <p className="text-sm text-muted-foreground mt-4">
              All your data is private and securely stored
            </p>
          </div>
        </div>
      </main>

      <AuthDialog 
        open={authDialogOpen} 
        onOpenChange={setAuthDialogOpen} 
        onSuccess={onAuthSuccess}
      />
    </div>
  )
}
