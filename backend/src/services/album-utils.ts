import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Utilidades para manejo de álbumes y artistas
 * Extraído del sistema de indexación automática
 */

/**
 * Crear o actualizar un perfil de artista
 */
export async function upsertArtistProfile(artistData: {
  name: string
  country?: string | null
  genres: string[]
}): Promise<any> {
  try {
    // Usar consulta SQL directa para evitar problemas de esquema
    const existingArtist = await prisma.$queryRaw`
      SELECT id, name, country, genres, "isVerified", "followerCount", "createdAt", "updatedAt"
      FROM "Artist" 
      WHERE name = ${artistData.name} 
      LIMIT 1
    ` as any[]

    if (existingArtist.length > 0) {
      // Actualizar artista existente
      const artist = existingArtist[0]
      const updatedArtist = await prisma.$queryRaw`
        UPDATE "Artist" 
        SET 
          country = COALESCE(${artistData.country}, country),
          genres = CASE WHEN ${artistData.genres.length} > 0 THEN ${artistData.genres}::text[] ELSE genres END,
          "updatedAt" = NOW()
        WHERE id = ${artist.id}
        RETURNING id, name, country, genres, "isVerified", "followerCount", "createdAt", "updatedAt"
      ` as any[]
      
      return updatedArtist[0]
    } else {
      // Crear nuevo artista
      const newArtist = await prisma.$queryRaw`
        INSERT INTO "Artist" (name, country, genres, "isVerified", "followerCount", "createdAt", "updatedAt")
        VALUES (${artistData.name}, ${artistData.country}, ${artistData.genres}::text[], false, 0, NOW(), NOW())
        RETURNING id, name, country, genres, "isVerified", "followerCount", "createdAt", "updatedAt"
      ` as any[]
      
      return newArtist[0]
    }
  } catch (error) {
    console.error('[AlbumUtils] Error in upsertArtistProfile:', error)
    throw error
  }
}

/**
 * Calcular duración total de un álbum en segundos
 */
export function calculateTotalDuration(tracks: Array<{ durationSec: number }>): number {
  return tracks.reduce((total, track) => {
    return total + (track.durationSec || 0)
  }, 0)
}

/**
 * Parsear duración desde string a segundos
 * Soporta formatos: "3:45", "225.123456", "225"
 */
export function parseDuration(duration: string | number): number {
  if (typeof duration === 'number') return Math.floor(duration)
  if (!duration) return 0
  
  const durationStr = String(duration)
  
  // Formato "3:45"
  if (durationStr.includes(':')) {
    const parts = durationStr.split(':')
    if (parts.length === 2) {
      const [minutes, seconds] = parts.map(Number)
      return minutes * 60 + seconds
    }
    if (parts.length === 3) {
      const [hours, minutes, seconds] = parts.map(Number)
      return hours * 3600 + minutes * 60 + seconds
    }
  }
  
  // Formato decimal "225.123456"
  return Math.floor(parseFloat(durationStr))
}

/**
 * Parsear sample rate desde string
 */
export function parseSampleRate(sampleRate?: string): number | null {
  if (!sampleRate) return null
  const match = sampleRate.match(/(\d+)/)
  return match ? parseInt(match[1]) : null
}

/**
 * Parsear bit depth desde string
 */
export function parseBitDepth(bitDepth?: string): number | null {
  if (!bitDepth) return null
  const match = bitDepth.match(/(\d+)/)
  return match ? parseInt(match[1]) : null
}

/**
 * Actualizar estadísticas globales del catálogo
 */
export async function updateGlobalStats(): Promise<void> {
  try {
    const [totalArtists, totalAlbums, totalTracks] = await Promise.all([
      prisma.artist.count(),
      prisma.album.count({ where: { isPublic: true } }),
      prisma.track.count({ where: { isPublic: true } })
    ])

    await prisma.globalStats.upsert({
      where: { id: 'global-stats-singleton' },
      update: {
        totalArtists,
        totalAlbums,
        totalTracks,
        lastUpdated: new Date()
      },
      create: {
        id: 'global-stats-singleton',
        totalArtists,
        totalAlbums,
        totalTracks
      }
    })
  } catch (error) {
    console.error('[AlbumUtils] Error updating global stats:', error)
    throw error
  }
}

/**
 * Extraer metadatos básicos de archivos de audio
 * Para uso en el sistema de upload manual
 */
export function extractBasicMetadata(filename: string): {
  title: string
  trackNumber?: number
} {
  // Remover extensión
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')
  
  // Patrones comunes para extraer número de track y título
  const patterns = [
    /^(\d+)\s*[-_.]\s*(.+)$/,  // "01 - Title" o "01_Title" o "01.Title"
    /^(\d+)\s+(.+)$/,          // "01 Title"
    /^Track\s*(\d+)\s*[-_.]\s*(.+)$/i, // "Track 01 - Title"
  ]
  
  for (const pattern of patterns) {
    const match = nameWithoutExt.match(pattern)
    if (match) {
      return {
        title: match[2].trim(),
        trackNumber: parseInt(match[1])
      }
    }
  }
  
  // Si no hay patrón reconocible, usar el nombre completo como título
  return {
    title: nameWithoutExt.trim()
  }
}

/**
 * Generar slug para directorio de track en IPFS
 */
export function generateTrackSlug(title: string, trackNumber?: number): string {
  // Limpiar título para uso en nombres de archivo/directorio
  const cleanTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Solo letras, números, espacios y guiones
    .replace(/\s+/g, '-')         // Espacios a guiones
    .replace(/-+/g, '-')          // Múltiples guiones a uno solo
    .replace(/^-|-$/g, '')        // Remover guiones al inicio/final
  
  // Agregar número de track si está disponible
  if (trackNumber) {
    const paddedNumber = trackNumber.toString().padStart(2, '0')
    return `${paddedNumber}-${cleanTitle}`
  }
  
  return cleanTitle
}

/**
 * Validar formato de archivo de audio
 */
export function isValidAudioFormat(filename: string): boolean {
  const validExtensions = ['.wav', '.flac', '.mp3', '.m4a', '.aac']
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'))
  return validExtensions.includes(ext)
}

/**
 * Obtener tipo MIME de archivo de audio
 */
export function getAudioMimeType(filename: string): string {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'))
  
  const mimeTypes: Record<string, string> = {
    '.wav': 'audio/wav',
    '.flac': 'audio/flac',
    '.mp3': 'audio/mpeg',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac'
  }
  
  return mimeTypes[ext] || 'audio/mpeg'
}
