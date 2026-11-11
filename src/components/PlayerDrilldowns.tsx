import { useState, type ReactNode } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface PlayerDrilldownsProps {
  children: ReactNode
  campaigns?: ReactNode
  view?: string
  onViewChange?: (view: string) => void
}

export function PlayerDrilldowns({ children, campaigns, view: controlledView, onViewChange }: PlayerDrilldownsProps) {
  const [localView, setLocalView] = useState('investigators')
  const view = controlledView ?? localView

  if (!campaigns) return children

  return (
    <Tabs value={view} onValueChange={onViewChange ?? setLocalView}>
      <TabsList aria-label="Player drilldown" className="w-full sm:w-fit">
        <TabsTrigger value="investigators">Investigators</TabsTrigger>
        <TabsTrigger value="campaigns">Campaigns &amp; Scenarios</TabsTrigger>
      </TabsList>
      {/* Keep each drilldown's filters while removing inactive content from the accessibility tree. */}
      <TabsContent value="investigators" forceMount hidden={view !== 'investigators'} className="data-[state=inactive]:hidden">
        {children}
      </TabsContent>
      <TabsContent value="campaigns" forceMount hidden={view !== 'campaigns'} className="data-[state=inactive]:hidden">
        {campaigns}
      </TabsContent>
    </Tabs>
  )
}
