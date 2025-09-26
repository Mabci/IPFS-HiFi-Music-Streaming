'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Calendar, Music, User, FileText, Image } from 'lucide-react';

interface TrackData {
  id: string;
  title: string;
  trackNumber: number;
  duration: number;
}

export default function MetadataPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tracks, setTracks] = useState<TrackData[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [albumData, setAlbumData] = useState({
    title: '',
    artistName: '',
    year: new Date().getFullYear(),
    genre: '',
    description: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Helper function para convertir File a base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const genres = [
    'Rock', 'Pop', 'Hip Hop', 'Electronic', 'Jazz', 'Classical', 'Country',
    'R&B', 'Reggae', 'Folk', 'Blues', 'Metal', 'Punk', 'Indie', 'Alternative',
    'Latin', 'World', 'Ambient', 'Experimental', 'Soundtrack'
  ];

  useEffect(() => {
    const uploadSession = sessionStorage.getItem('uploadSession');
    if (!uploadSession) {
      router.push('/upload');
      return;
    }

    const { sessionId: id, tracks: sessionTracks } = JSON.parse(uploadSession);
    setSessionId(id);
    setTracks(sessionTracks || []);
    setLoading(false);
  }, [router]);

  const handleInputChange = (field: string, value: string | number) => {
    setAlbumData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleCoverUpload = async (file: File) => {
    if (!file) return;

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({ ...prev, cover: 'Solo se permiten archivos de imagen' }));
      return;
    }

    // Validar tamaño (5MB máximo)
    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, cover: 'La imagen debe ser menor a 5MB' }));
      return;
    }

    setCoverImage(file);
    
    // Crear preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setCoverPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Subir imagen al servidor
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('coverImage', file);
      formData.append('sessionId', sessionId);

      const response = await fetch('/api/upload/cover', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Error subiendo portada');
      }

      setErrors(prev => ({ ...prev, cover: '' }));
    } catch (error) {
      console.error('Error uploading cover:', error);
      setErrors(prev => ({ ...prev, cover: 'Error subiendo la portada' }));
    } finally {
      setUploading(false);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!albumData.title.trim()) {
      newErrors.title = 'El título del álbum es obligatorio';
    }

    if (!albumData.artistName.trim()) {
      newErrors.artistName = 'El nombre del artista es obligatorio';
    }

    if (!albumData.genre) {
      newErrors.genre = 'Selecciona un género musical';
    }

    if (!albumData.description.trim()) {
      newErrors.description = 'La descripción es obligatoria';
    }

    if (albumData.year < 1900 || albumData.year > new Date().getFullYear() + 1) {
      newErrors.year = 'Año inválido';
    }

    if (!coverImage) {
      newErrors.cover = 'La portada del álbum es obligatoria';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const continueToPreview = async () => {
    if (!validateForm()) return;

    // Guardar metadatos en sessionStorage
    const uploadSession = JSON.parse(sessionStorage.getItem('uploadSession') || '{}');
    uploadSession.albumData = albumData;
    
    // Guardar cover image como base64 si existe
    if (coverImage) {
      try {
        const base64 = await fileToBase64(coverImage);
        uploadSession.coverImage = {
          name: coverImage.name,
          size: coverImage.size,
          type: coverImage.type,
          data: base64 // Guardar como base64 para persistencia
        };
      } catch (error) {
        console.error('Error converting cover to base64:', error);
        uploadSession.coverImage = null;
      }
    } else {
      uploadSession.coverImage = null;
    }
    
    sessionStorage.setItem('uploadSession', JSON.stringify(uploadSession));
    console.log('✅ Saved session data with', Object.keys(uploadSession));
    
    router.push('/upload/preview');
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Cargando...</p>
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
            Metadatos del Álbum
          </h1>
          <p className="text-blue-200">
            Paso 3 de 4: Completa la información de tu álbum
          </p>
        </div>

        {/* Progress Bar */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="flex items-center justify-between text-sm text-blue-200 mb-2">
            <span>Progreso</span>
            <span>75%</span>
          </div>
          <div className="w-full bg-blue-900/30 rounded-full h-2">
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full w-3/4"></div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Form */}
            <div className="space-y-6">
              {/* Album Title */}
              <div>
                <label className="block text-white font-medium mb-2">
                  <Music className="w-4 h-4 inline mr-2" />
                  Título del Álbum *
                </label>
                <input
                  type="text"
                  value={albumData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className={`w-full bg-white/10 border ${errors.title ? 'border-red-500' : 'border-blue-500/50'} rounded-lg px-4 py-3 text-white placeholder-blue-300 focus:outline-none focus:border-blue-400`}
                  placeholder="Nombre de tu álbum"
                />
                {errors.title && <p className="text-red-400 text-sm mt-1">{errors.title}</p>}
              </div>

              {/* Artist Name */}
              <div>
                <label className="block text-white font-medium mb-2">
                  <User className="w-4 h-4 inline mr-2" />
                  Nombre del Artista *
                </label>
                <input
                  type="text"
                  value={albumData.artistName}
                  onChange={(e) => handleInputChange('artistName', e.target.value)}
                  className={`w-full bg-white/10 border ${errors.artistName ? 'border-red-500' : 'border-blue-500/50'} rounded-lg px-4 py-3 text-white placeholder-blue-300 focus:outline-none focus:border-blue-400`}
                  placeholder="Tu nombre artístico"
                />
                {errors.artistName && <p className="text-red-400 text-sm mt-1">{errors.artistName}</p>}
              </div>

              {/* Year and Genre */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white font-medium mb-2">
                    <Calendar className="w-4 h-4 inline mr-2" />
                    Año *
                  </label>
                  <input
                    type="number"
                    value={albumData.year}
                    onChange={(e) => handleInputChange('year', parseInt(e.target.value))}
                    min="1900"
                    max={new Date().getFullYear() + 1}
                    className={`w-full bg-white/10 border ${errors.year ? 'border-red-500' : 'border-blue-500/50'} rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-400`}
                  />
                  {errors.year && <p className="text-red-400 text-sm mt-1">{errors.year}</p>}
                </div>

                <div>
                  <label className="block text-white font-medium mb-2">
                    Género *
                  </label>
                  <select
                    value={albumData.genre}
                    onChange={(e) => handleInputChange('genre', e.target.value)}
                    className={`w-full bg-white/10 border ${errors.genre ? 'border-red-500' : 'border-blue-500/50'} rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-400`}
                  >
                    <option value="">Seleccionar género</option>
                    {genres.map(genre => (
                      <option key={genre} value={genre} className="bg-gray-800">
                        {genre}
                      </option>
                    ))}
                  </select>
                  {errors.genre && <p className="text-red-400 text-sm mt-1">{errors.genre}</p>}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-white font-medium mb-2">
                  <FileText className="w-4 h-4 inline mr-2" />
                  Descripción *
                </label>
                <textarea
                  value={albumData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={4}
                  maxLength={1000}
                  className={`w-full bg-white/10 border ${errors.description ? 'border-red-500' : 'border-blue-500/50'} rounded-lg px-4 py-3 text-white placeholder-blue-300 focus:outline-none focus:border-blue-400 resize-none`}
                  placeholder="Describe tu álbum, inspiración, proceso creativo..."
                />
                <div className="flex justify-between items-center mt-1">
                  {errors.description && <p className="text-red-400 text-sm">{errors.description}</p>}
                  <p className="text-blue-300 text-sm ml-auto">
                    {albumData.description.length}/1000
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column - Cover Upload & Track List */}
            <div className="space-y-6">
              {/* Cover Upload */}
              <div>
                <label className="block text-white font-medium mb-2">
                  <Image className="w-4 h-4 inline mr-2" />
                  Portada del Álbum *
                </label>
                
                <div className={`border-2 border-dashed rounded-lg p-6 text-center ${errors.cover ? 'border-red-500' : 'border-blue-500/50'}`}>
                  {coverPreview ? (
                    <div className="space-y-4">
                      <img
                        src={coverPreview}
                        alt="Cover preview"
                        className="w-48 h-48 object-cover rounded-lg mx-auto"
                      />
                      <div>
                        <button
                          onClick={() => document.getElementById('cover-input')?.click()}
                          className="text-blue-400 hover:text-blue-300"
                        >
                          Cambiar imagen
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Upload className="w-12 h-12 text-blue-400 mx-auto mb-4" />
                      <p className="text-white mb-2">Subir portada del álbum</p>
                      <p className="text-blue-200 text-sm">
                        JPG, PNG o WebP • Máximo 5MB • Mínimo 500x500px
                      </p>
                      <button
                        onClick={() => document.getElementById('cover-input')?.click()}
                        className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        disabled={uploading}
                      >
                        {uploading ? 'Subiendo...' : 'Seleccionar Imagen'}
                      </button>
                    </div>
                  )}
                </div>
                
                <input
                  id="cover-input"
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleCoverUpload(e.target.files[0])}
                  className="hidden"
                />
                {errors.cover && <p className="text-red-400 text-sm mt-1">{errors.cover}</p>}
              </div>

              {/* Track List Preview */}
              <div>
                <h3 className="text-white font-medium mb-4">
                  Lista de Tracks ({tracks.length})
                </h3>
                <div className="bg-white/5 rounded-lg p-4 max-h-64 overflow-y-auto">
                  {tracks.map((track) => (
                    <div key={track.id} className="flex justify-between items-center py-2 border-b border-white/10 last:border-b-0">
                      <div className="flex items-center space-x-3">
                        <span className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {track.trackNumber}
                        </span>
                        <span className="text-white text-sm">{track.title}</span>
                      </div>
                      <span className="text-blue-200 text-sm">
                        {formatDuration(track.duration)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex justify-between">
            <button
              onClick={() => router.push('/upload/tracks')}
              className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              ← Volver
            </button>
            
            <button
              onClick={continueToPreview}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-medium transition-all"
            >
              Continuar →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
