import express from 'express'
import { PrismaClient } from '@prisma/client'

const router = express.Router()
const prisma = new PrismaClient()

// Obtener artistas con paginación básica
router.get('/artists', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)
    const search = req.query.search as string
    const offset = (page - 1) * limit

    const where: any = {}
    
    if (search) {
      where.artistName = { contains: search, mode: 'insensitive' }
    }

    const [artists, total] = await Promise.all([
      prisma.artistProfile.findMany({
        where,
        include: {
          _count: { select: { Album: true } }
        },
        orderBy: [
          { isVerified: 'desc' },
          { followerCount: 'desc' },
          { artistName: 'asc' }
        ],
        skip: offset,
        take: limit
      }),
      prisma.artistProfile.count({ where })
    ])

    const formattedArtists = artists.map(artist => ({
      id: artist.id,
      name: artist.artistName,
      bio: artist.bio,
      isVerified: artist.isVerified,
      followerCount: artist.followerCount,
      albumCount: artist._count.Album
    }))

    res.json({
      ok: true,
      artists: formattedArtists,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('[catalog/artists] error:', error)
    res.status(500).json({ ok: false, error: 'artists_fetch_failed' })
  }
})

// Obtener detalles de un artista específico
router.get('/artists/:id', async (req, res) => {
  try {
    const { id } = req.params

    const artist = await prisma.artistProfile.findUnique({
      where: { id },
      include: {
        Album: {
          where: { isPublic: true },
          include: {
            _count: { select: { Track: true } }
          },
          orderBy: { uploadedAt: 'desc' }
        },
        _count: { select: { Album: true } }
      }
    })

    if (!artist) {
      return res.status(404).json({ ok: false, error: 'artist_not_found' })
    }

    const formattedArtist = {
      id: artist.id,
      name: artist.artistName,
      bio: artist.bio,
      isVerified: artist.isVerified,
      followerCount: artist.followerCount,
      albums: artist.Album.map(album => ({
        id: album.id,
        title: album.title,
        year: album.year,
        albumCid: album.albumCid,
        coverCid: album.coverCid,
        trackCount: album._count.Track,
        playCount: Number(album.playCount)
      }))
    }

    res.json({ ok: true, artist: formattedArtist })
  } catch (error) {
    console.error('[catalog/artists/:id] error:', error)
    res.status(500).json({ ok: false, error: 'artist_fetch_failed' })
  }
})

// Obtener álbumes con paginación básica
router.get('/albums', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)
    const search = req.query.search as string
    const artistId = req.query.artistId as string
    const year = req.query.year ? parseInt(req.query.year as string) : undefined
    const offset = (page - 1) * limit

    const where: any = { isPublic: true }
    
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { ArtistProfile: { artistName: { contains: search, mode: 'insensitive' } } }
      ]
    }
    
    if (artistId) {
      where.artistProfileId = artistId
    }

    if (year) {
      where.year = year
    }

    const [albums, total] = await Promise.all([
      prisma.album.findMany({
        where,
        include: {
          ArtistProfile: true,
          _count: { select: { Track: true } }
        },
        orderBy: [
          { playCount: 'desc' },
          { uploadedAt: 'desc' }
        ],
        skip: offset,
        take: limit
      }),
      prisma.album.count({ where })
    ])

    const formattedAlbums = albums.map(album => ({
      id: album.id,
      title: album.title,
      year: album.year,
      albumCid: album.albumCid,
      coverCid: album.coverCid,
      description: album.description,
      totalTracks: album.totalTracks,
      totalDurationSec: album.totalDurationSec,
      playCount: Number(album.playCount),
      artist: {
        id: album.ArtistProfile.id,
        name: album.ArtistProfile.artistName,
        isVerified: album.ArtistProfile.isVerified
      }
    }))

    res.json({
      ok: true,
      albums: formattedAlbums,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('[catalog/albums] error:', error)
    res.status(500).json({ ok: false, error: 'albums_fetch_failed' })
  }
})

