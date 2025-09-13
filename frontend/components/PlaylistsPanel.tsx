"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AuthModal from '@/components/AuthModal'
import { listPlaylists, createPlaylist, deletePlaylist, type Playlist } from '@/lib/playlists'

export default function PlaylistsPanel() {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authOpen, setAuthOpen] = useState(false)

  const [name, setName] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [creating, setCreating] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const pls = await listPlaylists()
      setPlaylists(pls)
    } catch (e) {
      const msg = (e as any)?.message || 'playlists_list_failed'
      if (msg === 'not_authenticated') setAuthOpen(true)
      else setError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    setError(null)
    try {
      await createPlaylist(name.trim(), isPublic)
      setName('')
      setIsPublic(false)
      await load()
    } catch (e) {
      const msg = (e as any)?.message || 'playlist_create_failed'
      if (msg === 'not_authenticated') setAuthOpen(true)
      else setError(msg)
    } finally {
      setCreating(false)
    }
  }

  const onDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta playlist?')) return
    try {
      await deletePlaylist(id)
      await load()
    } catch (e) {
      const msg = (e as any)?.message || 'playlist_delete_failed'
      if (msg === 'not_authenticated') setAuthOpen(true)
      else setError(msg)
    }
  }

  return (
    <div className="space-y-4">
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} title="Inicia sesión" description="Necesitas iniciar sesión para gestionar tus playlists." ctaLabel="Continuar con Google" />

      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Tus playlists</h2>
      </div>

      <form onSubmit={onCreate} className="flex flex-wrap items-end gap-3 rounded-md border border-slate-800 bg-slate-900/40 p-3">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-slate-400">Nombre</label>
          <input
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-sky-500"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nueva playlist"
          />
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
          Pública
        </label>
        <button
          type="submit"
          disabled={creating || !name.trim()}
          className="rounded-md border border-sky-600 bg-sky-900/30 px-3 py-1.5 text-sm text-sky-200 hover:bg-sky-900/50 disabled:opacity-50"
        >
          {creating ? 'Creando...' : 'Crear playlist'}
        </button>
      </form>

      {error && (
        <div className="rounded-md border border-red-800 bg-red-900/20 p-3 text-sm text-red-200">{error}</div>
      )}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {loading && <div className="rounded-md border border-slate-800 p-4 text-sm text-slate-400">Cargando...</div>}
        {!loading && playlists.length === 0 && (
          <div className="rounded-md border border-slate-800 p-4 text-sm text-slate-400">No tienes playlists aún.</div>
        )}
        {!loading && playlists.map((pl) => (
          <div key={pl.id} className="flex flex-col justify-between gap-3 rounded-md border border-slate-800 bg-slate-900/60 p-4">
            <div>
              <div className="text-sm font-medium text-slate-100">{pl.name}</div>
              <div className="text-xs text-slate-400">{pl.isPublic ? 'Pública' : 'Privada'}</div>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/library/playlist/${encodeURIComponent(pl.id)}`}
                className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
              >
                Abrir
              </Link>
              <button
                className="rounded-md border border-red-700 px-3 py-1.5 text-xs text-red-200 hover:bg-red-900/30"
                onClick={() => onDelete(pl.id)}
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
