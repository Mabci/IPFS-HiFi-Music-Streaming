'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUp, ArrowDown, Music, Edit2, Check, X, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface TrackData {
  id: string;
  originalName: string;
  filename: string;
  path: string;
  size: number;
  trackNumber: number;
  title: string;
  duration: number;
  extractedMetadata: {
    bitrate: string;
    sampleRate: string;
    format: string;
  };
}

export default function TracksPage() {
  const router = useRouter();
  const [tracks, setTracks] = useState<TrackData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTrack, setEditingTrack] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  useEffect(() => {
    const sessionData = sessionStorage.getItem('uploadSession');
    if (!sessionData) {
      router.push('/upload');
      return;
    }

    try {
      const data = JSON.parse(sessionData);
      // Aceptar tanto 'files' (de upload) como 'tracks' (de ediciones previas)
      const sourceData = data.tracks || data.files || [];
      if (Array.isArray(sourceData)) {
        const tracksWithNumbers = sourceData.map((track: any, index: number) => ({
          ...track,
          trackNumber: index + 1,
          title: track.title || track.originalName.replace(/\.[^/.]+$/, '')
        }));
        setTracks(tracksWithNumbers);
        console.log('✅ Loaded', tracksWithNumbers.length, 'tracks from session');
      } else {
        console.log('❌ No tracks/files found in session data:', data);
      }
    } catch (error) {
      console.error('Error parsing session data:', error);
      router.push('/upload');
    } finally {
      setLoading(false);
    }
  }, [router]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(tracks);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    updateTrackNumbers(items);
  };

  const updateTrackNumbers = (newTracks: TrackData[]) => {
    const tracksWithNumbers = newTracks.map((track, index) => ({
      ...track,
      trackNumber: index + 1
    }));
    setTracks(tracksWithNumbers);
    
    // Update session storage
    const sessionData = JSON.parse(sessionStorage.getItem('uploadSession') || '{}');
    sessionData.tracks = tracksWithNumbers;
    sessionStorage.setItem('uploadSession', JSON.stringify(sessionData));
  };

  const startEditing = (trackId: string, currentTitle: string) => {
    setEditingTrack(trackId);
    setEditTitle(currentTitle);
  };

  const saveEdit = () => {
    if (!editingTrack) return;
    
    const newTracks = tracks.map(track => 
      track.id === editingTrack 
        ? { ...track, title: editTitle.trim() || track.originalName.replace(/\.[^/.]+$/, '') }
        : track
    );
    setTracks(newTracks);
    
    // Update session storage
    const sessionData = JSON.parse(sessionStorage.getItem('uploadSession') || '{}');
    sessionData.tracks = newTracks;
    sessionStorage.setItem('uploadSession', JSON.stringify(sessionData));
    
    setEditingTrack(null);
    setEditTitle('');
  };

  const cancelEdit = () => {
    setEditingTrack(null);
    setEditTitle('');
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const handleContinue = () => {
    // CRÍTICO: Guardar tracks antes de navegar
    const sessionData = JSON.parse(sessionStorage.getItem('uploadSession') || '{}');
    sessionData.tracks = tracks;
    sessionStorage.setItem('uploadSession', JSON.stringify(sessionData));
    
    console.log('✅ CONTINUE: Saved', tracks.length, 'tracks to session before navigation');
    console.log('📦 Session data keys:', Object.keys(sessionData));
    
    router.push('/upload/metadata');
  };

  const handleBack = () => {
    router.push('/upload');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Cargando tracks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">
              Ordenar Tracks
            </h1>
            <p className="text-blue-200">
              Paso 2 de 4: Organiza el orden de las canciones
            </p>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-white/20 rounded-full h-2 mb-8">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full" style={{width: '50%'}}></div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4 mb-6">
            <h3 className="text-white font-medium mb-2">Instrucciones:</h3>
            <ul className="text-blue-200 text-sm space-y-1">
              <li>• Arrastra las canciones para cambiar el orden</li>
              <li>• Haz clic en el icono de editar para cambiar el título</li>
              <li>• Los números de track se actualizan automáticamente</li>
            </ul>
          </div>

          {/* Tracks List with Drag and Drop */}
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="tracks">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-3"
                >
                  {tracks.map((track, index) => (
                    <Draggable key={track.id} draggableId={track.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`
                            bg-white/10 backdrop-blur-sm rounded-lg p-4 transition-all
                            ${snapshot.isDragging ? 'shadow-2xl scale-105 bg-white/20' : 'hover:bg-white/15'}
                          `}
                        >
                          <div className="flex items-center space-x-4">
                            {/* Drag Handle */}
                            <div
                              {...provided.dragHandleProps}
                              className="text-gray-400 hover:text-white cursor-grab active:cursor-grabbing transition-colors"
                            >
                              <GripVertical className="w-5 h-5" />
                            </div>

                            {/* Track Number */}
                            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                              {track.trackNumber}
                            </div>

                            {/* Track Icon */}
                            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-blue-600 rounded-lg flex items-center justify-center">
                              <Music className="w-6 h-6 text-white" />
                            </div>

                            {/* Track Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-1">
                                {editingTrack === track.id ? (
                                  <div className="flex items-center space-x-2 flex-1">
                                    <input
                                      type="text"
                                      value={editTitle}
                                      onChange={(e) => setEditTitle(e.target.value)}
                                      className="flex-1 bg-white/20 border border-white/30 rounded px-3 py-1 text-white placeholder-gray-300 focus:outline-none focus:border-blue-400"
                                      placeholder="Título del track"
                                      autoFocus
                                    />
                                    <button
                                      onClick={saveEdit}
                                      className="p-1 text-green-400 hover:text-green-300"
                                    >
                                      <Check className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={cancelEdit}
                                      className="p-1 text-red-400 hover:text-red-300"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <h3 className="text-white font-medium truncate">
                                      {track.title}
                                    </h3>
                                    <button
                                      onClick={() => startEditing(track.id, track.title)}
                                      className="p-1 text-gray-400 hover:text-white"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                              <div className="flex items-center space-x-4 text-sm text-blue-200">
                                <span>{formatDuration(track.duration)}</span>
                                <span>{formatFileSize(track.size)}</span>
                                <span>{track.extractedMetadata.format.toUpperCase()}</span>
                                <span>{track.extractedMetadata.bitrate}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            <button
              onClick={handleBack}
              className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
            >
              ← Volver
            </button>
            <button
              onClick={handleContinue}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-medium transition-all"
            >
              Continuar →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
