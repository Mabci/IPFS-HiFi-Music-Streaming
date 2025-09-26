import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    // Buscar álbum con tracks y perfil de artista
    const album = await prisma.album.findUnique({
      where: { id },
      include: {
        tracks: {
          orderBy: { trackNumber: 'asc' }
        },
        artistProfile: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!album) {
      return NextResponse.json(
        { error: 'Álbum no encontrado' },
        { status: 404 }
      );
    }

    // Formatear respuesta
    const response = {
      id: album.id,
      title: album.title,
      albumCid: album.albumCid,
      coverCid: album.coverCid,
      releaseDate: album.releaseDate,
      genre: album.genre,
      description: album.description,
      totalTracks: album.totalTracks,
      createdAt: album.createdAt,
      artist: {
        id: album.artistProfile.id,
        name: album.artistProfile.artistName,
        userId: album.artistProfile.userId,
        user: album.artistProfile.user
      },
      tracks: album.tracks.map(track => ({
        id: track.id,
        title: track.title,
        trackNumber: track.trackNumber,
        durationSec: track.durationSec,
        lowQualityCid: track.lowQualityCid,
        highQualityCid: track.highQualityCid,
        maxQualityCid: track.maxQualityCid
      }))
    };

    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Error fetching album:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
