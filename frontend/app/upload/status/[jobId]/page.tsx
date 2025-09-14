'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Home } from 'lucide-react';
import UploadProgress from '../../../../components/UploadProgress';
import { useAuth } from '../../../../lib/hooks/useAuth';

export default function UploadStatusPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const jobId = params.jobId as string;
  const [albumTitle, setAlbumTitle] = useState<string>('');
  const [isCompleted, setIsCompleted] = useState(false);
  const [albumId, setAlbumId] = useState<string>('');

  useEffect(() => {
    // Obtener título del álbum desde sessionStorage si está disponible
    const uploadSession = sessionStorage.getItem('uploadSession');
    if (uploadSession) {
      try {
        const sessionData = JSON.parse(uploadSession);
        setAlbumTitle(sessionData.albumData?.title || 'Álbum sin título');
      } catch (error) {
        console.error('Error parsing session data:', error);
      }
    } else {
      setAlbumTitle('Procesando álbum...');
    }
  }, []);

  const handleComplete = (success: boolean, resultAlbumId?: string) => {
    setIsCompleted(true);
    if (success && resultAlbumId) {
      setAlbumId(resultAlbumId);
    }
  };

  const handleError = (error: string) => {
    console.error('Error en upload:', error);
    // El componente UploadProgress ya maneja la visualización del error
  };

  const goToAlbum = () => {
    if (albumId) {
      router.push(`/album/${albumId}`);
    }
  };

  const goHome = () => {
    router.push('/');
  };

  const startNewUpload = () => {
    // Limpiar cualquier sesión anterior
    sessionStorage.removeItem('uploadSession');
    router.push('/upload');
  };

  if (!jobId || !user?.id || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Cargando información del progreso...</p>
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
            Progreso de Upload
          </h1>
          <p className="text-blue-200">
            Seguimiento en tiempo real del procesamiento de tu álbum
          </p>
        </div>

        {/* Progress Component */}
        <div className="max-w-4xl mx-auto mb-8">
          <UploadProgress
            jobId={jobId}
            userId={user.id}
            albumTitle={albumTitle}
            onComplete={handleComplete}
            onError={handleError}
          />
        </div>

        {/* Action Buttons */}
        <div className="max-w-2xl mx-auto">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isCompleted ? (
              <>
                {albumId && (
                  <button
                    onClick={goToAlbum}
                    className="px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white rounded-lg font-medium transition-all flex items-center justify-center space-x-2"
                  >
                    <span>Ver Álbum</span>
                  </button>
                )}
                <button
                  onClick={startNewUpload}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium transition-all flex items-center justify-center space-x-2"
                >
                  <span>Subir Otro Álbum</span>
                </button>
              </>
            ) : (
              <div className="text-center">
                <p className="text-blue-200 text-sm mb-4">
                  El procesamiento puede tomar varios minutos. Puedes cerrar esta página y volver más tarde.
                </p>
                <button
                  onClick={() => router.push('/upload')}
                  className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 mx-auto"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Volver a Upload</span>
                </button>
              </div>
            )}
          </div>

          <div className="text-center mt-6">
            <button
              onClick={goHome}
              className="text-blue-300 hover:text-white transition-colors flex items-center justify-center space-x-2 mx-auto"
            >
              <Home className="w-4 h-4" />
              <span>Ir al Inicio</span>
            </button>
          </div>
        </div>

        {/* Information Panel */}
        <div className="max-w-2xl mx-auto mt-8">
          <div className="bg-blue-500/20 border border-blue-500/50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-3">
              Información del Proceso
            </h3>
            <div className="space-y-2 text-blue-200 text-sm">
              <p><strong>ID del trabajo:</strong> <span className="font-mono text-white">{jobId}</span></p>
              <p><strong>Estado:</strong> Las notificaciones se actualizan en tiempo real</p>
              <p><strong>Tiempo estimado:</strong> 5-10 minutos dependiendo del tamaño</p>
              <p><strong>Proceso:</strong> Transcodificación → IPFS → Base de datos</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
