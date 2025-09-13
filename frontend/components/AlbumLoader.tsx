"use client"

import { useState } from 'react'
import { loadAlbum } from '@/lib/album'
import { usePlayerStore } from '@/lib/state/player'

export default function AlbumLoader() {
  const [albumCid, setAlbumCid] = useState('')
  const [loading, setLoading] = useState(false)
  const loadQueue = usePlayerStore((s) => s.loadQueue)

  const onLoad = async () => {
    const cid = albumCid.trim()
    if (!cid) return
    setLoading(true)
    try {
      const items = await loadAlbum(cid)
      loadQueue(items, 0)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border p-4">
      <h2 className="mb-2 text-sm font-medium">Probar álbum por CID</h2>
      <div className="flex gap-2">
        <input
          className="min-w-0 flex-1 rounded border px-3 py-2 text-sm outline-none focus:border-primary bg-background"
          placeholder="CID de álbum (UnixFS dir)"
          value={albumCid}
          onChange={(e) => setAlbumCid(e.target.value)}
        />
        <button
          onClick={onLoad}
          disabled={loading || !albumCid.trim()}
          className="shrink-0 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Cargando…' : 'Cargar álbum'}
        </button>
      </div>
    </div>
  )
}
