import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase'

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
  const userRef = doc(db, 'users', user.id)
  const existing = await getDoc(userRef)
  if (!existing.exists()) {
    await setDoc(userRef, {
      email: user.email,
      createdAt: user.createdAt,
      authProvider: user.authProvider,
      displayName: user.displayName || null,
    })
  }
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
      return { success: false, error: 'An account with this email already exists' }
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

