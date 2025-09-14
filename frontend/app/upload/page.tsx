'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { Upload, Music, AlertCircle, CheckCircle } from 'lucide-react';
import { getSession } from '@/lib/auth';

interface UploadedFile {
  id: string;
  file: File;
  originalName: string;
  size: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progress: number;
  error?: string;
}

export default function UploadPage() {
  const router = useRouter();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Verificar autenticación al cargar la página
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await getSession();
        if (!session.authenticated) {
          router.push('/auth');
          return;
        }
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Error verificando autenticación:', error);
        router.push('/auth');
      }
    };

    checkAuth();
  }, [router]);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setUploadError(null);
    
    // Manejar archivos rechazados
    if (rejectedFiles.length > 0) {
      const errors = rejectedFiles.map(({ file, errors }) => 
        `${file.name}: ${errors.map((e: any) => e.message).join(', ')}`
      ).join('\n');
      setUploadError(`Archivos rechazados:\n${errors}`);
    }

    // Agregar archivos aceptados
    const newFiles: UploadedFile[] = acceptedFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      originalName: file.name,
      size: file.size,
      status: 'pending',
      progress: 0
    }));

    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/wav': ['.wav'],
      'audio/flac': ['.flac'],
      'audio/mpeg': ['.mp3'],
      'audio/mp4': ['.m4a'],
      'audio/x-m4a': ['.m4a']
    },
    maxSize: 100 * 1024 * 1024, // 100MB
    maxFiles: 20
  });

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('sessionId', sessionId);
      
      files.forEach(fileData => {
        formData.append('audioFiles', fileData.file);
      });

      // Actualizar estado a "uploading"
      setFiles(prev => prev.map(f => ({ ...f, status: 'uploading' as const })));

      const response = await fetch('/api/upload/files', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        // Manejar diferentes tipos de errores
        let errorMessage = 'Error subiendo archivos';
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (jsonError) {
          // Si no es JSON válido, probablemente es un error de autenticación
          if (response.status === 401) {
            errorMessage = 'Sesión expirada. Por favor, inicia sesión nuevamente.';
            // Redirigir a login después de un momento
            setTimeout(() => {
              router.push('/auth');
            }, 2000);
          } else if (response.status === 403) {
            errorMessage = 'No tienes permisos para subir archivos.';
          } else {
            const textError = await response.text();
            errorMessage = `Error del servidor: ${textError.substring(0, 100)}`;
          }
        }
        
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      // Actualizar estado a "completed"
      setFiles(prev => prev.map(f => ({ 
        ...f, 
        status: 'completed' as const,
        progress: 100 
      })));

      // Guardar datos en sessionStorage para la siguiente página
      sessionStorage.setItem('uploadSession', JSON.stringify({
        sessionId,
        files: result.files
      }));

      // Navegar a la página de ordenamiento de tracks
      router.push('/upload/tracks');

    } catch (error) {
      console.error('Error uploading files:', error);
      setUploadError(error instanceof Error ? error.message : 'Error desconocido');
      setFiles(prev => prev.map(f => ({ 
        ...f, 
        status: 'error' as const 
      })));
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'uploading':
        return <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      default:
        return <Music className="w-5 h-5 text-gray-400" />;
    }
  };

  // Mostrar loading mientras se verifica autenticación
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Verificando autenticación...</p>
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
            Subir Álbum
          </h1>
          <p className="text-blue-200">
            Paso 1 de 4: Selecciona los archivos de audio de tu álbum
          </p>
        </div>

        {/* Progress Bar */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="flex items-center justify-between text-sm text-blue-200 mb-2">
            <span>Progreso</span>
            <span>25%</span>
          </div>
          <div className="w-full bg-blue-900/30 rounded-full h-2">
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full w-1/4"></div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Upload Area */}
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
              ${isDragActive 
                ? 'border-blue-400 bg-blue-500/10' 
                : 'border-blue-500/50 hover:border-blue-400 hover:bg-blue-500/5'
              }
            `}
          >
            <input {...getInputProps()} />
            <Upload className="w-16 h-16 text-blue-400 mx-auto mb-4" />
            
            {isDragActive ? (
              <p className="text-xl text-blue-300">
                Suelta los archivos aquí...
              </p>
            ) : (
              <div>
                <p className="text-xl text-white mb-2">
                  Arrastra archivos de audio aquí o haz clic para seleccionar
                </p>
                <p className="text-blue-200">
                  Formatos soportados: WAV, FLAC, MP3, M4A
                </p>
                <p className="text-blue-300 text-sm mt-2">
                  Máximo 20 archivos, 100MB por archivo
                </p>
              </div>
            )}
          </div>

          {/* Error Message */}
          {uploadError && (
            <div className="mt-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
                <p className="text-red-200 whitespace-pre-line">{uploadError}</p>
              </div>
            </div>
          )}

          {/* Files List */}
          {files.length > 0 && (
            <div className="mt-8">
              <h3 className="text-xl font-semibold text-white mb-4">
                Archivos seleccionados ({files.length})
              </h3>
              
              <div className="space-y-3">
                {files.map((fileData) => (
                  <div
                    key={fileData.id}
                    className="bg-white/10 backdrop-blur-sm rounded-lg p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center flex-1">
                      {getStatusIcon(fileData.status)}
                      <div className="ml-3 flex-1">
                        <p className="text-white font-medium truncate">
                          {fileData.originalName}
                        </p>
                        <p className="text-blue-200 text-sm">
                          {formatFileSize(fileData.size)}
                        </p>
                      </div>
                    </div>
                    
                    {fileData.status === 'uploading' && (
                      <div className="w-24 bg-blue-900/50 rounded-full h-2 mr-4">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${fileData.progress}%` }}
                        ></div>
                      </div>
                    )}
                    
                    {fileData.status === 'pending' && (
                      <button
                        onClick={() => removeFile(fileData.id)}
                        className="text-red-400 hover:text-red-300 ml-4"
                        disabled={isUploading}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {files.length > 0 && (
            <div className="mt-8 flex justify-between">
              <button
                onClick={() => setFiles([])}
                disabled={isUploading}
                className="px-6 py-3 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                Limpiar Todo
              </button>
              
              <button
                onClick={uploadFiles}
                disabled={isUploading || files.length === 0}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all"
              >
                {isUploading ? 'Subiendo...' : 'Continuar →'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
