import { BookOpen } from '@phosphor-icons/react'

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="rounded-full bg-muted p-6 mb-6">
        <BookOpen size={48} className="text-muted-foreground" />
      </div>
      <h3 className="text-2xl font-semibold mb-2 text-foreground">No Playthroughs Yet</h3>
      <p className="text-muted-foreground max-w-md">
        Start logging your Arkham Horror adventures! Click "Log New Campaign" to record your first campaign playthrough.
      </p>
    </div>
  )
}
