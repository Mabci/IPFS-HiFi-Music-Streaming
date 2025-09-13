import { listAlbumTracks } from './helia'
import { buildGatewayPath, buildGatewayUrl } from './ipfs'
import type { QueueItem } from './state/player'
import { extractFromHttp, type TrackMetadata } from './metadata'
import { coverFromMB, findCover } from './cover'
import { getCached, setCached } from './cache'

const META_TTL_MS = 1000 * 60 * 60 * 24 * 3 // 3 días
const COVER_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 días
const LOCAL_COVERS_ONLY =
  (process.env.NEXT_PUBLIC_COVERS_LOCAL_ONLY || '').toLowerCase() === 'true' ||
  process.env.NEXT_PUBLIC_COVERS_LOCAL_ONLY === '1'

// Extensiones soportadas para streaming progresivo
const AUDIO_EXTS = new Set(['.m4a', '.aac', '.flac'])
function hasAudioExt(name: string): boolean {
  const lower = name.toLowerCase()
  for (const ext of AUDIO_EXTS) {
    if (lower.endsWith(ext)) return true
  }
  return false
}

// Detecta si un directorio contiene calidades progresivas
function isProgressiveTrack(name: string): boolean {
  return name.endsWith('_progressive')
}

// Extrae el nombre base del track desde el directorio progresivo
function getTrackNameFromProgressive(name: string): string {
  return name.replace('_progressive', '')
}

// Busca una imagen de portada en el propio directorio del álbum en el gateway HTTP
export async function findLocalCoverHttp(albumCid: string): Promise<string | undefined> {
  const candidates = [
    'cover.jpg', 'cover.jpeg', 'cover.png',
    'folder.jpg', 'folder.jpeg', 'folder.png',
    'front.jpg', 'front.jpeg', 'front.png',
    'album.jpg', 'album.jpeg', 'album.png',
  ]
  for (const name of candidates) {
    const url = buildGatewayPath(albumCid, name)
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 2500)
    try {
      const res = await fetch(url, { method: 'HEAD', signal: ctrl.signal })
      clearTimeout(t)
      if (res.ok) return url
    } catch {
      clearTimeout(t)
    }
  }
  return undefined
}

// Heurística para número de pista
function parseTrackNumberFromName(name: string): number | null {
  const m = name.match(/^\s*(\d{1,3})[\s._-]/)
  if (!m) return null
  const n = parseInt(m[1], 10)
  return Number.isFinite(n) ? n : null
}

// Lista archivos/directorios de un álbum usando el índice HTML del gateway
async function listAlbumTracksHttp(albumCid: string): Promise<string[]> {
  const url = buildGatewayPath(albumCid) + '/'
  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), 5000)
  try {
    const res = await fetch(url, { headers: { Accept: 'text/html' }, signal: ctrl.signal })
    clearTimeout(timeout)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()
    // Parseo básico de enlaces del índice
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const anchors = Array.from(doc.querySelectorAll('a[href]')) as HTMLAnchorElement[]
    const base = new URL(url)
    const names = anchors
      .map((a) => {
        try {
          const href = new URL(a.getAttribute('href') || '', base)
          const pathname = href.pathname || ''
          const seg = pathname.split('/').filter(Boolean).pop() || ''
          // Ignorar parent links
          if (!seg || seg === '..') return null
          return decodeURIComponent(seg)
        } catch {
          return null
        }
      })
      .filter((n): n is string => !!n)
      // Buscar directorios _progressive o archivos de audio directos
      .filter((n) => {
        const isProgressive = isProgressiveTrack(n)
        const isAudio = hasAudioExt(n)
        console.log(`Filtering item: "${n}" - isProgressive: ${isProgressive}, isAudio: ${isAudio}`)
        return isProgressive || isAudio
      })

    // Ordenar por número de pista si existe, luego por nombre natural
    names.sort((a, b) => {
      const trackNameA = isProgressiveTrack(a) ? getTrackNameFromProgressive(a) : a
      const trackNameB = isProgressiveTrack(b) ? getTrackNameFromProgressive(b) : b
      const an = parseTrackNumberFromName(trackNameA) ?? Number.POSITIVE_INFINITY
      const bn = parseTrackNumberFromName(trackNameB) ?? Number.POSITIVE_INFINITY
      if (an !== bn) return an - bn
      return trackNameA.localeCompare(trackNameB, undefined, { numeric: true, sensitivity: 'base' })
    })
    return names
  } catch (e) {
    clearTimeout(timeout)
    return []
  }
}

