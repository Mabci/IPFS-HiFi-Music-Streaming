export const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'

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