// Obtener detalles de un álbum específico con sus tracks
router.get('/albums/:id', async (req, res) => {
  try {
    const { id } = req.params

    const album = await prisma.album.findUnique({
      where: { id },
      include: {
        ArtistProfile: true,
        Track: {
          orderBy: { trackNumber: 'asc' }
        }
      }
    })

    if (!album || !album.isPublic) {
      return res.status(404).json({ ok: false, error: 'album_not_found' })
    }

    const formattedAlbum = {
      id: album.id,
      title: album.title,
      year: album.year,
      albumCid: album.albumCid,
      coverCid: album.coverCid,
      description: album.description,
      totalTracks: album.totalTracks,
      totalDurationSec: album.totalDurationSec,
      playCount: Number(album.playCount),
      artist: {
        id: album.ArtistProfile.id,
        name: album.ArtistProfile.artistName,
        bio: album.ArtistProfile.bio,
        isVerified: album.ArtistProfile.isVerified
      },
      tracks: album.Track.map(track => ({
        id: track.id,
        title: track.title,
        trackNumber: track.trackNumber,
        durationSec: track.durationSec,
        trackCid: track.trackCid,
        playCount: Number(track.playCount)
      }))
    }

    res.json({ ok: true, album: formattedAlbum })
  } catch (error) {
    console.error('[catalog/albums/:id] error:', error)
    res.status(500).json({ ok: false, error: 'album_fetch_failed' })
  }
})

// Buscar contenido global
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q as string
    const type = req.query.type as string // 'all', 'artists', 'albums', 'tracks'
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50)

    if (!query || query.trim().length < 2) {
      return res.status(400).json({ ok: false, error: 'query_too_short' })
    }

    const searchTerm = query.trim()
    const results: any = {}

    if (type === 'all' || type === 'artists') {
      results.artists = await prisma.artistProfile.findMany({
        where: {
          artistName: { contains: searchTerm, mode: 'insensitive' }
        },
        include: {
          _count: { select: { Album: true } }
        },
        orderBy: [
          { isVerified: 'desc' },
          { followerCount: 'desc' }
        ],
        take: limit
      })
    }

    if (type === 'all' || type === 'albums') {
      results.albums = await prisma.album.findMany({
        where: {
          isPublic: true,
          OR: [
            { title: { contains: searchTerm, mode: 'insensitive' } },
            { ArtistProfile: { artistName: { contains: searchTerm, mode: 'insensitive' } } }
          ]
        },
        include: {
          ArtistProfile: {
            select: {
              artistName: true,
              bio: true,
              isVerified: true
            }
          },
          _count: { select: { Track: true } }
        },
        orderBy: { playCount: 'desc' },
        take: limit
      })
    }

    if (type === 'all' || type === 'tracks') {
      results.tracks = await prisma.track.findMany({
        where: {
          OR: [
            { title: { contains: searchTerm, mode: 'insensitive' } },
            { Album: { title: { contains: searchTerm, mode: 'insensitive' } } },
            { Album: { ArtistProfile: { artistName: { contains: searchTerm, mode: 'insensitive' } } } }
          ]
        },
        include: {
          Album: {
            include: { ArtistProfile: true }
          }
        },
        orderBy: { playCount: 'desc' },
        take: limit
      })
    }

    res.json({ ok: true, query: searchTerm, results })
  } catch (error) {
    console.error('[catalog/search] error:', error)
    res.status(500).json({ ok: false, error: 'search_failed' })
  }
})