// Carga las calidades disponibles para un track progresivo
async function loadProgressiveQualities(albumCid: string, trackDir: string): Promise<{ [key: string]: string }> {
  const qualities: { [key: string]: string } = {}
  const trackUrl = buildGatewayPath(albumCid, trackDir) + '/'
  
  console.log(`Loading progressive qualities from: ${trackUrl}`)
  
  try {
    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), 5000) // Aumentar timeout
    const res = await fetch(trackUrl, { headers: { Accept: 'text/html' }, signal: ctrl.signal })
    clearTimeout(timeout)
    
    console.log(`Response status: ${res.status} for ${trackUrl}`)
    
    if (!res.ok) {
      console.warn(`Failed to fetch ${trackUrl}: ${res.status} ${res.statusText}`)
      return qualities
    }
    
    const html = await res.text()
    console.log(`HTML content length: ${html.length}`)
    
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const anchors = Array.from(doc.querySelectorAll('a[href]')) as HTMLAnchorElement[]
    const base = new URL(trackUrl)
    
    console.log(`Found ${anchors.length} links in directory`)
    
    for (const anchor of anchors) {
      try {
        const href = new URL(anchor.getAttribute('href') || '', base)
        const filename = href.pathname.split('/').pop() || ''
        
        console.log(`Checking file: "${filename}"`)
        
        if (filename === 'low.m4a') {
          qualities.low = filename
          console.log(`Found LOW quality: ${filename}`)
        } else if (filename === 'high.flac') {
          qualities.high = filename
          console.log(`Found HIGH quality: ${filename}`)
        } else if (filename === 'max.flac') {
          qualities.max = filename
          console.log(`Found MAX quality: ${filename}`)
        }
      } catch (e) {
        console.warn(`Error processing anchor:`, e)
      }
    }
  } catch (e) {
    console.error(`Error loading progressive qualities from ${trackUrl}:`, e)
  }
  
  console.log(`Final qualities for ${trackDir}:`, qualities)
  return qualities
}

export async function buildQueueFromAlbumCID(albumCid: string): Promise<QueueItem[]> {
  console.log(`Loading album queue for CID: ${albumCid}`)
  
  // Intentar cargar manifest primero para optimizar
  try {
    const manifestUrl = buildGatewayUrl(`${albumCid}/album.json`)
    console.log(`Trying to load manifest from: ${manifestUrl}`)
    
    const manifestResponse = await fetch(manifestUrl)
    if (manifestResponse.ok) {
      const manifest = await manifestResponse.json()
      console.log(`Loaded manifest with ${manifest.trackCount} tracks`)
      return await loadFromManifest(albumCid, manifest)
    }
  } catch (error) {
    console.log(`No manifest found, falling back to directory scan:`, error)
  }
  
  // Fallback: escaneo manual (método actual)
  return await loadFromDirectoryScan(albumCid)
}

async function loadFromManifest(albumCid: string, manifest: any): Promise<QueueItem[]> {
  console.log(`Loading album from manifest`)
  const items: QueueItem[] = []
  
  for (const track of manifest.tracks) {
    console.log(`Processing manifest track: "${track.name}"`)
    
    // Construir CIDs completos para cada calidad
    const qualitiesWithCids: { [key: string]: string } = {}
    for (const [quality, filename] of Object.entries(track.qualities)) {
      qualitiesWithCids[quality] = `${albumCid}/${track.directory}/${filename}`
    }
    
    // Usar metadata del manifest si está disponible
    const trackMeta = track.metadata || {
      title: track.name.replace(/^\d+\s*-\s*/, ''),
      artist: undefined,
      album: undefined
    }
    
    items.push({
      id: `${albumCid}/${track.name}`,
      albumCid,
      path: track.name,
      qualities: qualitiesWithCids,
      fileCid: qualitiesWithCids.max || qualitiesWithCids.high || qualitiesWithCids.low,
      meta: trackMeta,
      httpUrl: buildGatewayUrl(qualitiesWithCids.max || qualitiesWithCids.high || qualitiesWithCids.low)
    })
  }
  
  console.log(`Loaded ${items.length} tracks from manifest`)
  return items
}

