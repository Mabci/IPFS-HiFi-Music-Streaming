import { getSession } from './auth'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'

type LikeType = 'track' | 'album'

export type LibraryLike = {
  id: string
  userId: string
  targetType: LikeType
  targetId: string
  createdAt: string
}

async function authedFetch(input: RequestInfo | URL, init?: RequestInit) {
  // Asegura que haya sesión; si no, lanza error para que UI pueda pedir login
  const s = await getSession()
  if (!s?.user) throw new Error('not_authenticated')
  return fetch(input, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
}

export async function listLikes(type?: LikeType): Promise<LibraryLike[]> {
  const url = new URL('/api/library/likes', BACKEND_URL)
  if (type) url.searchParams.set('type', type)
  const res = await authedFetch(url.toString())
  if (res.status === 401) throw new Error('not_authenticated')
  if (!res.ok) throw new Error('likes_list_failed')
  const data = await res.json()
  return data.likes || []
}

export async function isLiked(type: LikeType, id: string): Promise<boolean> {
  try {
    const likes = await listLikes(type)
    return likes.some((l) => l.targetId === id)
  } catch {
    return false
  }
}

export async function like(type: LikeType, id: string): Promise<void> {
  const res = await authedFetch(`${BACKEND_URL}/api/library/likes`, {
    method: 'POST',
    body: JSON.stringify({ type, id }),
  })
  if (res.status === 401) throw new Error('not_authenticated')
  if (!res.ok) throw new Error('like_create_failed')
}

export async function unlike(type: LikeType, id: string): Promise<void> {
  const res = await authedFetch(`${BACKEND_URL}/api/library/likes/${type}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  if (res.status === 401) throw new Error('not_authenticated')
  if (!res.ok && res.status !== 204) throw new Error('like_delete_failed')
}

export async function likeTrack(id: string) { return like('track', id) }
export async function unlikeTrack(id: string) { return unlike('track', id) }
export async function likeAlbum(id: string) { return like('album', id) }
export async function unlikeAlbum(id: string) { return unlike('album', id) }
