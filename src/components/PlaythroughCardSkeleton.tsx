import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function PlaythroughCardSkeleton() {
  return (
    <Card className="p-4 md:p-6 overflow-hidden">
      <div className="flex flex-col md:flex-row gap-4 md:gap-6 md:items-start">
        <div className="md:min-w-[320px] md:flex-shrink-0 space-y-2">
          {/* Campaign name */}
          <Skeleton className="h-6 w-48" />
          {/* Campaign type badge + date */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          {/* Investigator rows */}
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-20 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
