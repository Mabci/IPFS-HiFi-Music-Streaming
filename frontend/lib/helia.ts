// Dynamic imports to prevent SSR issues
let heliaInstance: any = null
let unixfsInstance: any = null

async function getHelia(): Promise<any> {
  // Only run in browser, not server-side
  if (typeof window === 'undefined') {
    throw new Error('Helia can only be used in browser environment')
  }
  
  if (heliaInstance) return heliaInstance
  
  // Dynamic imports to avoid SSR processing
  const { createHelia } = await import('helia')
  
  // Usamos configuración por defecto de Helia para navegador.
  // Más adelante podremos añadir WebRTC, delegated routing explícito y blockstore persistente (IDB).
  heliaInstance = await createHelia()
  return heliaInstance
}

export async function getUnixFS(): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('Helia can only be used in browser environment')
  }
  
  if (unixfsInstance) return unixfsInstance
  
  const { unixfs } = await import('@helia/unixfs')
  const helia = await getHelia()
  unixfsInstance = unixfs(helia)
  return unixfsInstance
}

// Descarga el archivo desde Helia (P2P/HTTP trustless si aplica) y devuelve un Blob
export async function fetchFileToBlob(cid: string): Promise<Blob> {
  if (typeof window === 'undefined') {
    throw new Error('Helia can only be used in browser environment')
  }
  
  const { CID } = await import('multiformats/cid')
  const fs = await getUnixFS()
  const chunks: BlobPart[] = []
  for await (const chunk of fs.cat(CID.parse(cid))) {
    chunks.push(new Uint8Array(chunk))
  }
  return new Blob(chunks)
}

// Versión de conveniencia: devuelve un Blob URL a partir del CID (compatibilidad hacia atrás)
export async function fetchFileToBlobUrl(cid: string): Promise<string> {
  const blob = await fetchFileToBlob(cid)
  return URL.createObjectURL(blob)
}

// Tipos para álbum (UnixFS directorio)
export type AlbumTrackEntry = {
  name: string
  cid: string
  size?: bigint
  trackNo?: number | null
}

// Heurística para extraer número de pista del nombre de archivo
function parseTrackNumberFromName(name: string): number | null {
  // Casos: "01 - ...", "1.", "02_", "03 "
  const m = name.match(/^\s*(\d{1,3})[\s._-]/)
  if (!m) return null
  const n = parseInt(m[1], 10)
  return Number.isFinite(n) ? n : null
}

const AUDIO_EXTS = new Set(['.m4a', '.aac', '.flac'])
function hasAudioExt(name: string): boolean {
  const lower = name.toLowerCase()
  for (const ext of AUDIO_EXTS) {
    if (lower.endsWith(ext)) return true
  }
  return false
}

// Lista archivos de audio (nivel raíz) dentro de un CID de directorio y los ordena
export async function listAlbumTracks(albumCid: string): Promise<AlbumTrackEntry[]> {
  if (typeof window === 'undefined') {
    throw new Error('Helia can only be used in browser environment')
  }
  
  const { CID } = await import('multiformats/cid')
  const fs = await getUnixFS()
  const out: AlbumTrackEntry[] = []
  for await (const entry of fs.ls(CID.parse(albumCid))) {
    if (entry.type !== 'file') continue
    const name = entry.name || entry.cid.toString()
    if (!hasAudioExt(name)) continue
    const trackNo = parseTrackNumberFromName(name)
    out.push({ name, cid: entry.cid.toString(), size: entry.size, trackNo })
  }

  // Orden por trackNo (si existe) y luego alfabético por nombre
  out.sort((a, b) => {
    const an = a.trackNo ?? Number.POSITIVE_INFINITY
    const bn = b.trackNo ?? Number.POSITIVE_INFINITY
    if (an !== bn) return an - bn
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  })

  return out
}
