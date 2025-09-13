import { parseBlob, type IAudioMetadata } from 'music-metadata'

export type TrackMetadata = {
  title?: string
  artist?: string
  album?: string
  coverUrl?: string
  mbReleaseId?: string
  sampleRateHz?: number
  bitsPerSample?: number
  codec?: string
  lossless?: boolean
  bitrateKbps?: number
}

// Extrae metadata desde una URL HTTP (descarga parcial para performance)
export async function extractFromHttp(url: string, byteCount = 1024 * 1024): Promise<TrackMetadata> {
  // 1) Intento con Range (rápido cuando el gateway lo permite)
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 1500)
    const res = await fetch(url, { headers: { Range: `bytes=0-${byteCount - 1}` }, signal: ctrl.signal })
    clearTimeout(t)
    if (res.ok) {
      const blob = await res.blob()
      return extractFromBlob(blob)
    }
  } catch {
    // Ignorar: haremos fallback sin Range
  }

  // 2) Fallback sin Range: leer parcialmente el stream y abortar al llegar a byteCount
  try {
    const ctrl = new AbortController()
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.body) throw new Error('No body stream')
    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let received = 0
    while (received < byteCount) {
      const { value, done } = await reader.read()
      if (done) break
      if (value) {
        chunks.push(value)
        received += value.byteLength
        if (received >= byteCount) break
      }
    }
    // Cancelar el fetch para no seguir descargando
    try { ctrl.abort() } catch {}
    const blob = new Blob(chunks)
    return extractFromBlob(blob)
  } catch (err) {
    console.warn('No se pudo extraer metadata por HTTP:', err)
    return {}
  }
}

// Extrae metadata desde un Blob (útil para Helia/P2P)
export async function extractFromBlob(blob: Blob): Promise<TrackMetadata> {
  try {
    const meta: IAudioMetadata = await parseBlob(blob)
    const common = meta.common || {}
    const anyCommon = common as any
    const fmt = meta.format || ({} as any)

    let coverUrl: string | undefined
    if (common.picture && common.picture.length > 0) {
      const pic = common.picture[0]
      const type = pic.format || 'image/jpeg'
      const url = URL.createObjectURL(new Blob([pic.data], { type }))
      coverUrl = url
    }

    return {
      title: common.title,
      artist: Array.isArray(common.artist) ? common.artist.join(', ') : common.artist,
      album: common.album,
      coverUrl,
      sampleRateHz: typeof fmt.sampleRate === 'number' ? fmt.sampleRate : undefined,
      bitsPerSample: typeof fmt.bitsPerSample === 'number' ? fmt.bitsPerSample : undefined,
      codec: typeof fmt.codec === 'string' ? fmt.codec : (typeof fmt.container === 'string' ? fmt.container : undefined),
      lossless: typeof fmt.lossless === 'boolean' ? fmt.lossless : undefined,
      bitrateKbps: typeof fmt.bitrate === 'number' ? Math.round(fmt.bitrate / 1000) : undefined,
      // Intentamos varias claves posibles (camelCase y snake_case) que puede exponer music-metadata
      mbReleaseId:
        anyCommon?.musicbrainzReleaseId ||
        anyCommon?.musicbrainzAlbumId ||
        anyCommon?.musicbrainzReleaseGroupId ||
        anyCommon?.musicbrainz_releaseid ||
        anyCommon?.musicbrainz_albumid ||
        anyCommon?.musicbrainz_releasegroupid,
    }
  } catch (err) {
    console.warn('No se pudo extraer metadata:', err)
    return {}
  }
}
