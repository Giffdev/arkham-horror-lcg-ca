import { useState, type ReactNode } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface PlayerDrilldownsProps {
  children: ReactNode
  campaigns?: ReactNode
}

export function PlayerDrilldowns({ children, campaigns }: PlayerDrilldownsProps) {
  const [view, setView] = useState('investigators')

  if (!campaigns) return children

  return (
    <Tabs value={view} onValueChange={setView}>
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
