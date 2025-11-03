export interface User {
  id: string
  email: string
  createdAt: number
}

export interface AuthSession {
  userId: string
  email: string
}

const hashPassword = async (password: string, salt: string): Promise<string> => {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + salt)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

const generateSalt = (): string => {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')
}

export const createAccount = async (email: string, password: string): Promise<{ success: boolean; error?: string; userId?: string }> => {
  const normalizedEmail = email.toLowerCase().trim()
  
  if (!normalizedEmail || !password) {
    return { success: false, error: 'Email and password are required' }
  }
  
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { success: false, error: 'Invalid email address' }
  }
  
  if (password.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters' }
  }
  
  const existingUser = await spark.kv.get<User>(`user:${normalizedEmail}`)
  if (existingUser) {
    return { success: false, error: 'An account with this email already exists' }
  }
  
  const salt = generateSalt()
  const hashedPassword = await hashPassword(password, salt)
  const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  const user: User = {
    id: userId,
    email: normalizedEmail,
    createdAt: Date.now()
  }
  
  await spark.kv.set(`user:${normalizedEmail}`, user)
  await spark.kv.set(`user:${normalizedEmail}:password`, { hash: hashedPassword, salt })
  
  return { success: true, userId }
}

export const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string; user?: User }> => {
  const normalizedEmail = email.toLowerCase().trim()
  
  if (!normalizedEmail || !password) {
    return { success: false, error: 'Email and password are required' }
  }
  
  const user = await spark.kv.get<User>(`user:${normalizedEmail}`)
  if (!user) {
    return { success: false, error: 'Invalid email or password' }
  }
  
  const passwordData = await spark.kv.get<{ hash: string; salt: string }>(`user:${normalizedEmail}:password`)
  if (!passwordData) {
    return { success: false, error: 'Invalid email or password' }
  }
  
  const hashedPassword = await hashPassword(password, passwordData.salt)
  if (hashedPassword !== passwordData.hash) {
    return { success: false, error: 'Invalid email or password' }
  }
  
  return { success: true, user }
}

export const getCurrentSession = async (): Promise<AuthSession | null> => {
  const session = await spark.kv.get<AuthSession>('current-session')
  return session || null
}

export const setCurrentSession = async (user: User): Promise<void> => {
  const session: AuthSession = {
    userId: user.id,
    email: user.email
  }
  await spark.kv.set('current-session', session)
}

export const clearCurrentSession = async (): Promise<void> => {
  await spark.kv.delete('current-session')
}
