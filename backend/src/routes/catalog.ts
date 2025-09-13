import express from 'express'
import { PrismaClient } from '@prisma/client'

const router = express.Router()
const prisma = new PrismaClient()

// Obtener artistas con paginación y filtros
router.get('/artists', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)
    const search = req.query.search as string
    const genre = req.query.genre as string
    const verified = req.query.verified === 'true'
    const offset = (page - 1) * limit

    const where: any = { isPublic: true }
    
    if (search) {
      where.name = { contains: search, mode: 'insensitive' }
    }
    
    if (verified) {
      where.isVerified = true
    }

    if (genre) {
      where.artistGenres = {
        some: {
          genre: { slug: genre }
        }
      }
    }

    const [artists, total] = await Promise.all([
      prisma.artist.findMany({
        where,
        include: {
          _count: { select: { albums: true } },
          artistGenres: {
            include: { genre: true }
          }
        },
        orderBy: [
          { isVerified: 'desc' },
          { followerCount: 'desc' },
          { name: 'asc' }
        ],
        skip: offset,
        take: limit
      }),
      prisma.artist.count({ where })
    ])

    const formattedArtists = artists.map(artist => ({
      id: artist.id,
      name: artist.name,
      bio: artist.bio,
      country: artist.country,
      imageUrl: artist.imageUrl,
      imageCid: artist.imageCid,
      isVerified: artist.isVerified,
      followerCount: artist.followerCount,
      albumCount: artist._count.albums,
      genres: artist.artistGenres.map(ag => ({
        id: ag.genre.id,
        name: ag.genre.name,
        slug: ag.genre.slug
      }))
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

    const artist = await prisma.artist.findUnique({
      where: { id },
      include: {
        albums: {
          where: { isPublic: true },
          include: {
            _count: { select: { tracks: true } },
            covers: { take: 1 }
          },
          orderBy: { releaseDate: 'desc' }
        },
        artistGenres: {
          include: { genre: true }
        },
        _count: { select: { albums: true } }
      }
    })

    if (!artist) {
      return res.status(404).json({ ok: false, error: 'artist_not_found' })
    }

    const formattedArtist = {
      id: artist.id,
      name: artist.name,
      bio: artist.bio,
      country: artist.country,
      imageUrl: artist.imageUrl,
      imageCid: artist.imageCid,
      isVerified: artist.isVerified,
      followerCount: artist.followerCount,
      genres: artist.artistGenres.map(ag => ({
        id: ag.genre.id,
        name: ag.genre.name,
        slug: ag.genre.slug
      })),
      albums: artist.albums.map(album => ({
        id: album.id,
        title: album.title,
        year: album.year,
        releaseDate: album.releaseDate,
        albumCid: album.albumCid,
        coverUrl: album.coverUrl,
        coverCid: album.coverCid,
        trackCount: album._count.tracks,
        playCount: album.playCount,
        likeCount: album.likeCount
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
          artist: true,
          _count: { select: { tracks: true } },
          albumGenres: {
            include: { genre: true }
          },
          covers: { take: 1 }
        },
        orderBy: [
          { playCount: 'desc' },
          { releaseDate: 'desc' }
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
      releaseDate: album.releaseDate,
      albumCid: album.albumCid,
      coverUrl: album.coverUrl,
      coverCid: album.coverCid,
      description: album.description,
      totalTracks: album.totalTracks || album._count.tracks,
      totalDurationSec: album.totalDurationSec,
      recordLabel: album.recordLabel,
      playCount: album.playCount,
      likeCount: album.likeCount,
      artist: {
        id: album.artist.id,
        name: album.artist.name,
        isVerified: album.artist.isVerified
      },
      genres: album.albumGenres.map(ag => ({
        id: ag.genre.id,
        name: ag.genre.name,
        slug: ag.genre.slug
      }))
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
        artist: {
          include: {
            artistGenres: {
              include: { genre: true }
            }
          }
        },
        tracks: {
          where: { isPublic: true },
          include: {
            audioQualities: true,
            covers: { take: 1 }
          },
          orderBy: { trackNo: 'asc' }
        },
        albumGenres: {
          include: { genre: true }
        },
        covers: true,
        releases: true
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
      releaseDate: album.releaseDate,
      albumCid: album.albumCid,
      coverUrl: album.coverUrl,
      coverCid: album.coverCid,
      description: album.description,
      totalTracks: album.totalTracks,
      totalDurationSec: album.totalDurationSec,
      recordLabel: album.recordLabel,
      catalogNumber: album.catalogNumber,
      playCount: album.playCount,
      likeCount: album.likeCount,
      artist: {
        id: album.artist.id,
        name: album.artist.name,
        bio: album.artist.bio,
        country: album.artist.country,
        imageUrl: album.artist.imageUrl,
        isVerified: album.artist.isVerified,
        genres: album.artist.artistGenres.map(ag => ({
          id: ag.genre.id,
          name: ag.genre.name,
          slug: ag.genre.slug
        }))
      },
      genres: album.albumGenres.map(ag => ({
        id: ag.genre.id,
        name: ag.genre.name,
        slug: ag.genre.slug
      })),
      tracks: album.tracks.map(track => ({
        id: track.id,
        title: track.title,
        trackNo: track.trackNo,
        durationSec: track.durationSec,
        trackCid: track.trackCid,
        isrc: track.isrc,
        playCount: track.playCount,
        likeCount: track.likeCount,
        audioQualities: track.audioQualities.map(aq => ({
          quality: aq.quality,
          codec: aq.codec,
          bitrateKbps: aq.bitrateKbps,
          sampleRateHz: aq.sampleRateHz,
          bitsPerSample: aq.bitsPerSample,
          lossless: aq.lossless,
          fileCid: aq.fileCid,
          fileSizeBytes: aq.fileSizeBytes
        }))
      })),
      covers: album.covers.map(cover => ({
        id: cover.id,
        source: cover.source,
        url: cover.url,
        cid: cover.cid,
        width: cover.width,
        height: cover.height
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
      results.artists = await prisma.artist.findMany({
        where: {
          name: { contains: searchTerm, mode: 'insensitive' }
        },
        include: {
          _count: { select: { albums: true } },
          artistGenres: {
            include: { genre: true }
          }
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
            { artist: { name: { contains: searchTerm, mode: 'insensitive' } } }
          ]
        },
        include: {
          artist: true,
          _count: { select: { tracks: true } },
          albumGenres: {
            include: { genre: true }
          }
        },
        orderBy: { playCount: 'desc' },
        take: limit
      })
    }

    if (type === 'all' || type === 'tracks') {
      results.tracks = await prisma.track.findMany({
        where: {
          isPublic: true,
          OR: [
            { title: { contains: searchTerm, mode: 'insensitive' } },
            { album: { title: { contains: searchTerm, mode: 'insensitive' } } },
            { album: { artist: { name: { contains: searchTerm, mode: 'insensitive' } } } }
          ]
        },
        include: {
          album: {
            include: { artist: true }
          },
          audioQualities: true
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

// Obtener géneros
router.get('/genres', async (req, res) => {
  try {
    const includeChildren = req.query.children === 'true'
    
    const genres = await prisma.genre.findMany({
      where: { parentId: null }, // Solo géneros padre
      include: {
        children: includeChildren,
        _count: {
          select: {
            artistGenres: true,
            albumGenres: true
          }
        }
      },
      orderBy: { name: 'asc' }
    })

    res.json({ ok: true, genres })
  } catch (error) {
    console.error('[catalog/genres] error:', error)
    res.status(500).json({ ok: false, error: 'genres_fetch_failed' })
  }
})

// Obtener contenido trending
router.get('/trending', async (req, res) => {
  try {
    const period = req.query.period as string || 'weekly' // daily, weekly, monthly
    const type = req.query.type as string || 'all' // all, artists, albums, tracks
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)

    const today = new Date()
    const dateFilter = new Date(today)
    
    // Ajustar fecha según período
    switch (period) {
      case 'daily':
        dateFilter.setDate(today.getDate() - 1)
        break
      case 'weekly':
        dateFilter.setDate(today.getDate() - 7)
        break
      case 'monthly':
        dateFilter.setMonth(today.getMonth() - 1)
        break
    }

    const where: any = {
      period,
      date: { gte: dateFilter }
    }

    if (type !== 'all') {
      where.contentType = type.slice(0, -1) // 'artists' -> 'artist'
    }

    const trending = await prisma.trendingContent.findMany({
      where,
      orderBy: { score: 'desc' },
      take: limit
    })

    // Obtener detalles del contenido
    const results = await Promise.all(
      trending.map(async (item) => {
        let content = null
        
        switch (item.contentType) {
          case 'artist':
            content = await prisma.artist.findUnique({
              where: { id: item.contentId },
              include: {
                _count: { select: { albums: true } },
                artistGenres: { include: { genre: true } }
              }
            })
            break
          case 'album':
            content = await prisma.album.findUnique({
              where: { id: item.contentId },
              include: {
                artist: true,
                _count: { select: { tracks: true } }
              }
            })
            break
          case 'track':
            content = await prisma.track.findUnique({
              where: { id: item.contentId },
              include: {
                album: { include: { artist: true } },
                audioQualities: true
              }
            })
            break
        }

        return {
          type: item.contentType,
          score: item.score,
          content
        }
      })
    )

    res.json({
      ok: true,
      period,
      trending: results.filter(r => r.content !== null)
    })
  } catch (error) {
    console.error('[catalog/trending] error:', error)
    res.status(500).json({ ok: false, error: 'trending_fetch_failed' })
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
        prisma.artist.count(),
        prisma.album.count({ where: { isPublic: true } }),
        prisma.track.count({ where: { isPublic: true } }),
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

export default router
