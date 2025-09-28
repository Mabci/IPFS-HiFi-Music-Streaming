'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Play, Clock, Music, Heart, Share2, Download } from 'lucide-react';
import { usePlayerStore } from '@/lib/state/player';
import { buildGatewayUrl } from '@/lib/ipfs';

interface Track {
  id: string;
  title: string;
  trackNumber: number;
  durationSec: number;
  lowQualityCid: string;
  highQualityCid: string;
  maxQualityCid: string;
}

interface Album {
  id: string;
  title: string;
  albumCid: string;
  coverCid?: string;
  releaseDate?: string;
  genre?: string;
  description?: string;
  totalTracks: number;
  artist: {
    id: string;
    name: string;
  };
  tracks: Track[];
}

export default function AlbumPage() {
  const params = useParams();
  const albumId = params.id as string;
  const [album, setAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { loadQueue, playAt } = usePlayerStore();

  useEffect(() => {
    const fetchAlbum = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/catalog/albums/${albumId}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Álbum no encontrado');
          } else {
            setError('Error cargando el álbum');
          }
          return;
        }
        
        const responseData = await response.json();
        console.log('🎵 Raw response received:', responseData);
        
        // Manejar tanto formato backend directo como frontend API
        let albumData;
        if (responseData.ok && responseData.album) {
          // Respuesta directa del backend: {ok: true, album: {...}}
          albumData = responseData.album;
          console.log('📦 Using backend format, extracted album:', albumData);
        } else {
          // Respuesta del frontend API: {...}
          albumData = responseData;
          console.log('📦 Using frontend API format:', albumData);
        }
        
        console.log('🎵 Final artist:', albumData.artist);
        console.log('🎵 Final tracks:', albumData.tracks);
        setAlbum(albumData);
        
      } catch (err) {
        console.error('Error fetching album:', err);
        setError('Error de conexión');
      } finally {
        setLoading(false);
      }
    };

    if (albumId) {
      fetchAlbum();
    }
  }, [albumId]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const playAlbum = () => {
    if (!album || !album.artist || !album.tracks || !Array.isArray(album.tracks)) return;
    
    const queue = album.tracks.map(track => ({
      id: track.id,
      title: track.title,
      artist: album.artist?.name || 'Unknown Artist',
      album: album.title,
      duration: track.durationSec,
      fileCid: track.maxQualityCid || track.highQualityCid || track.lowQualityCid,
      coverCid: album.coverCid, // Cover del álbum independiente de la calidad
      qualities: {
        low: track.lowQualityCid,
        high: track.highQualityCid,
        max: track.maxQualityCid
      },
      httpUrl: buildGatewayUrl(track.maxQualityCid || track.highQualityCid || track.lowQualityCid),
      meta: {
        title: track.title,
        artist: album.artist?.name || 'Unknown Artist',
        album: album.title
      }
    }));
    
    loadQueue(queue, 0); // Cargar queue y reproducir primera canción
  };

  const playTrack = (trackIndex: number) => {
    if (!album || !album.artist || !album.tracks || !Array.isArray(album.tracks)) return;
    
    const queue = album.tracks.map(track => ({
      id: track.id,
      title: track.title,
      artist: album.artist?.name || 'Unknown Artist',
      album: album.title,
      duration: track.durationSec,
      fileCid: track.maxQualityCid || track.highQualityCid || track.lowQualityCid,
      coverCid: album.coverCid, // Cover del álbum independiente de la calidad
      qualities: {
        low: track.lowQualityCid,
        high: track.highQualityCid,
        max: track.maxQualityCid
      },
      httpUrl: buildGatewayUrl(track.maxQualityCid || track.highQualityCid || track.lowQualityCid),
      meta: {
        title: track.title,
        artist: album.artist?.name || 'Unknown Artist',
        album: album.title
      }
    }));
    
    loadQueue(queue, trackIndex);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Cargando álbum...</div>
      </div>
    );
  }

  if (error || !album) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">{error || 'Álbum no encontrado'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header del Álbum */}
        <div className="flex flex-col md:flex-row gap-8 mb-8">
          {/* Cover */}
          <div className="flex-shrink-0">
            <div className="w-64 h-64 bg-white/10 rounded-lg flex items-center justify-center">
              {album.coverCid ? (
                <img 
                  src={buildGatewayUrl(album.coverCid)} 
                  alt={album.title}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <Music size={80} className="text-white/50" />
              )}
            </div>
          </div>

          {/* Info del Álbum */}
          <div className="flex-1 text-white">
            <p className="text-sm uppercase tracking-wide opacity-80 mb-2">Álbum</p>
            <h1 className="text-4xl md:text-6xl font-bold mb-4">{album.title}</h1>
            <div className="flex items-center gap-2 text-lg mb-4">
              <span className="font-semibold">{album.artist?.name || 'Unknown Artist'}</span>
              <span>•</span>
              <span>{album.totalTracks} canciones</span>
              {album.releaseDate && (
                <>
                  <span>•</span>
                  <span>{new Date(album.releaseDate).getFullYear()}</span>
                </>
              )}
            </div>
            
            {album.description && (
              <p className="text-white/80 mb-6 max-w-2xl">{album.description}</p>
            )}

            {/* Botones de Acción */}
            <div className="flex items-center gap-4">
              <button
                onClick={playAlbum}
                className="bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-full flex items-center gap-2 font-semibold transition-colors"
              >
                <Play size={20} fill="currentColor" />
                Reproducir
              </button>
              
              <button className="border border-white/30 hover:border-white/60 text-white px-6 py-3 rounded-full flex items-center gap-2 transition-colors">
                <Heart size={20} />
                Me gusta
              </button>
              
              <button className="border border-white/30 hover:border-white/60 text-white p-3 rounded-full transition-colors">
                <Share2 size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Lista de Canciones */}
        <div className="bg-black/20 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10">
            <h2 className="text-white text-xl font-semibold">Canciones</h2>
          </div>
          
          <div className="divide-y divide-white/10">
            {album.tracks && Array.isArray(album.tracks) ? album.tracks.map((track, index) => (
              <div
                key={track.id}
                className="px-6 py-4 hover:bg-white/5 transition-colors cursor-pointer group"
                onClick={() => playTrack(index)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 text-center">
                    <span className="text-white/60 group-hover:hidden">
                      {track.trackNumber}
                    </span>
                    <Play
                      size={16}
                      className="text-white hidden group-hover:block mx-auto"
                      fill="currentColor"
                    />
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="text-white font-medium">{track.title}</h3>
                    <p className="text-white/60 text-sm">{album.artist?.name || 'Unknown Artist'}</p>
                  </div>
                  
                  <div className="text-white/60 text-sm">
                    {formatDuration(track.durationSec)}
                  </div>
                </div>
              </div>
            )) : (
              <div className="px-6 py-4 text-white/60 text-center">
                No hay canciones disponibles
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
