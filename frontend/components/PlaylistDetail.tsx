"use client"

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import AuthModal from '@/components/AuthModal'
import {
  getPlaylist,
  updatePlaylist,
  addPlaylistItem,
  removePlaylistItem,
  reorderPlaylistItems,
  type PlaylistWithItems,
} from '@/lib/playlists'
import { buildQueueFromAlbumCID } from '@/lib/album'
import { usePlayerStore, type QueueItem } from '@/lib/state/player'
import { buildGatewayPath } from '@/lib/ipfs'

function truncateCid(cid: string, len = 10) {
  if (cid.length <= len * 2) return cid
  return `${cid.slice(0, len)}…${cid.slice(-len)}`
}

export default function PlaylistDetail({ playlistId }: { playlistId: string }) {
  const [data, setData] = useState<PlaylistWithItems | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  
  const { loadQueue } = usePlayerStore()

  const [name, setName] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [savingMeta, setSavingMeta] = useState(false)

  const [newCid, setNewCid] = useState('')
  const [adding, setAdding] = useState(false)
  const [albumCid, setAlbumCid] = useState('')
  const [addingAlbum, setAddingAlbum] = useState(false)
  const [albumProgress, setAlbumProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 })

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const pl = await getPlaylist(playlistId)
      setData(pl)
      setName(pl.name)
      setIsPublic(pl.isPublic)
    } catch (e) {
      const msg = (e as any)?.message || 'playlist_get_failed'
      if (msg === 'not_authenticated') setAuthOpen(true)
      else setError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlistId])

  const onSaveMeta = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!data) return
    setSavingMeta(true)
    setError(null)
    try {
      await updatePlaylist(data.id, {
        name: name.trim() || data.name,
        isPublic,
      })
      await load()
    } catch (e) {
      const msg = (e as any)?.message || 'playlist_update_failed'
      if (msg === 'not_authenticated') setAuthOpen(true)
      else setError(msg)
    } finally {
      setSavingMeta(false)
    }
  }

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!data) return
    const cid = newCid.trim()
    if (!cid) return
    setAdding(true)
    setError(null)
    try {
      await addPlaylistItem(data.id, cid)
      setNewCid('')
      await load()
    } catch (e) {
      const msg = (e as any)?.message || 'playlist_item_add_failed'
      if (msg === 'not_authenticated') setAuthOpen(true)
      else setError(msg)
    } finally {
      setAdding(false)
    }
  }

  const onRemove = async (itemId: string) => {
    if (!data) return
    try {
      await removePlaylistItem(data.id, itemId)
      await load()
    } catch (e) {
      const msg = (e as any)?.message || 'playlist_item_delete_failed'
      if (msg === 'not_authenticated') setAuthOpen(true)
      else setError(msg)
    }
  }

  const items = data?.items ?? []

  // Convierte items de playlist a QueueItem[] para el reproductor
  const playlistToQueue = (playlistItems: typeof items): QueueItem[] => {
    return playlistItems.map((item) => {
      const trackId = item.trackId
      // Si es formato "albumCid/path", separar
      if (trackId.includes('/')) {
        const [albumCid, ...pathParts] = trackId.split('/')
        const path = pathParts.join('/')
        return {
          id: trackId,
          albumCid,
          path,
          httpUrl: buildGatewayPath(albumCid, path),
        }
      }
      // Si es CID directo de archivo
      return {
        id: trackId,
        fileCid: trackId,
        httpUrl: buildGatewayPath(trackId),
      }
    })
  }

  const onPlayAll = () => {
    if (items.length === 0) return
    const queue = playlistToQueue(items)
    loadQueue(queue, 0)
  }

  const onPlayFrom = (index: number) => {
    if (items.length === 0 || index < 0 || index >= items.length) return
    const queue = playlistToQueue(items)
    loadQueue(queue, index)
  }

  const onAddAlbum = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!data) return
    const cid = albumCid.trim()
    if (!cid) return
    setAddingAlbum(true)
    setAlbumProgress({ done: 0, total: 0 })
    setError(null)
    try {
      const queue = await buildQueueFromAlbumCID(cid)
      if (!queue || queue.length === 0) {
        setError('album_empty_or_unreachable')
        return
      }
      setAlbumProgress({ done: 0, total: queue.length })
      const start = items.length
      // Añadir en orden, fijando position para mantener el orden del álbum
      for (let i = 0; i < queue.length; i++) {
        const q = queue[i]
        const trackId = q.id // Usamos formato "albumCid/path" para trackId
        await addPlaylistItem(data.id, trackId, start + i)
        setAlbumProgress({ done: i + 1, total: queue.length })
      }
      setAlbumCid('')
      await load()
    } catch (e) {
      const msg = (e as any)?.message || 'playlist_album_add_failed'
      if (msg === 'not_authenticated') setAuthOpen(true)
      else setError(msg)
    } finally {
      setAddingAlbum(false)
    }
  }

  const moveItem = async (index: number, dir: -1 | 1) => {
    if (!data) return
    const newIndex = index + dir
    if (newIndex < 0 || newIndex >= items.length) return
    // Construye nuevo orden localmente
    const arr = [...items]
    const [it] = arr.splice(index, 1)
    arr.splice(newIndex, 0, it)
    // Mapea a posiciones 0..n-1
    const payload = arr.map((i, idx) => ({ id: i.id, position: idx }))
    try {
      await reorderPlaylistItems(data.id, payload)
      await load()
    } catch (e) {
      const msg = (e as any)?.message || 'playlist_reorder_failed'
      if (msg === 'not_authenticated') setAuthOpen(true)
      else setError(msg)
    }
  }

  const canMoveUp = (idx: number) => idx > 0
  const canMoveDown = (idx: number) => idx < items.length - 1

  return (
    <div className="space-y-6">
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} title="Inicia sesión" description="Necesitas iniciar sesión para gestionar esta playlist." ctaLabel="Continuar con Google" />

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="text-sm text-slate-400">
            <Link className="hover:underline" href="/library">← Volver a biblioteca</Link>
          </div>
          <h1 className="text-lg font-semibold">Detalle de playlist</h1>
        </div>
      </div>

      {/* Metadatos */}
      <form onSubmit={onSaveMeta} className="flex flex-wrap items-end gap-3 rounded-md border border-slate-800 bg-slate-900/40 p-3">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs text-slate-400">Nombre</label>
          <input
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-sky-500"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre de la playlist"
          />
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
          Pública
        </label>
        <button
          type="submit"
          disabled={savingMeta}
          className="rounded-md border border-sky-600 bg-sky-900/30 px-3 py-1.5 text-sm text-sky-200 hover:bg-sky-900/50 disabled:opacity-50"
        >
          {savingMeta ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>

      {/* Añadir item por CID (IPFS) */}
      <form onSubmit={onAdd} className="flex flex-wrap items-end gap-3 rounded-md border border-slate-800 bg-slate-900/40 p-3">
        <div className="flex-1 min-w-[260px]">
          <label className="block text-xs text-slate-400">CID de canción (IPFS)</label>
          <input
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-sky-500"
            value={newCid}
            onChange={(e) => setNewCid(e.target.value)}
            placeholder="Ej. bafybei..."
          />
        </div>
        <button
          type="submit"
          disabled={adding || !newCid.trim()}
          className="rounded-md border border-emerald-700 bg-emerald-900/30 px-3 py-1.5 text-sm text-emerald-200 hover:bg-emerald-900/50 disabled:opacity-50"
        >
          {adding ? 'Añadiendo...' : 'Añadir a la playlist'}
        </button>
      </form>

      {/* Añadir álbum completo por CID de directorio (IPFS) */}
      <form onSubmit={onAddAlbum} className="flex flex-wrap items-end gap-3 rounded-md border border-slate-800 bg-slate-900/40 p-3">
        <div className="flex-1 min-w-[260px]">
          <label className="block text-xs text-slate-400">CID de álbum (directorio IPFS)</label>
          <input
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-sky-500"
            value={albumCid}
            onChange={(e) => setAlbumCid(e.target.value)}
            placeholder="Ej. bafybeigd... (directorio)"
          />
        </div>
        <button
          type="submit"
          disabled={addingAlbum || !albumCid.trim()}
          className="rounded-md border border-indigo-700 bg-indigo-900/30 px-3 py-1.5 text-sm text-indigo-200 hover:bg-indigo-900/50 disabled:opacity-50"
        >
          {addingAlbum ? `Añadiendo álbum... (${albumProgress.done}/${albumProgress.total})` : 'Añadir álbum completo'}
        </button>
      </form>

      {error && (
        <div className="rounded-md border border-red-800 bg-red-900/20 p-3 text-sm text-red-200">{error}</div>
      )}

      {/* Items */}
      <div className="rounded-md border border-slate-800 bg-slate-900/60">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
          <div className="text-sm font-medium text-slate-200">
            Canciones en esta playlist ({items.length})
          </div>
          {items.length > 0 && (
            <button
              onClick={onPlayAll}
              className="flex items-center gap-2 rounded-md border border-green-700 bg-green-900/30 px-3 py-1.5 text-xs text-green-200 hover:bg-green-900/50"
            >
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
              Reproducir todo
            </button>
          )}
        </div>
        {loading ? (
          <div className="p-4 text-sm text-slate-400">Cargando...</div>
        ) : items.length === 0 ? (
          <div className="p-4 text-sm text-slate-400">Aún no hay canciones. Añade por CID (IPFS) arriba.</div>
        ) : (
          <ul className="divide-y divide-slate-800">
            {items.map((it, idx) => (
              <li key={it.id} className="flex items-center gap-3 px-4 py-2">
                <div className="w-10 shrink-0 text-center text-xs text-slate-500">{idx + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-200">{truncateCid(it.trackId)}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onPlayFrom(idx)}
                    className="flex items-center gap-1 rounded-md border border-green-700 bg-green-900/30 px-2 py-1 text-xs text-green-200 hover:bg-green-900/50"
                    title="Reproducir desde aquí"
                  >
                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </button>
                  <button
                    disabled={idx === 0}
                    onClick={() => moveItem(idx, -1)}
                    className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    disabled={idx === items.length - 1}
                    onClick={() => moveItem(idx, 1)}
                    className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => onRemove(it.id)}
                    className="rounded-md border border-red-700 px-2 py-1 text-xs text-red-200 hover:bg-red-900/30"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
