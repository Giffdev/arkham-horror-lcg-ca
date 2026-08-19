import { useState, useEffect } from 'react'
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { User as AuthUser, signOutUser } from '@/lib/auth'
import { toast } from 'sonner'

export function useAuthState() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (fbUser) {
        setCurrentUser({
          id: fbUser.uid,
          email: fbUser.email || '',
          createdAt: Date.now(),
          authProvider: fbUser.providerData[0]?.providerId === 'google.com' ? 'google' : 'email',
        })
      } else {
        setCurrentUser(null)
      }
      setIsLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const signOut = async () => {
    await signOutUser()
    setCurrentUser(null)
    toast.success('Signed out successfully')
  }

  return { currentUser, isLoading, signOut }
}