async function loadFromDirectoryScan(albumCid: string): Promise<QueueItem[]> {
  console.log(`Loading album from directory scan`)
  
  // 1) Intento rápido: listar por HTTP en el gateway principal
  let names = await listAlbumTracksHttp(albumCid)
  if (names.length > 0) {
    const items: QueueItem[] = []
    
    for (const name of names) {
      console.log(`Processing item: "${name}"`)
      
      if (isProgressiveTrack(name)) {
        // Es un directorio con calidades progresivas
        const trackName = getTrackNameFromProgressive(name)
        console.log(`Loading progressive qualities for track: "${trackName}" from directory: "${name}"`)
        
        const qualities = await loadProgressiveQualities(albumCid, name)
        console.log(`Loaded qualities:`, qualities)
        
        if (Object.keys(qualities).length > 0) {
          // Construir CIDs completos para cada calidad
          const qualitiesWithCids: { [key: string]: string } = {}
          for (const [quality, filename] of Object.entries(qualities)) {
            qualitiesWithCids[quality] = `${albumCid}/${name}/${filename}`
          }
          
          // Extraer metadata del mejor archivo disponible
          let trackMeta: any = {}
          try {
            const bestQualityCid = qualitiesWithCids.max || qualitiesWithCids.high || qualitiesWithCids.low
            const metadataUrl = buildGatewayUrl(bestQualityCid)
            console.log(`Extracting metadata from: ${metadataUrl}`)
            trackMeta = await extractFromHttp(metadataUrl)
            console.log(`Extracted metadata:`, trackMeta)
          } catch (error) {
            console.warn(`Failed to extract metadata for ${trackName}:`, error)
            // Fallback: usar el nombre del archivo como título
            trackMeta = {
              title: trackName.replace(/^\d+\s*-\s*/, ''), // Remover número de track
              artist: undefined,
              album: undefined
            }
          }
          
          console.log(`Created QueueItem for progressive track:`, {
            id: `${albumCid}/${trackName}`,
            trackName,
            qualities: qualitiesWithCids,
            meta: trackMeta
          })
          
          items.push({
            id: `${albumCid}/${trackName}`,
            albumCid,
            path: trackName,
            qualities: qualitiesWithCids,
            // Usar la mejor calidad disponible como fileCid para compatibilidad
            fileCid: qualitiesWithCids.max || qualitiesWithCids.high || qualitiesWithCids.low,
            meta: trackMeta,
            httpUrl: buildGatewayUrl(qualitiesWithCids.max || qualitiesWithCids.high || qualitiesWithCids.low)
          })
        } else {
          console.warn(`No qualities found for progressive track: "${name}"`)
        }
      } else if (hasAudioExt(name)) {
        // Archivo de audio directo (formato legacy)
        console.log(`Creating direct audio item for: "${name}"`)
        items.push({
          id: `${albumCid}/${name}`,
          albumCid,
          path: name,
          fileCid: `${albumCid}/${name}`,
          httpUrl: buildGatewayPath(albumCid, name),
        })
      }
    }
    
    return items
  }

  // 2) Fallback: Helia/P2P para listar el directorio (puede ser más lento)
  const entries = await listAlbumTracks(albumCid)
  const items: QueueItem[] = entries.map((e) => ({
    id: `${albumCid}/${e.name}`,
    fileCid: e.cid,
    albumCid,
    path: e.name,
    httpUrl: buildGatewayPath(albumCid, e.name),
  }))
  return items
}

// Carga un álbum enriqueciendo la cola con metadata de pistas y eligiendo una portada de álbum
export async function loadAlbum(albumCid: string): Promise<QueueItem[]> {
  const raw = await buildQueueFromAlbumCID(albumCid)
  if (raw.length === 0) return raw

  // Extraemos metadata vía HTTP con concurrencia limitada para no saturar el gateway
  const metas: (TrackMetadata | {})[] = new Array(raw.length)
  const concurrency = 4
  let i = 0
  await Promise.all(
    Array.from({ length: concurrency }).map(async () => {
      while (i < raw.length) {
        const idx = i++
        const it = raw[idx]
        try {
          if (!it.httpUrl) {
            metas[idx] = {}
            continue
          }
          const cacheKey = `mm:v2:track:${it.httpUrl}`
          const cached = getCached<TrackMetadata>(cacheKey)
          if (cached) {
            metas[idx] = cached
            continue
          }
          const m = await extractFromHttp(it.httpUrl)
          setCached(cacheKey, m, META_TTL_MS)
          metas[idx] = m
        } catch {
          metas[idx] = {}
        }
      }
    })
  )

  const itemsWithMeta: QueueItem[] = raw.map((it, idx) => ({
    ...it,
    meta: (metas[idx] as TrackMetadata) || {},
  }))

  // Decidir portada del álbum
  const firstWithMB = itemsWithMeta.find((it) => it.meta?.mbReleaseId)?.meta?.mbReleaseId
  let albumCover: string | undefined

  // Primero intentar cache de portada por álbum
  const coverCacheKey = `mm:albumCover:${albumCid}`
  const cachedCover = getCached<string>(coverCacheKey)
  if (cachedCover) albumCover = cachedCover

  if (!albumCover) {
    if (LOCAL_COVERS_ONLY) {
      try {
        albumCover = await findLocalCoverHttp(albumCid)
      } catch {}
    } else {
      if (firstWithMB) {
        try {
          albumCover = await coverFromMB(firstWithMB)
        } catch {}
      }
      if (!albumCover) {
        const firstMeta = itemsWithMeta.find((it) => it.meta && (it.meta.album || it.meta.title))?.meta
        if (firstMeta) {
          albumCover = await findCover({ artist: firstMeta.artist, album: firstMeta.album, title: firstMeta.title })
        }
      }
      if (!albumCover) {
        try {
          albumCover = await findLocalCoverHttp(albumCid)
        } catch {}
      }
    }
  }

  if (albumCover) setCached(coverCacheKey, albumCover, COVER_TTL_MS)

  // Rellenar coverUrl faltante en cada pista con la portada del álbum
  const finalItems = itemsWithMeta.map((it) => ({
    ...it,
    meta: {
      ...it.meta,
      coverUrl: it.meta?.coverUrl || albumCover,
    },
  }))

  return finalItems
}
