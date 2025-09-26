'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Clock, Music, User, Calendar, Tag, FileText, CheckCircle, AlertCircle } from 'lucide-react';

interface TrackData {
  id: string;
  title: string;
  trackNumber: number;
  duration: number;
  filename: string;
  path: string;
}

interface AlbumData {
  title: string;
  artistName: string;
  year: number;
  genre: string;
  description: string;
}

export default function PreviewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tracks, setTracks] = useState<TrackData[]>([]);
  const [albumData, setAlbumData] = useState<AlbumData | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const uploadSession = sessionStorage.getItem('uploadSession');
    if (!uploadSession) {
      router.push('/upload');
      return;
    }

    try {
      const sessionData = JSON.parse(uploadSession);
      const { sessionId: id, tracks: sessionTracks, albumData: sessionAlbumData, coverImage } = sessionData;
      
      console.log('🔍 Preview page - Session data:', {
        sessionId: !!id,
        tracks: sessionTracks?.length || 0,
        albumData: !!sessionAlbumData,
        coverImage: !!coverImage
      });
      
      if (!sessionAlbumData) {
        console.log('❌ No album data, redirecting to metadata');
        router.push('/upload/metadata');
        return;
      }

      setSessionId(id);
      setTracks(sessionTracks || []);
      setAlbumData(sessionAlbumData);
      
      // Recuperar preview de la portada si existe
      if (coverImage && coverImage.data) {
        setCoverPreview(coverImage.data); // Usar base64 guardado
      } else if (coverImage) {
        console.warn('Cover image found but no data:', coverImage);
      }
      
      console.log('✅ Preview loaded with', sessionTracks?.length || 0, 'tracks');
    } catch (error) {
      console.error('❌ Error parsing session data in preview:', error);
      router.push('/upload');
      return;
    }
    
    setLoading(false);
  }, [router]);

  const submitAlbum = async () => {
    if (!albumData || !tracks.length) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/upload/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          sessionId,
          albumData,
          tracks: tracks.map(track => ({
            title: track.title,
            trackNumber: track.trackNumber,
            filename: track.filename,
            path: track.path
          })),
          coverImage: true // Indicar que hay portada
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error enviando álbum');
      }

      const result = await response.json();
      setJobId(result.jobId);
      setProcessingStatus('Álbum enviado para procesamiento...');
      
      // Limpiar sessionStorage
      sessionStorage.removeItem('uploadSession');
      
      // Redirigir a página de progreso inmediatamente
      router.push(`/upload/status/${result.jobId}`);

    } catch (error) {
      console.error('Error submitting album:', error);
      setError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTotalDuration = () => {
    return tracks.reduce((sum, track) => sum + track.duration, 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Cargando preview...</p>
        </div>
      </div>
    );
  }

  if (jobId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-white mb-4">¡Álbum Enviado!</h2>
          <p className="text-blue-200 mb-6">{processingStatus}</p>
          <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4">
            <p className="text-blue-200 text-sm">
              ID del trabajo: <span className="font-mono text-white">{jobId}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Preview Final
          </h1>
          <p className="text-blue-200">
            Paso 4 de 4: Revisa tu álbum antes de enviarlo para procesamiento
          </p>
        </div>

        {/* Progress Bar */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="flex items-center justify-between text-sm text-blue-200 mb-2">
            <span>Progreso</span>
            <span>100%</span>
          </div>
          <div className="w-full bg-blue-900/30 rounded-full h-2">
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full w-full"></div>
          </div>
        </div>

        {error && (
          <div className="max-w-4xl mx-auto mb-6">
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
                <p className="text-red-200">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Album Cover */}
            <div className="lg:col-span-1">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                <div className="aspect-square bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg mb-4 flex items-center justify-center">
                  {coverPreview ? (
                    <img
                      src={coverPreview}
                      alt="Album cover"
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <Music className="w-24 h-24 text-white/50" />
                  )}
                </div>
                
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-white mb-2">
                    {albumData?.title}
                  </h2>
                  <p className="text-blue-200 mb-4">
                    por {albumData?.artistName}
                  </p>
                  
                  <div className="flex items-center justify-center space-x-4 text-sm text-blue-300">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      {albumData?.year}
                    </div>
                    <div className="flex items-center">
                      <Tag className="w-4 h-4 mr-1" />
                      {albumData?.genre}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Album Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Album Info */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Información del Álbum
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-blue-200 text-sm">Título</p>
                    <p className="text-white font-medium">{albumData?.title}</p>
                  </div>
                  <div>
                    <p className="text-blue-200 text-sm">Artista</p>
                    <p className="text-white font-medium">{albumData?.artistName}</p>
                  </div>
                  <div>
                    <p className="text-blue-200 text-sm">Año</p>
                    <p className="text-white font-medium">{albumData?.year}</p>
                  </div>
                  <div>
                    <p className="text-blue-200 text-sm">Género</p>
                    <p className="text-white font-medium">{albumData?.genre}</p>
                  </div>
                </div>
                
                <div>
                  <p className="text-blue-200 text-sm mb-2">Descripción</p>
                  <p className="text-white text-sm leading-relaxed">
                    {albumData?.description}
                  </p>
                </div>
              </div>

              {/* Track List */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-white flex items-center">
                    <Music className="w-5 h-5 mr-2" />
                    Lista de Tracks
                  </h3>
                  <div className="text-blue-200 text-sm">
                    {tracks.length} tracks • {formatDuration(getTotalDuration())}
                  </div>
                </div>

                <div className="space-y-2">
                  {tracks.map((track) => (
                    <div
                      key={track.id}
                      className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                          {track.trackNumber}
                        </div>
                        <div>
                          <p className="text-white font-medium">{track.title}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <span className="text-blue-200 text-sm flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {formatDuration(track.duration)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Processing Info */}
              <div className="bg-blue-500/20 border border-blue-500/50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-3">
                  ¿Qué sucede después?
                </h3>
                <div className="space-y-2 text-blue-200 text-sm">
                  <p>• Los archivos serán transcodificados a múltiples calidades (LOW, HIGH, MAX)</p>
                  <p>• Se subirán a IPFS para distribución descentralizada</p>
                  <p>• Se indexarán en la base de datos para búsquedas</p>
                  <p>• Recibirás notificaciones del progreso en tiempo real</p>
                  <p>• El proceso toma aproximadamente 5-10 minutos</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex justify-between">
            <button
              onClick={() => router.push('/upload/metadata')}
              disabled={submitting}
              className="px-6 py-3 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              ← Volver
            </button>
            
            <button
              onClick={submitAlbum}
              disabled={submitting}
              className="px-8 py-3 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all flex items-center space-x-2"
            >
              {submitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  <span>Enviar Álbum</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
