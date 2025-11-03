import { User } from './auth'
import { Playthrough } from './types'

const MIGRATION_VERSION = 4
const MIGRATION_KEY = 'migration:version'

const generateUserIdFromEmail = async (email: string): Promise<string> => {
  const encoder = new TextEncoder()
  const data = encoder.encode(email.toLowerCase().trim())
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return `user_${hashHex.substring(0, 16)}`
}

export const migrateUserData = async (): Promise<void> => {
  console.log('[Migration] Checking migration status...')
  
  try {
    const currentVersion = await spark.kv.get<number>(MIGRATION_KEY)
    
    if (currentVersion === MIGRATION_VERSION) {
      console.log('[Migration] Already at current version, skipping')
      
      const giffdevId = await generateUserIdFromEmail('giffdev@gmail.com')
      const giffdevPlaythroughs = await spark.kv.get<Playthrough[]>(`playthroughs:${giffdevId}`)
      console.log(`[Migration] Quick check - giffdev@gmail.com ID: ${giffdevId}`)
      console.log(`[Migration] Quick check - giffdev@gmail.com playthroughs: ${giffdevPlaythroughs?.length || 0}`)
      return
    }
    
    console.log('[Migration] Starting data migration from version', currentVersion, 'to', MIGRATION_VERSION)
    const allKeys = await spark.kv.keys()
    console.log('[Migration] Total keys in KV:', allKeys.length)
    console.log('[Migration] All keys:', allKeys)
    
    const giffdevCorrectId = await generateUserIdFromEmail('giffdev@gmail.com')
    console.log('[Migration] Target ID for giffdev@gmail.com:', giffdevCorrectId)
    
    const userKeys = allKeys.filter(key => key.startsWith('user:') && !key.includes(':password') && !key.includes('password-reset'))
    const playthroughKeys = allKeys.filter(key => key.startsWith('playthroughs'))
    
    console.log('[Migration] Found user keys:', userKeys)
    console.log('[Migration] Found playthrough keys:', playthroughKeys)
    
    const emailToCorrectId: Record<string, string> = {}
    const userIdMapping: Record<string, string> = {}
    
    for (const userKey of userKeys) {
      const user = await spark.kv.get<User>(userKey)
      if (!user) continue
      
      const correctUserId = await generateUserIdFromEmail(user.email)
      emailToCorrectId[user.email] = correctUserId
      userIdMapping[user.id] = correctUserId
      
      console.log(`[Migration] User ${user.email}: current ID=${user.id}, correct ID=${correctUserId}`)
      
      if (user.id !== correctUserId) {
        console.log(`[Migration] Updating user ${user.email} ID from ${user.id} to ${correctUserId}`)
        user.id = correctUserId
        await spark.kv.set(userKey, user)
      }
    }
    
    console.log('[Migration] Email to correct ID mapping:', emailToCorrectId)
    console.log('[Migration] User ID mapping:', userIdMapping)
    
    const allPlaythroughsByUserId: Record<string, Playthrough[]> = {}
    
    for (const ptKey of playthroughKeys) {
      const playthroughs = await spark.kv.get<Playthrough[]>(ptKey)
      console.log(`[Migration] Key ${ptKey} has ${playthroughs?.length || 0} playthroughs`)
      
      if (!playthroughs || playthroughs.length === 0) continue
      
      let targetUserId: string
      
      if (ptKey === 'playthroughs') {
        console.log('[Migration] LEGACY KEY FOUND: assigning to giffdev@gmail.com')
        targetUserId = giffdevCorrectId
      } else {
        const userIdFromKey = ptKey.replace('playthroughs:', '')
        console.log(`[Migration] Extracted user ID from key: ${userIdFromKey}`)
        
        targetUserId = userIdMapping[userIdFromKey]
        
        if (!targetUserId) {
          console.log(`[Migration] No mapping found for ${userIdFromKey}, checking if it's already correct...`)
          targetUserId = userIdFromKey
        } else {
          console.log(`[Migration] Mapped ${userIdFromKey} -> ${targetUserId}`)
        }
      }
      
      console.log(`[Migration] Processing ${ptKey}:`)
      console.log(`[Migration]   - Target user ID: ${targetUserId}`)
      console.log(`[Migration]   - Playthrough count: ${playthroughs.length}`)
      
      if (!allPlaythroughsByUserId[targetUserId]) {
        allPlaythroughsByUserId[targetUserId] = []
      }
      
      for (const pt of playthroughs) {
        const isDuplicate = allPlaythroughsByUserId[targetUserId].some(existing => existing.id === pt.id)
        if (!isDuplicate) {
          allPlaythroughsByUserId[targetUserId].push(pt)
          console.log(`[Migration]     - Added playthrough ${pt.id} (${pt.campaignName})`)
        } else {
          console.log(`[Migration]     - Skipped duplicate playthrough ${pt.id}`)
        }
      }
    }
    
    console.log('[Migration] ========================================')
    console.log('[Migration] CONSOLIDATED PLAYTHROUGHS BY USER:')
    for (const [userId, pts] of Object.entries(allPlaythroughsByUserId)) {
      const userEmail = Object.entries(emailToCorrectId).find(([, id]) => id === userId)?.[0] || 'unknown'
      console.log(`[Migration]   - ${userId} (${userEmail}): ${pts.length} playthroughs`)
    }
    console.log('[Migration] ========================================')
    
    for (const [targetUserId, playthroughs] of Object.entries(allPlaythroughsByUserId)) {
      const targetKey = `playthroughs:${targetUserId}`
      console.log(`[Migration] Writing ${playthroughs.length} playthroughs to ${targetKey}`)
      await spark.kv.set(targetKey, playthroughs)
      
      const verify = await spark.kv.get<Playthrough[]>(targetKey)
      console.log(`[Migration] ✓ Verified: ${targetKey} now has ${verify?.length || 0} playthroughs`)
    }
    
    console.log('[Migration] Cleaning up old keys...')
    for (const ptKey of playthroughKeys) {
      if (ptKey === 'playthroughs') {
        console.log('[Migration] Deleting legacy key: playthroughs')
        await spark.kv.delete(ptKey)
        continue
      }
      
      const userIdFromKey = ptKey.replace('playthroughs:', '')
      const correctUserId = userIdMapping[userIdFromKey] || userIdFromKey
      const correctKey = `playthroughs:${correctUserId}`
      
      if (ptKey !== correctKey) {
        console.log(`[Migration] Deleting old key: ${ptKey} (data moved to ${correctKey})`)
        await spark.kv.delete(ptKey)
      } else {
        console.log(`[Migration] Keeping key: ${ptKey} (already correct)`)
      }
    }
    
    await spark.kv.set(MIGRATION_KEY, MIGRATION_VERSION)
    console.log('[Migration] ✓ Migration completed successfully')
    
    console.log('[Migration] ========================================')
    console.log('[Migration] FINAL VERIFICATION FOR giffdev@gmail.com:')
    const giffdevId = await generateUserIdFromEmail('giffdev@gmail.com')
    const giffdevPlaythroughs = await spark.kv.get<Playthrough[]>(`playthroughs:${giffdevId}`)
    console.log(`[Migration]   - Email: giffdev@gmail.com`)
    console.log(`[Migration]   - User ID: ${giffdevId}`)
    console.log(`[Migration]   - Key: playthroughs:${giffdevId}`)
    console.log(`[Migration]   - Playthroughs: ${giffdevPlaythroughs?.length || 0}`)
    if (giffdevPlaythroughs && giffdevPlaythroughs.length > 0) {
      console.log(`[Migration]   - First playthrough: ${giffdevPlaythroughs[0].campaignName} (${giffdevPlaythroughs[0].date})`)
    }
    console.log('[Migration] ========================================')
  } catch (error) {
    console.error('[Migration] ERROR during migration:', error)
    throw error
  }
}
