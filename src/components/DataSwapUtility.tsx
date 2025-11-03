import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { Playthrough } from '@/lib/types'

export function DataSwapUtility() {
  const [isProcessing, setIsProcessing] = useState(false)

  const swapUserData = async () => {
    setIsProcessing(true)
    try {
      const devinEmail = 'contact@devinsinha.com'
      const giffEmail = 'giffdev@gmail.com'

      const devinUserData = await spark.kv.get<{ id: string }>(`user:${devinEmail}`)
      const giffUserData = await spark.kv.get<{ id: string }>(`user:${giffEmail}`)

      if (!devinUserData || !giffUserData) {
        toast.error('Could not find one or both user accounts')
        return
      }

      const devinKey = `${devinUserData.id}_playthroughs`
      const giffKey = `${giffUserData.id}_playthroughs`

      const devinPlaythroughs = await spark.kv.get<Playthrough[]>(devinKey)
      const giffPlaythroughs = await spark.kv.get<Playthrough[]>(giffKey)

      console.log('Devin playthroughs:', devinPlaythroughs?.length || 0)
      console.log('Giff playthroughs:', giffPlaythroughs?.length || 0)

      await spark.kv.set(devinKey, giffPlaythroughs || [])
      await spark.kv.set(giffKey, devinPlaythroughs || [])

      toast.success(`Swapped data: contact@devinsinha.com now has ${giffPlaythroughs?.length || 0} playthroughs, giffdev@gmail.com now has ${devinPlaythroughs?.length || 0} playthroughs`)
    } catch (error) {
      console.error('Error swapping data:', error)
      toast.error('Failed to swap data')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Card className="p-6 bg-destructive/10 border-destructive">
      <h3 className="font-semibold mb-2 text-destructive">Admin Data Swap Utility</h3>
      <p className="text-sm text-muted-foreground mb-4">
        This will swap playthrough data between contact@devinsinha.com and giffdev@gmail.com
      </p>
      <Button 
        onClick={swapUserData} 
        disabled={isProcessing}
        variant="destructive"
      >
        {isProcessing ? 'Swapping...' : 'Swap User Data'}
      </Button>
    </Card>
  )
}
