import { getSession } from './auth'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'

export type Playlist = {
  id: string
  name: string
  isPublic: boolean
  createdAt?: string
  updatedAt?: string
}

export type PlaylistItem = {
  id: string
  playlistId: string
  trackId: string
  position: number
  createdAt?: string
}

export type PlaylistWithItems = Playlist & { items: PlaylistItem[] }

async function authedFetch(input: RequestInfo | URL, init?: RequestInit) {
  const s = await getSession()
  if (!s?.user) throw new Error('not_authenticated')
  const res = await fetch(input, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
  if (res.status === 401) throw new Error('not_authenticated')
  return res
}

export async function listPlaylists(): Promise<Playlist[]> {
  const res = await authedFetch(`${BACKEND_URL}/api/playlists`)
  if (!res.ok) throw new Error('playlists_list_failed')
  const data = await res.json()
  return data.playlists || []
}

export async function createPlaylist(name: string, isPublic = false): Promise<Playlist> {
  const res = await authedFetch(`${BACKEND_URL}/api/playlists`, {
    method: 'POST',
    body: JSON.stringify({ name, isPublic }),
  })
  if (!res.ok) throw new Error('playlist_create_failed')
  const data = await res.json()
  return data.playlist
}

export async function getPlaylist(id: string): Promise<PlaylistWithItems> {
  const res = await authedFetch(`${BACKEND_URL}/api/playlists/${encodeURIComponent(id)}`)
  if (!res.ok) throw new Error('playlist_get_failed')
  const data = await res.json()
  return data.playlist
}

export async function updatePlaylist(id: string, payload: Partial<Pick<Playlist, 'name' | 'isPublic'>>): Promise<Playlist> {
  const res = await authedFetch(`${BACKEND_URL}/api/playlists/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('playlist_update_failed')
  const data = await res.json()
  return data.playlist
}

export async function deletePlaylist(id: string): Promise<void> {
  const res = await authedFetch(`${BACKEND_URL}/api/playlists/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  if (!res.ok && res.status !== 204) throw new Error('playlist_delete_failed')
}

export async function addPlaylistItem(playlistId: string, trackId: string, position?: number): Promise<PlaylistItem> {
  const res = await authedFetch(`${BACKEND_URL}/api/playlists/${encodeURIComponent(playlistId)}/items`, {
    method: 'POST',
    body: JSON.stringify({ trackId, position }),
  })
  if (!res.ok) throw new Error('playlist_item_add_failed')
  const data = await res.json()
  return data.item
}

export async function removePlaylistItem(playlistId: string, itemId: string): Promise<void> {
  const res = await authedFetch(`${BACKEND_URL}/api/playlists/${encodeURIComponent(playlistId)}/items/${encodeURIComponent(itemId)}`, {
    method: 'DELETE',
  })
  if (!res.ok && res.status !== 204) throw new Error('playlist_item_delete_failed')
}

export async function reorderPlaylistItems(playlistId: string, items: Array<{ id: string; position: number }>): Promise<void> {
  const res = await authedFetch(`${BACKEND_URL}/api/playlists/${encodeURIComponent(playlistId)}/reorder`, {
    method: 'POST',
    body: JSON.stringify({ items }),
  })
  if (!res.ok) throw new Error('playlist_reorder_failed')
}