// Obtener estadísticas globales
router.get('/stats', async (req, res) => {
  try {
    let stats = await prisma.globalStats.findFirst({
      where: { id: 'global-stats-singleton' }
    })

    if (!stats) {
      // Crear estadísticas iniciales si no existen
      const [totalArtists, totalAlbums, totalTracks, totalUsers] = await Promise.all([
        prisma.artistProfile.count(),
        prisma.album.count({ where: { isPublic: true } }),
        prisma.track.count(),
        prisma.user.count()
      ])

      stats = await prisma.globalStats.create({
        data: {
          id: 'global-stats-singleton',
          totalArtists,
          totalAlbums,
          totalTracks,
          totalUsers
        }
      })
    }

    res.json({ ok: true, stats })
  } catch (error) {
    console.error('[catalog/stats] error:', error)
    res.status(500).json({ ok: false, error: 'stats_fetch_failed' })
  }
})


// Obtener detalles de un artista específico
router.get('/artists/:id', async (req, res) => {
  try {
    const { id } = req.params

    const artist = await prisma.artistProfile.findUnique({
      where: { id },
      include: {
        Album: {
          where: { isPublic: true },
          include: {
            _count: { select: { Track: true } }
          },
          orderBy: { uploadedAt: 'desc' }
        }
      }
    })

    if (!artist) {
      return res.status(404).json({ ok: false, error: 'artist_not_found' })
    }

    const formattedArtist = {
      id: artist.id,
      name: artist.artistName,
      bio: artist.bio,
      isVerified: artist.isVerified,
      followerCount: artist.followerCount,
      totalPlays: Number(artist.totalPlays),
      totalAlbums: artist.totalAlbums,
      albums: artist.Album.map(album => ({
        id: album.id,
        title: album.title,
        year: album.year,
        albumCid: album.albumCid,
        coverCid: album.coverCid,
        trackCount: album._count.Track,
        playCount: Number(album.playCount),
        totalTracks: album.totalTracks
      }))
    }

    res.json({ ok: true, artist: formattedArtist })
  } catch (error) {
    console.error('[catalog/artists/:id] error:', error)
    res.status(500).json({ ok: false, error: 'artist_fetch_failed' })
  }
})

// Obtener álbumes con paginación y filtros
router.get('/albums', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)
    const search = req.query.search as string
    const genre = req.query.genre as string
    const artistId = req.query.artistId as string
    const year = req.query.year ? parseInt(req.query.year as string) : undefined
    const offset = (page - 1) * limit

    const where: any = { isPublic: true }
    
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { artist: { name: { contains: search, mode: 'insensitive' } } }
      ]
    }
    
    if (artistId) {
      where.artistId = artistId
    }

    if (year) {
      where.year = year
    }

    if (genre) {
      where.albumGenres = {
        some: {
          genre: { slug: genre }
        }
      }
    }

    const [albums, total] = await Promise.all([
      prisma.album.findMany({
        where,
        include: {
          ArtistProfile: {
            select: {
              id: true,
              artistName: true,
              isVerified: true
            }
          },
          _count: { select: { Track: true } }
        },
        orderBy: [
          { playCount: 'desc' },
          { uploadedAt: 'desc' }
        ],
        skip: offset,
        take: limit
      }),
      prisma.album.count({ where })
    ])

    const formattedAlbums = albums.map(album => ({
      id: album.id,
      title: album.title,
      year: album.year,
      albumCid: album.albumCid,
      coverCid: album.coverCid,
      description: album.description,
      totalTracks: album.totalTracks,
      totalDurationSec: album.totalDurationSec,
      playCount: Number(album.playCount),
      genre: album.genre,
      artist: {
        id: album.ArtistProfile.id,
        name: album.ArtistProfile.artistName,
        isVerified: album.ArtistProfile.isVerified
      },
      trackCount: album._count.Track
    }))

    res.json({
      ok: true,
      albums: formattedAlbums,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('[catalog/albums] error:', error)
    res.status(500).json({ ok: false, error: 'albums_fetch_failed' })
  }
})

