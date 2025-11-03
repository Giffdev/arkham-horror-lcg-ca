import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User } from '@/lib/auth'
import { Playthrough } from '@/lib/types'
import { migrateUserData } from '@/lib/migration'
import { toast } from 'sonner'

interface DebugPanelProps {
  currentUser: User
}

interface UserDebugInfo {
  user: User
  hasPassword: boolean
  playthroughCount: number
}

interface PlaythroughKeyDetails {
  key: string
  count: number
  playthroughs: Playthrough[]
}

export function DebugPanel({ currentUser }: DebugPanelProps) {
  const [allKeys, setAllKeys] = useState<string[]>([])
  const [userPlaythroughKeys, setUserPlaythroughKeys] = useState<string[]>([])
  const [playthroughCounts, setPlaythroughCounts] = useState<Record<string, number>>({})
  const [playthroughDetails, setPlaythroughDetails] = useState<PlaythroughKeyDetails[]>([])
  const [isOpen, setIsOpen] = useState(true)
  const [isMigrating, setIsMigrating] = useState(false)
  const [allUsers, setAllUsers] = useState<UserDebugInfo[]>([])
  const [resetEmail, setResetEmail] = useState('')
  const [resetPassword, setResetPassword] = useState('')
  const [isResetting, setIsResetting] = useState(false)
  const [showAllPlaythroughs, setShowAllPlaythroughs] = useState(false)

  const loadDebugInfo = async () => {
    const keys = await spark.kv.keys()
    setAllKeys(keys)
    
    const ptKeys = keys.filter(k => k.startsWith('playthroughs'))
    setUserPlaythroughKeys(ptKeys)
    
    const counts: Record<string, number> = {}
    const details: PlaythroughKeyDetails[] = []
    for (const key of ptKeys) {
      const data = await spark.kv.get<Playthrough[]>(key)
      counts[key] = data?.length || 0
      if (data) {
        details.push({
          key,
          count: data.length,
          playthroughs: data
        })
      }
    }
    setPlaythroughCounts(counts)
    setPlaythroughDetails(details)
    
    const userKeys = keys.filter(key => key.startsWith('user:') && !key.includes(':password') && !key.includes('password-reset'))
    const users: UserDebugInfo[] = []
    for (const key of userKeys) {
      const user = await spark.kv.get<User>(key)
      if (user) {
        const passwordData = await spark.kv.get(`${key}:password`)
        const userPlaythroughs = await spark.kv.get<Playthrough[]>(`playthroughs:${user.id}`)
        users.push({
          user,
          hasPassword: !!passwordData,
          playthroughCount: userPlaythroughs?.length || 0
        })
      }
    }
    setAllUsers(users)
  }

  const handleMigrate = async () => {
    setIsMigrating(true)
    try {
      await spark.kv.delete('migration:version')
      await migrateUserData()
      toast.success('Migration completed')
      await loadDebugInfo()
    } catch (error) {
      toast.error('Migration failed: ' + String(error))
    } finally {
      setIsMigrating(false)
    }
  }

  const handleResetMigration = async () => {
    try {
      await spark.kv.delete('migration:version')
      toast.success('Migration version reset')
      await loadDebugInfo()
    } catch (error) {
      toast.error('Failed to reset migration: ' + String(error))
    }
  }

  const handleFixGiffdevPlaythroughs = async () => {
    try {
      const generateUserIdFromEmail = async (email: string): Promise<string> => {
        const encoder = new TextEncoder()
        const data = encoder.encode(email.toLowerCase().trim())
        const hashBuffer = await crypto.subtle.digest('SHA-256', data)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
        return `user_${hashHex.substring(0, 16)}`
      }

      const giffdevId = await generateUserIdFromEmail('giffdev@gmail.com')
      const allKeys = await spark.kv.keys()
      console.log('[Fix] All keys:', allKeys)
      
      const allPlaythroughKeys = allKeys.filter(k => k.startsWith('playthroughs'))
      console.log('[Fix] All playthrough keys:', allPlaythroughKeys)
      
      let allPlaythroughs: Playthrough[] = []
      
      for (const key of allPlaythroughKeys) {
        const pts = await spark.kv.get<Playthrough[]>(key)
        if (pts && pts.length > 0) {
          console.log(`[Fix] Found ${pts.length} playthroughs in key: ${key}`)
          for (const pt of pts) {
            if (!allPlaythroughs.some(existing => existing.id === pt.id)) {
              allPlaythroughs.push(pt)
            }
          }
        }
      }
      
      console.log(`[Fix] Total unique playthroughs found: ${allPlaythroughs.length}`)
      
      if (allPlaythroughs.length > 0) {
        const targetKey = `playthroughs:${giffdevId}`
        console.log(`[Fix] Writing ${allPlaythroughs.length} playthroughs to ${targetKey}`)
        await spark.kv.set(targetKey, allPlaythroughs)
        
        const verify = await spark.kv.get<Playthrough[]>(targetKey)
        console.log(`[Fix] Verified: ${targetKey} now has ${verify?.length || 0} playthroughs`)
        
        toast.success(`Consolidated ${allPlaythroughs.length} playthroughs for giffdev@gmail.com`)
        await loadDebugInfo()
      } else {
        toast.error('No playthroughs found to consolidate')
      }
    } catch (error) {
      console.error('[Fix] Error:', error)
      toast.error('Failed to fix playthroughs: ' + String(error))
    }
  }

  const generateSalt = (): string => {
    const array = new Uint8Array(16)
    crypto.getRandomValues(array)
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  const hashPassword = async (password: string, salt: string): Promise<string> => {
    const encoder = new TextEncoder()
    const data = encoder.encode(password + salt)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  const handleResetPassword = async () => {
    if (!resetEmail || !resetPassword) {
      toast.error('Please enter both email and password')
      return
    }

    if (resetPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    setIsResetting(true)
    try {
      const normalizedEmail = resetEmail.toLowerCase().trim()
      const user = await spark.kv.get<User>(`user:${normalizedEmail}`)
      
      if (!user) {
        toast.error('User not found')
        return
      }

      const salt = generateSalt()
      const hashedPassword = await hashPassword(resetPassword, salt)
      
      await spark.kv.set(`user:${normalizedEmail}:password`, { hash: hashedPassword, salt })
      
      toast.success(`Password reset successfully for ${normalizedEmail}`)
      setResetEmail('')
      setResetPassword('')
      await loadDebugInfo()
    } catch (error) {
      toast.error('Failed to reset password: ' + String(error))
    } finally {
      setIsResetting(false)
    }
  }

  useEffect(() => {
    loadDebugInfo()
  }, [currentUser])

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="fixed bottom-4 right-4 z-50"
        onClick={() => setIsOpen(true)}
      >
        Show Debug Panel
      </Button>
    )
  }

  return (
    <Card className="fixed bottom-4 right-4 z-50 p-4 max-w-2xl max-h-[80vh] overflow-auto bg-card/95 backdrop-blur">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Debug Info & Password Reset</h3>
          <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
            Close
          </Button>
        </div>
        
        <div className="border-b pb-3">
          <h4 className="font-semibold text-xs mb-2">Emergency Password Reset</h4>
          <div className="space-y-2">
            <Button 
              size="sm" 
              onClick={async () => {
                setIsResetting(true)
                try {
                  const email = 'giffdev@gmail.com'
                  const password = 'testpassword'
                  const user = await spark.kv.get<User>(`user:${email}`)
                  
                  if (!user) {
                    toast.error('User not found')
                    return
                  }

                  const salt = generateSalt()
                  const hashedPassword = await hashPassword(password, salt)
                  
                  await spark.kv.set(`user:${email}:password`, { hash: hashedPassword, salt })
                  
                  toast.success(`Password reset to "testpassword" for ${email}`)
                  await loadDebugInfo()
                } catch (error) {
                  toast.error('Failed to reset password: ' + String(error))
                } finally {
                  setIsResetting(false)
                }
              }}
              disabled={isResetting}
              className="w-full bg-primary"
            >
              {isResetting ? 'Resetting...' : 'Reset giffdev@gmail.com password to "testpassword"'}
            </Button>
            <div className="text-xs text-muted-foreground text-center">or use custom reset below</div>
            <div>
              <Label htmlFor="reset-email" className="text-xs">Email</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="user@example.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="text-xs h-8"
              />
            </div>
            <div>
              <Label htmlFor="reset-password" className="text-xs">New Password (min 8 chars)</Label>
              <Input
                id="reset-password"
                type="password"
                placeholder="New password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                className="text-xs h-8"
              />
            </div>
            <Button 
              size="sm" 
              onClick={handleResetPassword}
              disabled={isResetting}
              className="w-full"
              variant="outline"
            >
              {isResetting ? 'Resetting...' : 'Reset Password'}
            </Button>
          </div>
        </div>
        
        <div className="space-y-2 text-xs">
          <div>
            <strong>Current User:</strong>
            <div className="ml-2 text-muted-foreground">
              Email: {currentUser.email}<br/>
              ID: {currentUser.id}
            </div>
          </div>
          
          <div>
            <strong>Expected Key:</strong>
            <div className="ml-2 text-muted-foreground font-mono">
              playthroughs:{currentUser.id}
            </div>
          </div>
          
          <div>
            <strong>All Users in System ({allUsers.length}):</strong>
            <div className="ml-2 text-muted-foreground">
              {allUsers.map(userInfo => (
                <div key={userInfo.user.email} className="text-xs mb-2 border-l-2 border-primary/30 pl-2">
                  <div className="font-semibold">{userInfo.user.email}</div>
                  <div className="font-mono text-[10px] text-muted-foreground/70">
                    ID: {userInfo.user.id}
                  </div>
                  <div className="text-[10px]">
                    Password: {userInfo.hasPassword ? '✓ Set' : '✗ Missing'}
                  </div>
                  <div className="text-[10px]">
                    Playthroughs: {userInfo.playthroughCount}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <strong>All Playthrough Keys ({userPlaythroughKeys.length}):</strong>
            <div className="ml-2 text-muted-foreground">
              {userPlaythroughKeys.length === 0 ? (
                <div>No playthrough keys found</div>
              ) : (
                <>
                  {userPlaythroughKeys.map(key => (
                    <div key={key} className="font-mono text-xs mb-1">
                      {key} ({playthroughCounts[key]} games)
                    </div>
                  ))}
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => setShowAllPlaythroughs(!showAllPlaythroughs)}
                    className="mt-2 text-xs h-6"
                  >
                    {showAllPlaythroughs ? 'Hide' : 'Show'} Playthrough Details
                  </Button>
                  {showAllPlaythroughs && (
                    <div className="mt-2 space-y-2 border-l-2 border-primary/30 pl-2">
                      {playthroughDetails.map(detail => (
                        <div key={detail.key} className="text-[10px]">
                          <div className="font-semibold text-primary">{detail.key}</div>
                          {detail.playthroughs.map(pt => (
                            <div key={pt.id} className="ml-2 text-muted-foreground">
                              • {pt.campaignName} - {pt.date} (ID: {pt.id.substring(0, 8)}...)
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          
          <div>
            <strong>Total KV Keys:</strong> {allKeys.length}
          </div>
          
          <div className="flex gap-2 flex-col">
            <Button size="sm" onClick={loadDebugInfo} variant="outline">
              Refresh
            </Button>
            <Button 
              size="sm" 
              onClick={handleFixGiffdevPlaythroughs} 
              className="bg-accent text-accent-foreground"
            >
              Fix giffdev@gmail.com Playthroughs
            </Button>
            <Button 
              size="sm" 
              onClick={handleMigrate} 
              disabled={isMigrating}
            >
              {isMigrating ? 'Migrating...' : 'Force Re-Migration'}
            </Button>
            <Button 
              size="sm" 
              onClick={handleResetMigration} 
              variant="secondary"
            >
              Reset Migration Flag
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
