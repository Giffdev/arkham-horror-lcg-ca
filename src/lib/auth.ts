export interface User {
  id: string
  email: string
  createdAt: number
  authProvider?: 'email' | 'google' | 'microsoft'
  displayName?: string
}

export interface AuthSession {
  userId: string
  email: string
  authProvider?: 'email' | 'google' | 'microsoft'
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
    createdAt: Date.now(),
    authProvider: 'email'
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
    email: user.email,
    authProvider: user.authProvider
  }
  await spark.kv.set('current-session', session)
}

export const signInWithGoogle = async (): Promise<{ success: boolean; error?: string; user?: User }> => {
  try {
    const clientId = '470761896746-ivt6pu7fjs65i0f4h4iksqiafkgev64g.apps.googleusercontent.com'
    const redirectUri = window.location.origin
    const state = generateSalt()
    
    await spark.kv.set('oauth-state', { state, provider: 'google', timestamp: Date.now() })
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=token&` +
      `scope=email profile&` +
      `state=${state}`
    
    window.location.href = authUrl
    return { success: true }
  } catch (error) {
    return { success: false, error: 'Failed to initiate Google sign-in' }
  }
}

export const signInWithMicrosoft = async (): Promise<{ success: boolean; error?: string; user?: User }> => {
  try {
    const clientId = '6d4e9e5c-7b3a-4f2d-8e1c-9a0b3c4d5e6f'
    const redirectUri = window.location.origin
    const state = generateSalt()
    
    await spark.kv.set('oauth-state', { state, provider: 'microsoft', timestamp: Date.now() })
    
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=token&` +
      `scope=openid email profile&` +
      `state=${state}`
    
    window.location.href = authUrl
    return { success: true }
  } catch (error) {
    return { success: false, error: 'Failed to initiate Microsoft sign-in' }
  }
}

export const handleOAuthCallback = async (): Promise<{ success: boolean; error?: string; user?: User }> => {
  const hash = window.location.hash.substring(1)
  const params = new URLSearchParams(hash)
  
  const error = params.get('error')
  const errorDescription = params.get('error_description')
  
  if (error) {
    console.error('OAuth error:', error, errorDescription)
    window.history.replaceState({}, document.title, window.location.pathname)
    return { 
      success: false, 
      error: errorDescription || `OAuth error: ${error}` 
    }
  }
  
  const accessToken = params.get('access_token')
  const state = params.get('state')
  
  if (!accessToken || !state) {
    window.history.replaceState({}, document.title, window.location.pathname)
    return { success: false, error: 'Invalid OAuth callback - missing token or state' }
  }
  
  const oauthState = await spark.kv.get<{ state: string; provider: 'google' | 'microsoft'; timestamp: number }>('oauth-state')
  
  if (!oauthState || oauthState.state !== state) {
    window.history.replaceState({}, document.title, window.location.pathname)
    return { success: false, error: 'Invalid OAuth state - security check failed' }
  }
  
  if (Date.now() - oauthState.timestamp > 600000) {
    window.history.replaceState({}, document.title, window.location.pathname)
    return { success: false, error: 'OAuth state expired - please try again' }
  }
  
  await spark.kv.delete('oauth-state')
  
  try {
    let userInfo: { email: string; name?: string }
    
    if (oauthState.provider === 'google') {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Google API error:', errorText)
        throw new Error(`Failed to fetch user info: ${response.status}`)
      }
      
      userInfo = await response.json()
    } else {
      const response = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Microsoft Graph API error:', errorText)
        throw new Error(`Failed to fetch user info: ${response.status}`)
      }
      
      const data = await response.json()
      userInfo = { email: data.mail || data.userPrincipalName, name: data.displayName }
    }
    
    if (!userInfo.email) {
      throw new Error('No email returned from OAuth provider')
    }
    
    const normalizedEmail = userInfo.email.toLowerCase().trim()
    let user = await spark.kv.get<User>(`user:${normalizedEmail}`)
    
    if (!user) {
      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      user = {
        id: userId,
        email: normalizedEmail,
        createdAt: Date.now(),
        authProvider: oauthState.provider,
        displayName: userInfo.name
      }
      await spark.kv.set(`user:${normalizedEmail}`, user)
    }
    
    window.history.replaceState({}, document.title, window.location.pathname)
    
    return { success: true, user }
  } catch (error) {
    console.error('OAuth callback error:', error)
    window.history.replaceState({}, document.title, window.location.pathname)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to get user info from OAuth provider' 
    }
  }
}

export const clearCurrentSession = async (): Promise<void> => {
  await spark.kv.delete('current-session')
}