// Obtener detalles de un álbum específico con sus tracks
router.get('/albums/:id', async (req, res) => {
  try {
    const { id } = req.params

    const album = await prisma.album.findUnique({
      where: { id },
      include: {
        ArtistProfile: {
          select: {
            id: true,
            artistName: true,
            bio: true,
            isVerified: true
          }
        },
        Track: {
          select: {
            id: true,
            title: true,
            trackNumber: true,
            durationSec: true,
            trackCid: true,
            playCount: true
          },
          orderBy: {
            trackNumber: 'asc'
          }
        }
      }
    })

    if (!album || !album.isPublic) {
      return res.status(404).json({ ok: false, error: 'album_not_found' })
    }

    // Incrementar play count (opcional, solo si se reproduce)
    // await prisma.album.update({
    //   where: { id },
    //   data: { playCount: { increment: 1 } }
    // })

    const formattedAlbum = {
      id: album.id,
      title: album.title,
      year: album.year,
      albumCid: album.albumCid,
      coverCid: album.coverCid,
      description: album.description,
      totalTracks: album.totalTracks,
      totalDurationSec: album.totalDurationSec,
      playCount: Number(album.playCount),
      genre: album.genre,
      artist: {
        id: album.ArtistProfile.id,
        name: album.ArtistProfile.artistName,
        bio: album.ArtistProfile.bio,
        isVerified: album.ArtistProfile.isVerified
      },
      tracks: album.Track.map(track => ({
        id: track.id,
        title: track.title,
        trackNumber: track.trackNumber,
        durationSec: track.durationSec,
        trackCid: track.trackCid,
        playCount: Number(track.playCount)
      }))
    }

    res.json({ ok: true, album: formattedAlbum })
  } catch (error) {
    console.error('[catalog/albums/:id] error:', error)
    res.status(500).json({ ok: false, error: 'album_fetch_failed' })
  }
})

// Buscar contenido global
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q as string
    const type = req.query.type as string // 'all', 'artists', 'albums', 'tracks'
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50)

    if (!query || query.trim().length < 2) {
      return res.status(400).json({ ok: false, error: 'query_too_short' })
    }

    const searchTerm = query.trim()
    const results: any = {}

    if (type === 'all' || type === 'artists') {
      results.artists = await prisma.artistProfile.findMany({
        where: {
          artistName: { contains: searchTerm, mode: 'insensitive' }
        },
        include: {
          _count: { select: { Album: true } }
        },
        orderBy: [
          { isVerified: 'desc' },
          { followerCount: 'desc' }
        ],
        take: limit
      })
    }

    if (type === 'all' || type === 'albums') {
      results.albums = await prisma.album.findMany({
        where: {
          isPublic: true,
          OR: [
            { title: { contains: searchTerm, mode: 'insensitive' } },
            { ArtistProfile: { artistName: { contains: searchTerm, mode: 'insensitive' } } }
          ]
        },
        include: {
          ArtistProfile: {
            select: {
              id: true,
              artistName: true,
              isVerified: true
            }
          },
          _count: { select: { Track: true } }
        },
        orderBy: { playCount: 'desc' },
        take: limit
      })
    }

    if (type === 'all' || type === 'tracks') {
      results.tracks = await prisma.track.findMany({
        where: {
          Album: { isPublic: true },
          OR: [
            { title: { contains: searchTerm, mode: 'insensitive' } },
            { Album: { title: { contains: searchTerm, mode: 'insensitive' } } },
            { Album: { ArtistProfile: { artistName: { contains: searchTerm, mode: 'insensitive' } } } }
          ]
        },
        include: {
          Album: {
            include: { 
              ArtistProfile: {
                select: {
                  id: true,
                  artistName: true,
                  isVerified: true
                }
              }
            }
          }
        },
        orderBy: { playCount: 'desc' },
        take: limit
      })
    }

    res.json({ ok: true, query: searchTerm, results })
  } catch (error) {
    console.error('[catalog/search] error:', error)
    res.status(500).json({ ok: false, error: 'search_failed' })
  }
})

// Géneros eliminados - no disponibles en esquema actual

// Trending eliminado - no disponible en esquema actual

export default router
