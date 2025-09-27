export const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || (process.env.NODE_ENV === 'production' ? 'https://ipfs-hifi-music-streaming.onrender.com' : 'http://localhost:4000')

export type SessionResponse = {
  authenticated: boolean
  user?: {
    id: string
    email: string | null
    name?: string | null
    image?: string | null
  }
}

export async function getSession(): Promise<SessionResponse> {
  const res = await fetch(`${backendBase}/api/auth/session`, {
    credentials: 'include',
  })
  if (!res.ok) return { authenticated: false }
  return res.json()
}

export function signInGoogle() {
  if (typeof window !== 'undefined') {
    window.location.href = `${backendBase}/api/auth/google`
  }
}

export async function signOut() {
  await fetch(`${backendBase}/api/auth/signout`, {
    method: 'POST',
    credentials: 'include',
  })
}

// Intercambiar token OAuth por cookie de sesión
export async function exchangeOAuthToken(token: string): Promise<boolean> {
  try {
    console.log('🔄 Attempting token exchange for:', token.substring(0, 10) + '...')
    console.log('🌐 Backend URL:', backendBase)
    
    const response = await fetch(`${backendBase}/api/auth/exchange-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token })
    })
    
    console.log('📡 Token exchange response:', response.status, response.ok)
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Token exchange failed:', errorText)
    }
    
    return response.ok
  } catch (error) {
    console.error('Error exchanging OAuth token:', error)
    return false
  }
}

// Detectar y procesar token OAuth en URL
export function handleOAuthCallback(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false)
      return
    }
    
    const urlParams = new URLSearchParams(window.location.search)
    const oauthToken = urlParams.get('oauth_token')
    
    console.log('🔍 Checking for OAuth token in URL...')
    console.log('🔗 Current URL:', window.location.href)
    console.log('🎫 OAuth token found:', oauthToken ? 'YES' : 'NO')
    
    if (!oauthToken) {
      resolve(false)
      return
    }
    
    // Limpiar URL inmediatamente
    const cleanUrl = window.location.pathname
    window.history.replaceState({}, document.title, cleanUrl)
    console.log('🧹 URL cleaned to:', cleanUrl)
    
    // Intercambiar token por cookie
    exchangeOAuthToken(oauthToken).then(success => {
      console.log('✅ Token exchange result:', success)
      resolve(success)
    })
  })
}
