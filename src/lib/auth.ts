import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  EmailAuthProvider,
  linkWithCredential,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth'
import { auth } from './firebase'
import { ensureUserProfileDocument } from './firestore'

export interface User {
  id: string
  email: string
  createdAt: number
  authProvider?: 'email' | 'google'
  displayName?: string
}

export interface AuthSession {
  userId: string
  email: string
  authProvider?: 'email' | 'google'
}

const googleProvider = new GoogleAuthProvider()

function firebaseUserToUser(fbUser: FirebaseUser, provider: 'email' | 'google' = 'email'): User {
  return {
    id: fbUser.uid,
    email: fbUser.email || '',
    createdAt: Date.now(),
    authProvider: provider,
    displayName: fbUser.displayName || undefined,
  }
}

async function ensureUserDoc(user: User): Promise<void> {
  await ensureUserProfileDocument({
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
    authProvider: user.authProvider,
    displayName: user.displayName || null,
  })
}

export const createAccount = async (
  email: string,
  password: string
): Promise<{ success: boolean; error?: string; userId?: string }> => {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    const user = firebaseUserToUser(cred.user, 'email')
    await ensureUserDoc(user)
    return { success: true, userId: cred.user.uid }
  } catch (error: any) {
    const code = error?.code || ''
    if (code === 'auth/email-already-in-use') {
      return { success: false, error: 'An account with this email already exists. If you signed in with Google, use the "Set Password" option in your profile menu instead.' }
    }
    if (code === 'auth/weak-password') {
      return { success: false, error: 'Password must be at least 6 characters' }
    }
    if (code === 'auth/invalid-email') {
      return { success: false, error: 'Invalid email address' }
    }
    return { success: false, error: error?.message || 'Failed to create account' }
  }
}

export const signIn = async (
  email: string,
  password: string
): Promise<{ success: boolean; error?: string; user?: User }> => {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    const user = firebaseUserToUser(cred.user, 'email')
    return { success: true, user }
  } catch (error: any) {
    const code = error?.code || ''
    if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
      return { success: false, error: 'No account found with this email, or incorrect password.' }
    }
    if (code === 'auth/wrong-password') {
      return { success: false, error: 'Incorrect password. Please try again.' }
    }
    return { success: false, error: error?.message || 'Failed to sign in' }
  }
}

export const signInWithGoogle = async (): Promise<{ success: boolean; error?: string; user?: User }> => {
  try {
    const cred = await signInWithPopup(auth, googleProvider)
    const user = firebaseUserToUser(cred.user, 'google')
    await ensureUserDoc(user)
    return { success: true, user }
  } catch (error: any) {
    if (error?.code === 'auth/popup-closed-by-user') {
      return { success: false, error: 'Sign in was cancelled' }
    }
    return { success: false, error: error?.message || 'Google sign in failed' }
  }
}

export const signOutUser = async (): Promise<void> => {
  await firebaseSignOut(auth)
}

export const getCurrentSession = async (): Promise<AuthSession | null> => {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      unsubscribe()
      if (fbUser) {
        resolve({
          userId: fbUser.uid,
          email: fbUser.email || '',
          authProvider: fbUser.providerData[0]?.providerId === 'google.com' ? 'google' : 'email',
        })
      } else {
        resolve(null)
      }
    })
  })
}

// kept for backward compatibility with components that call it
export const setCurrentSession = async (_user: User): Promise<void> => {
  // Firebase Auth manages sessions automatically — no-op
}

export const clearCurrentSession = async (): Promise<void> => {
  await firebaseSignOut(auth)
}

export const linkEmailPassword = async (
  password: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const currentUser = auth.currentUser
    if (!currentUser) {
      return { success: false, error: 'No user is currently signed in' }
    }
    if (!currentUser.email) {
      return { success: false, error: 'Current user has no email address' }
    }
    const credential = EmailAuthProvider.credential(currentUser.email, password)
    await linkWithCredential(currentUser, credential)
    return { success: true }
  } catch (error: any) {
    const code = error?.code || ''
    if (code === 'auth/provider-already-linked') {
      return { success: false, error: 'A password is already linked to this account' }
    }
    if (code === 'auth/weak-password') {
      return { success: false, error: 'Password must be at least 6 characters' }
    }
    if (code === 'auth/requires-recent-login') {
      return { success: false, error: 'Please sign out and sign back in, then try again' }
    }
    return { success: false, error: error?.message || 'Failed to link password' }
  }
}

export const getLinkedProviders = (): string[] => {
  const currentUser = auth.currentUser
  if (!currentUser) return []
  return currentUser.providerData.map(p => p.providerId)
}

export const resetPassword = async (
  email: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    await sendPasswordResetEmail(auth, email)
    return { success: true }
  } catch (error: any) {
    const code = error?.code || ''
    if (code === 'auth/user-not-found') {
      // Don't reveal whether the email exists for security
      return { success: true }
    }
    if (code === 'auth/invalid-email') {
      return { success: false, error: 'Please enter a valid email address' }
    }
    return { success: false, error: error?.message || 'Failed to send reset email' }
  }
}
