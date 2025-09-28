// Function to get backend URL dynamically
function getBackendUrl(): string {
  // Check if we have an explicit override
  if (process.env.NEXT_PUBLIC_BACKEND_URL) {
    return process.env.NEXT_PUBLIC_BACKEND_URL
  }
  
  // During SSR, assume development (will be corrected in browser)
  if (typeof window === 'undefined') {
    return 'http://localhost:4000'
  }
  
  // In browser, check hostname more thoroughly
  const hostname = window.location.hostname
  const isLocal = hostname === 'localhost' || 
                  hostname === '127.0.0.1' || 
                  hostname.startsWith('192.168.') ||
                  hostname.endsWith('.local')
  
  console.log('🌐 Hostname detected:', hostname, '| isLocal:', isLocal)
  
  return isLocal
    ? 'http://localhost:4000' 
    : 'https://ipfs-hifi-music-streaming.onrender.com'
}

export const backendBase = getBackendUrl()

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
  // Skip session check during SSR
  if (typeof window === 'undefined') {
    return { authenticated: false }
  }
  
  try {
    const backendUrl = getBackendUrl() // Get URL dynamically
    console.log('📞 getSession called - Backend URL:', backendUrl)
    const res = await fetch(`${backendUrl}/api/auth/session`, {
      credentials: 'include',
    })
    console.log('📡 getSession response:', res.status, res.ok)
    if (!res.ok) return { authenticated: false }
    
    const sessionData = await res.json()
    console.log('📋 Session data received:', sessionData)
    return sessionData
  } catch (error) {
    console.error('Error fetching session:', error)
    return { authenticated: false }
  }
}

export function signInGoogle() {
  if (typeof window !== 'undefined') {
    const backendUrl = getBackendUrl()
    window.location.href = `${backendUrl}/api/auth/google`
  }
}

export async function signOut() {
  const backendUrl = getBackendUrl()
  await fetch(`${backendUrl}/api/auth/signout`, {
    method: 'POST',
    credentials: 'include',
  })
}

// Intercambiar token OAuth por cookie de sesión
export async function exchangeOAuthToken(token: string): Promise<boolean> {
  try {
    const backendUrl = getBackendUrl()
    console.log('🔄 Attempting token exchange for:', token.substring(0, 10) + '...')
    console.log('🌐 Backend URL:', backendUrl)
    
    const response = await fetch(`${backendUrl}/api/auth/exchange-token`, {
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
    
    // Removed confusing OAuth token logs - this is normal behavior
    
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
