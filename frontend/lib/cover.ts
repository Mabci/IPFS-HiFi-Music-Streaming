export type CoverQuery = {
  title?: string
  artist?: string
  album?: string
}

function ensureHttps(url?: string): string | undefined {
  if (!url) return url
  return url.replace(/^http:\/\//i, 'https://')
}

function upgradeArtworkUrl(url: string, size = 512) {
  // iTunes retorna .../100x100bb.jpg -> se puede subir a 512 o 600
  const u = url.replace(/\/[0-9]+x[0-9]+bb\./, `/${size}x${size}bb.`)
  return ensureHttps(u) || u
}

async function searchITunes(term: string, entity: 'album' | 'song') {
  const params = new URLSearchParams({
    term,
    media: 'music',
    entity,
    limit: '1',
    country: 'US',
  })
  const res = await fetch(`https://itunes.apple.com/search?${params.toString()}`)
  if (!res.ok) return undefined
  const data = await res.json()
  const item = data?.results?.[0]
  if (!item) return undefined
  const artwork = item.artworkUrl100 || item.artworkUrl60
  return artwork ? upgradeArtworkUrl(artwork, 512) : undefined
}

// ---- MusicBrainz + Cover Art Archive (proveedor primario) ----
async function searchMBRelease(artist: string, album: string): Promise<string | undefined> {
  const query = `artist:"${artist}" AND release:"${album}"`
  const url = `https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(query)}&fmt=json&limit=1`
  const res = await fetch(url)
  if (!res.ok) return undefined
  const data = await res.json()
  const id = data?.releases?.[0]?.id as string | undefined
  return id
}

async function searchMBRecording(artist: string, title: string): Promise<string | undefined> {
  const query = `artist:"${artist}" AND recording:"${title}"`
  const url = `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(query)}&fmt=json&limit=1&inc=releases`
  const res = await fetch(url)
  if (!res.ok) return undefined
  const data = await res.json()
  const rec = data?.recordings?.[0]
  const releaseId: string | undefined = rec?.releases?.[0]?.id
  return releaseId
}

async function getCoverFromCAA(releaseId: string): Promise<string | undefined> {
  // Usamos el JSON para evitar redirecciones y escoger un tamaño adecuado
  const url = `https://coverartarchive.org/release/${releaseId}`
  const res = await fetch(url)
  if (!res.ok) return undefined
  const data = await res.json()
  const front = (data?.images || []).find((img: any) => img.front)
  if (!front) return undefined
  // Preferimos thumbnail grande si existe; si no, la imagen completa
  const thumb = front?.thumbnails?.large
  const full = front?.image
  return ensureHttps(thumb) || ensureHttps(full)
}

async function getCoverFromCAAReleaseGroup(groupId: string): Promise<string | undefined> {
  const url = `https://coverartarchive.org/release-group/${groupId}`
  const res = await fetch(url)
  if (!res.ok) return undefined
  const data = await res.json()
  const front = (data?.images || []).find((img: any) => img.front)
  if (!front) return undefined
  const thumb = front?.thumbnails?.large
  const full = front?.image
  return ensureHttps(thumb) || ensureHttps(full)
}

// Intenta obtener portada directamente desde CAA usando un MBID (release o release-group)
export async function coverFromMB(mbid: string): Promise<string | undefined> {
  // Primero probamos como release, luego como release-group
  const asRelease = await getCoverFromCAA(mbid)
  if (asRelease) return asRelease
  const asGroup = await getCoverFromCAAReleaseGroup(mbid)
  return asGroup
}

export async function findCover(q: CoverQuery): Promise<string | undefined> {
  const artist = q.artist?.trim() || ''
  const album = q.album?.trim() || ''
  const title = q.title?.trim() || ''

  // 1) MusicBrainz por álbum
  if (artist && album) {
    try {
      const rel = await searchMBRelease(artist, album)
      if (rel) {
        const caa = await getCoverFromCAA(rel)
        if (caa) return caa
      }
    } catch {}
  }

  // 2) MusicBrainz por canción (recording -> release)
  if (artist && title) {
    try {
      const rel = await searchMBRecording(artist, title)
      if (rel) {
        const caa = await getCoverFromCAA(rel)
        if (caa) return caa
      }
    } catch {}
  }

  // 3) Fallback iTunes por álbum
  // Preferimos buscar por álbum si lo tenemos
  if (artist && album) {
    const term = `${artist} ${album}`
    const url = await searchITunes(term, 'album')
    if (url) return url
  }

  // 4) Fallback iTunes por canción
  if (artist && title) {
    const term = `${artist} ${title}`
    const url = await searchITunes(term, 'song')
    if (url) return url
  }

  // 5) Último intento: usar lo que haya
  const term = `${artist} ${album || title}`.trim()
  if (term) {
    const url = await searchITunes(term, album ? 'album' : 'song')
    if (url) return url
  }

  return undefined
}
