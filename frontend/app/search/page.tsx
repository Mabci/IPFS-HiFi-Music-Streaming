'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Music, User, Disc, Play, Clock, Heart } from 'lucide-react';
import SearchBar from '../../components/SearchBar';

interface SearchResult {
  id: string;
  type: 'artist' | 'album' | 'track';
  name?: string;
  title?: string;
  artist?: {
    id: string;
    name: string;
    isVerified: boolean;
  };
  album?: {
    id: string;
    title: string;
    coverCid: string;
  };
  year?: number;
  genre?: string;
  coverCid?: string;
  durationSec?: number;
  playCount?: string;
  isVerified?: boolean;
  followerCount?: number;
  albumCount?: number;
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  
  const [results, setResults] = useState<{
    artists: SearchResult[];
    albums: SearchResult[];
    tracks: SearchResult[];
    total: number;
  }>({ artists: [], albums: [], tracks: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
  }, [initialQuery]);

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&limit=50`);
      if (response.ok) {
        const data = await response.json();
        setResults(data.results);
      }
    } catch (error) {
      console.error('Error en búsqueda:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResultSelect = (result: SearchResult) => {
    // Navegar al resultado seleccionado
    switch (result.type) {
      case 'artist':
        window.location.href = `/artist/${result.id}`;
        break;
      case 'album':
        window.location.href = `/album/${result.id}`;
        break;
      case 'track':
        // Reproducir track o navegar al álbum
        window.location.href = `/album/${result.album?.id}`;
        break;
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatNumber = (num: string | number) => {
    const n = typeof num === 'string' ? parseInt(num) : num;
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header con búsqueda */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-6 text-center">
            Buscar Música
          </h1>
          <div className="max-w-2xl mx-auto">
            <SearchBar
              onResultSelect={handleResultSelect}
              placeholder="Buscar artistas, álbumes, canciones..."
            />
          </div>
        </div>

        {/* Resultados */}
        {loading ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white">Buscando...</p>
          </div>
        ) : results.total > 0 ? (
          <div className="space-y-8">
            {/* Artistas */}
            {results.artists.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
                  <User className="w-6 h-6 mr-2" />
                  Artistas ({results.artists.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {results.artists.map((artist) => (
                    <div
                      key={artist.id}
                      onClick={() => handleResultSelect(artist)}
                      className="bg-white/10 backdrop-blur-sm rounded-xl p-6 hover:bg-white/15 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center">
                          <User className="w-8 h-8 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h3 className="text-white font-semibold group-hover:text-blue-300 transition-colors">
                              {artist.name}
                            </h3>
                            {artist.isVerified && (
                              <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                                <span className="text-white text-xs">✓</span>
                              </div>
                            )}
                          </div>
                          <div className="text-blue-200 text-sm space-y-1">
                            <p>{formatNumber(artist.playCount || '0')} reproducciones</p>
                            <p>{artist.albumCount} álbumes</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Álbumes */}
            {results.albums.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
                  <Disc className="w-6 h-6 mr-2" />
                  Álbumes ({results.albums.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {results.albums.map((album) => (
                    <div
                      key={album.id}
                      onClick={() => handleResultSelect(album)}
                      className="bg-white/10 backdrop-blur-sm rounded-xl p-4 hover:bg-white/15 transition-all cursor-pointer group"
                    >
                      <div className="aspect-square bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg mb-4 flex items-center justify-center">
                        <Music className="w-12 h-12 text-white/50" />
                      </div>
                      <h3 className="text-white font-semibold mb-1 truncate group-hover:text-blue-300 transition-colors">
                        {album.title}
                      </h3>
                      <p className="text-blue-200 text-sm mb-2 truncate">
                        {album.artist?.name}
                      </p>
                      <div className="flex items-center justify-between text-xs text-blue-300">
                        <span>{album.year}</span>
                        <span>{album.genre}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Tracks */}
            {results.tracks.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
                  <Music className="w-6 h-6 mr-2" />
                  Canciones ({results.tracks.length})
                </h2>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl overflow-hidden">
                  {results.tracks.map((track, index) => (
                    <div
                      key={track.id}
                      onClick={() => handleResultSelect(track)}
                      className="flex items-center space-x-4 p-4 hover:bg-white/10 transition-colors cursor-pointer group border-b border-white/5 last:border-b-0"
                    >
                      <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-blue-600 rounded-lg flex items-center justify-center">
                        <Play className="w-5 h-5 text-white" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-medium truncate group-hover:text-blue-300 transition-colors">
                          {track.title}
                        </h4>
                        <p className="text-blue-200 text-sm truncate">
                          {track.artist?.name} • {track.album?.title}
                        </p>
                      </div>

                      <div className="flex items-center space-x-4 text-blue-300 text-sm">
                        {track.durationSec && (
                          <div className="flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            {formatDuration(track.durationSec)}
                          </div>
                        )}
                        <button className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <Heart className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : query && !loading ? (
          <div className="text-center py-12">
            <Music className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              No se encontraron resultados
            </h3>
            <p className="text-blue-200">
              Intenta con otros términos de búsqueda
            </p>
          </div>
        ) : (
          <div className="text-center py-12">
            <Music className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              Descubre nueva música
            </h3>
            <p className="text-blue-200">
              Busca artistas, álbumes y canciones en nuestra plataforma
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
