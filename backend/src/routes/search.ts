import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/search - Búsqueda unificada
router.get('/', async (req, res) => {
  try {
    const { q, type = 'all', limit = 20, offset = 0 } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Parámetro de búsqueda requerido' });
    }

    const searchTerm = q.trim();
    if (searchTerm.length < 2) {
      return res.status(400).json({ error: 'La búsqueda debe tener al menos 2 caracteres' });
    }

    const limitNum = Math.min(parseInt(limit as string) || 20, 50);
    const offsetNum = parseInt(offset as string) || 0;

    const results = {
      query: searchTerm,
      artists: [] as any[],
      albums: [] as any[],
      tracks: [] as any[],
      total: 0
    };

    // Búsqueda de artistas
    if (type === 'all' || type === 'artist') {
      const artists = await prisma.artistProfile.findMany({
        where: {
          artistName: {
            contains: searchTerm,
            mode: 'insensitive'
          }
        },
        include: {
          _count: {
            select: { Album: true }
          }
        },
        take: limitNum,
        skip: offsetNum,
        orderBy: [
          { isVerified: 'desc' },
          { totalPlays: 'desc' },
          { followerCount: 'desc' }
        ]
      });

      results.artists = artists.map((artist: any) => ({
        id: artist.id,
        name: artist.artistName,
        bio: artist.bio,
        isVerified: artist.isVerified,
        followerCount: artist.followerCount,
        totalPlays: artist.totalPlays.toString(),
        albumCount: artist._count.Album,
        type: 'artist'
      }));
    }

    // Búsqueda de álbumes
    if (type === 'all' || type === 'album') {
      const albums = await prisma.album.findMany({
        where: {
          AND: [
            { isPublic: true },
            {
              OR: [
                {
                  title: {
                    contains: searchTerm,
                    mode: 'insensitive'
                  }
                },
                {
                  ArtistProfile: {
                    artistName: {
                      contains: searchTerm,
                      mode: 'insensitive'
                    }
                  }
                }
              ]
            }
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
          _count: {
            select: { Track: true }
          }
        },
        take: limitNum,
        skip: offsetNum,
        orderBy: [
          { playCount: 'desc' },
          { uploadedAt: 'desc' }
        ]
      });

      results.albums = albums.map((album: any) => ({
        id: album.id,
        title: album.title,
        description: album.description,
        year: album.year,
        genre: album.genre,
        coverCid: album.coverCid,
        albumCid: album.albumCid,
        totalTracks: album.totalTracks,
        totalDurationSec: album.totalDurationSec,
        playCount: album.playCount.toString(),
        uploadedAt: album.uploadedAt,
        artist: {
          id: album.ArtistProfile.id,
          name: album.ArtistProfile.artistName,
          isVerified: album.ArtistProfile.isVerified
        },
        trackCount: album._count.Track,
        type: 'album'
      }));
    }

    // Búsqueda de tracks
    if (type === 'all' || type === 'track') {
      const tracks = await prisma.track.findMany({
        where: {
          AND: [
            {
              Album: {
                isPublic: true
              }
            },
            {
              OR: [
                {
                  title: {
                    contains: searchTerm,
                    mode: 'insensitive'
                  }
                },
                {
                  Album: {
                    title: {
                      contains: searchTerm,
                      mode: 'insensitive'
                    }
                  }
                },
                {
                  Album: {
                    ArtistProfile: {
                      artistName: {
                        contains: searchTerm,
                        mode: 'insensitive'
                      }
                    }
                  }
                }
              ]
            }
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
        take: limitNum,
        skip: offsetNum,
        orderBy: [
          { playCount: 'desc' },
          { createdAt: 'desc' }
        ]
      });

      results.tracks = tracks.map((track: any) => ({
        id: track.id,
        title: track.title,
        trackNumber: track.trackNumber,
        durationSec: track.durationSec,
        trackCid: track.trackCid,
        lowQualityCid: track.lowQualityCid,
        highQualityCid: track.highQualityCid,
        maxQualityCid: track.maxQualityCid,
        playCount: track.playCount.toString(),
        album: {
          id: track.Album.id,
          title: track.Album.title,
          year: track.Album.year,
          genre: track.Album.genre,
          coverCid: track.Album.coverCid
        },
        artist: {
          id: track.Album.ArtistProfile.id,
          name: track.Album.ArtistProfile.artistName,
          isVerified: track.Album.ArtistProfile.isVerified
        },
        type: 'track'
      }));
    }

    results.total = results.artists.length + results.albums.length + results.tracks.length;

    res.json({
      success: true,
      results,
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        hasMore: results.total === limitNum // Indica si puede haber más resultados
      }
    });

  } catch (error) {
    console.error('Error en búsqueda:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// GET /api/search/suggestions - Sugerencias de búsqueda
router.get('/suggestions', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      return res.json({ suggestions: [] });
    }

    const searchTerm = q.trim();

    // Obtener sugerencias de artistas populares
    const artistSuggestions = await prisma.artistProfile.findMany({
      where: {
        artistName: {
          contains: searchTerm,
          mode: 'insensitive'
        }
      },
      select: {
        artistName: true,
        totalPlays: true
      },
      take: 5,
      orderBy: { totalPlays: 'desc' }
    });

    // Obtener sugerencias de álbumes populares
    const albumSuggestions = await prisma.album.findMany({
      where: {
        AND: [
          { isPublic: true },
          {
            title: {
              contains: searchTerm,
              mode: 'insensitive'
            }
          }
        ]
      },
      select: {
        title: true,
        playCount: true,
        ArtistProfile: {
          select: { artistName: true }
        }
      },
      take: 5,
      orderBy: { playCount: 'desc' }
    });

    const suggestions = [
      ...artistSuggestions.map((artist: any) => ({
        text: artist.artistName,
        type: 'artist',
        popularity: artist.totalPlays
      })),
      ...albumSuggestions.map((album: any) => ({
        text: `${album.title} - ${album.ArtistProfile.artistName}`,
        type: 'album',
        popularity: album.playCount
      }))
    ].sort((a, b) => Number(b.popularity) - Number(a.popularity)).slice(0, 8);

    res.json({ suggestions });

  } catch (error) {
    console.error('Error obteniendo sugerencias:', error);
    res.status(500).json({ suggestions: [] });
  }
});

// GET /api/search/trending - Contenido trending
router.get('/trending', async (req, res) => {
  try {
    const { type = 'all', limit = 10 } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 10, 20);

    const trending = {
      artists: [] as any[],
      albums: [] as any[],
      tracks: [] as any[]
    };

    if (type === 'all' || type === 'artist') {
      const trendingArtists = await prisma.artistProfile.findMany({
        where: {
          totalPlays: { gt: 0 }
        },
        include: {
          _count: { select: { Album: true } }
        },
        take: limitNum,
        orderBy: { totalPlays: 'desc' }
      });

      trending.artists = trendingArtists.map((artist: any) => ({
        id: artist.id,
        name: artist.artistName,
        isVerified: artist.isVerified,
        totalPlays: artist.totalPlays.toString(),
        albumCount: artist._count.Album,
        type: 'artist'
      }));
    }

    if (type === 'all' || type === 'album') {
      const trendingAlbums = await prisma.album.findMany({
        where: {
          AND: [
            { isPublic: true },
            { playCount: { gt: 0 } }
          ]
        },
        include: {
          ArtistProfile: {
            select: {
              id: true,
              artistName: true,
              isVerified: true
            }
          }
        },
        take: limitNum,
        orderBy: { playCount: 'desc' }
      });

      trending.albums = trendingAlbums.map((album: any) => ({
        id: album.id,
        title: album.title,
        year: album.year,
        genre: album.genre,
        coverCid: album.coverCid,
        playCount: album.playCount.toString(),
        artist: {
          id: album.ArtistProfile.id,
          name: album.ArtistProfile.artistName,
          isVerified: album.ArtistProfile.isVerified
        },
        type: 'album'
      }));
    }

    if (type === 'all' || type === 'track') {
      const trendingTracks = await prisma.track.findMany({
        where: {
          AND: [
            { Album: { isPublic: true } },
            { playCount: { gt: 0 } }
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
        take: limitNum,
        orderBy: { playCount: 'desc' }
      });

      trending.tracks = trendingTracks.map((track: any) => ({
        id: track.id,
        title: track.title,
        durationSec: track.durationSec,
        playCount: track.playCount.toString(),
        album: {
          id: track.Album.id,
          title: track.Album.title,
          coverCid: track.Album.coverCid
        },
        artist: {
          id: track.Album.ArtistProfile.id,
          name: track.Album.ArtistProfile.artistName,
          isVerified: track.Album.ArtistProfile.isVerified
        },
        type: 'track'
      }));
    }

    res.json({
      success: true,
      trending
    });

  } catch (error) {
    console.error('Error obteniendo trending:', error);
    res.status(500).json({
      error: 'Error obteniendo contenido trending',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

export default router;
