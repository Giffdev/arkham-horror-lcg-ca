import { BookOpen, User, UsersThree } from '@phosphor-icons/react'

interface MobileNavProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

export function MobileNav({ activeTab, onTabChange }: MobileNavProps) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border pb-safe z-50">
      <div className="grid grid-cols-3 gap-0 px-2 py-2 pb-3">
        <button
          onClick={() => onTabChange("games")}
          className={`flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-lg transition-colors ${
            activeTab === "games"
              ? "text-primary bg-primary/10"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <BookOpen size={24} weight={activeTab === "games" ? "fill" : "regular"} />
          <span className="text-xs font-medium">All Games</span>
        </button>
        <button
          onClick={() => onTabChange("players")}
          className={`flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-lg transition-colors ${
            activeTab === "players"
              ? "text-primary bg-primary/10"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <User size={24} weight={activeTab === "players" ? "fill" : "regular"} />
          <span className="text-xs font-medium">Players</span>
        </button>
        <button
          onClick={() => onTabChange("community")}
          className={`flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-lg transition-colors ${
            activeTab === "community"
              ? "text-primary bg-primary/10"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <UsersThree size={24} weight={activeTab === "community" ? "fill" : "regular"} />
          <span className="text-xs font-medium">Community</span>
        </button>
      </div>
    </nav>
  )
}
