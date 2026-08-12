import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Plus, User, SignOut, CaretDown, Lock } from '@phosphor-icons/react'
import { User as AuthUser } from '@/lib/auth'
import { getBrandSvgRaw } from '@/lib/campaign-icon-map'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'

interface AppHeaderProps {
  currentUser: AuthUser
  onNewGame: () => void
  onSignOut: () => void
  isGoogleUser: boolean
  hasPasswordLinked: boolean
  onOpenPasswordLink: () => void
}

function injectSize(svgString: string, size: number): string {
  return svgString.replace(
    /<svg\b([^>]*)>/,
    (_, attrs: string) => {
      const stripped = attrs.replace(/\s*(width|height)="[^"]*"/g, '')
      return `<svg${stripped} width="${size}" height="${size}">`
    },
  )
}

interface BrandIconProps {
  size?: number
  className?: string
}

function CodexIcon({ size = 24, className }: BrandIconProps) {
  const raw = useMemo(() => injectSize(getBrandSvgRaw('codex'), size), [size])
  return (
    <span
      aria-hidden="true"
      className={cn('inline-flex flex-shrink-0', className)}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: raw }}
    />
  )
}

export function AppHeader({ currentUser, onNewGame, onSignOut, isGoogleUser, hasPasswordLinked, onOpenPasswordLink }: AppHeaderProps) {
  return (
    <header className="border-b bg-card/50 backdrop-blur-sm md:sticky md:top-0 z-10">
      <div className="container mx-auto px-6 py-4 md:py-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
            <CodexIcon size={24} className="md:w-8 md:h-8 text-primary flex-shrink-0" />
            <h1 className="text-lg md:text-3xl font-bold truncate text-foreground">Arkham Horror LCG Tracker</h1>
          </div>
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            <Button onClick={onNewGame} className="gap-1.5 md:gap-2 text-xs md:text-sm">
              <Plus size={18} className="md:w-5 md:h-5" weight="bold" />
              <span className="hidden sm:inline">Log New Game</span>
              <span className="sm:hidden">New</span>
            </Button>
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
                {isGoogleUser && !hasPasswordLinked && (
                  <DropdownMenuItem 
                    onClick={onOpenPasswordLink}
                    className="gap-2 cursor-pointer"
                  >
                    <Lock size={16} weight="bold" />
                    Set Password
                  </DropdownMenuItem>
                )}
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
          </div>
        </div>
      </div>
    </header>
  )
}
