"use client"

import { useEffect, useState } from 'react'
import AuthModal from '@/components/AuthModal'
import { listLikes, unlikeTrack, unlikeAlbum, type LibraryLike } from '@/lib/likes'

export default function LikesPanel() {
  const [tracks, setTracks] = useState<LibraryLike[]>([])
  const [albums, setAlbums] = useState<LibraryLike[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authOpen, setAuthOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [t, a] = await Promise.all([
        listLikes('track'),
        listLikes('album'),
      ])
      setTracks(t)
      setAlbums(a)
    } catch (e) {
      const msg = (e as any)?.message || 'likes_list_failed'
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

  const onUnlikeTrack = async (id: string) => {
    try {
      await unlikeTrack(id)
      await load()
    } catch (e) {
      const msg = (e as any)?.message || 'like_delete_failed'
      if (msg === 'not_authenticated') setAuthOpen(true)
      else setError(msg)
    }
  }

  const onUnlikeAlbum = async (id: string) => {
    try {
      await unlikeAlbum(id)
      await load()
    } catch (e) {
      const msg = (e as any)?.message || 'like_delete_failed'
      if (msg === 'not_authenticated') setAuthOpen(true)
      else setError(msg)
    }
  }

  return (
    <div className="space-y-4">
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} title="Inicia sesión" description="Necesitas iniciar sesión para ver y gestionar tus Me gusta." ctaLabel="Continuar con Google" />

      <h2 className="text-base font-semibold">Tus Me gusta</h2>

      {error && (
        <div className="rounded-md border border-red-800 bg-red-900/20 p-3 text-sm text-red-200">{error}</div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Tracks */}
        <div className="rounded-md border border-slate-800 bg-slate-900/60 p-4">
          <div className="mb-3 text-sm font-medium text-slate-200">Canciones</div>
          {loading && <div className="text-sm text-slate-400">Cargando...</div>}
          {!loading && tracks.length === 0 && (
            <div className="text-sm text-slate-400">Aún no tienes canciones en Me gusta.</div>
          )}
          <ul className="space-y-2">
            {tracks.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 rounded border border-slate-800 bg-slate-900/40 p-2">
                <div className="min-w-0">
                  <div className="truncate text-sm text-slate-100">{l.targetId}</div>
                  <div className="text-xs text-slate-500">track</div>
                </div>
                <button
                  className="rounded-md border border-red-700 px-2 py-1 text-xs text-red-200 hover:bg-red-900/30"
                  onClick={() => onUnlikeTrack(l.targetId)}
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Albums */}
        <div className="rounded-md border border-slate-800 bg-slate-900/60 p-4">
          <div className="mb-3 text-sm font-medium text-slate-200">Álbumes</div>
          {loading && <div className="text-sm text-slate-400">Cargando...</div>}
          {!loading && albums.length === 0 && (
            <div className="text-sm text-slate-400">Aún no tienes álbumes en Me gusta.</div>
          )}
          <ul className="space-y-2">
            {albums.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 rounded border border-slate-800 bg-slate-900/40 p-2">
                <div className="min-w-0">
                  <div className="truncate text-sm text-slate-100">{l.targetId}</div>
                  <div className="text-xs text-slate-500">album</div>
                </div>
                <button
                  className="rounded-md border border-red-700 px-2 py-1 text-xs text-red-200 hover:bg-red-900/30"
                  onClick={() => onUnlikeAlbum(l.targetId)}
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
