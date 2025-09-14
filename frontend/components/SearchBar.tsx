'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X, Music, User, Disc, Clock } from 'lucide-react';

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
}

interface SearchBarProps {
  onResultSelect?: (result: SearchResult) => void;
  placeholder?: string;
  className?: string;
}

export default function SearchBar({ onResultSelect, placeholder = "Buscar música, artistas, álbumes...", className = "" }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Cerrar resultados al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Búsqueda con debounce
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.trim().length < 2) {
      setResults([]);
      setSuggestions([]);
      setShowResults(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        // Búsqueda principal
        const searchResponse = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=8`);
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          const allResults = [
            ...searchData.results.artists,
            ...searchData.results.albums,
            ...searchData.results.tracks
          ];
          setResults(allResults);
        }

        // Sugerencias
        const suggestionsResponse = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`);
        if (suggestionsResponse.ok) {
          const suggestionsData = await suggestionsResponse.json();
          setSuggestions(suggestionsData.suggestions.map((s: any) => s.text));
        }

        setShowResults(true);
      } catch (error) {
        console.error('Error en búsqueda:', error);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults) return;

    const totalItems = results.length + suggestions.length;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < totalItems - 1 ? prev + 1 : -1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > -1 ? prev - 1 : totalItems - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          if (selectedIndex < results.length) {
            handleResultSelect(results[selectedIndex]);
          } else {
            const suggestionIndex = selectedIndex - results.length;
            setQuery(suggestions[suggestionIndex]);
          }
        }
        break;
      case 'Escape':
        setShowResults(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const handleResultSelect = (result: SearchResult) => {
    setShowResults(false);
    setSelectedIndex(-1);
    onResultSelect?.(result);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setSuggestions([]);
    setShowResults(false);
    inputRef.current?.focus();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'artist':
        return <User className="w-4 h-4" />;
      case 'album':
        return <Disc className="w-4 h-4" />;
      case 'track':
        return <Music className="w-4 h-4" />;
      default:
        return <Search className="w-4 h-4" />;
    }
  };

  const getResultTitle = (result: SearchResult) => {
    switch (result.type) {
      case 'artist':
        return result.name;
      case 'album':
      case 'track':
        return result.title;
      default:
        return '';
    }
  };

  const getResultSubtitle = (result: SearchResult) => {
    switch (result.type) {
      case 'artist':
        return `${result.playCount || '0'} reproducciones`;
      case 'album':
        return `${result.artist?.name} • ${result.year}`;
      case 'track':
        return `${result.artist?.name} • ${result.album?.title}`;
      default:
        return '';
    }
  };

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      {/* Input de búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && setShowResults(true)}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:bg-white/15 transition-all"
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>

      {/* Resultados de búsqueda */}
      {showResults && (results.length > 0 || suggestions.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900/95 backdrop-blur-sm border border-white/20 rounded-xl shadow-2xl z-50 max-h-96 overflow-y-auto">
          {/* Resultados principales */}
          {results.length > 0 && (
            <div className="p-2">
              <div className="text-gray-400 text-xs font-medium px-3 py-2 uppercase tracking-wide">
                Resultados
              </div>
              {results.map((result, index) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleResultSelect(result)}
                  className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg text-left transition-colors ${
                    selectedIndex === index
                      ? 'bg-blue-600/20 text-blue-300'
                      : 'hover:bg-white/10 text-white'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${
                    result.type === 'artist' ? 'bg-purple-500/20 text-purple-400' :
                    result.type === 'album' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-green-500/20 text-green-400'
                  }`}>
                    {getResultIcon(result.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {getResultTitle(result)}
                    </div>
                    <div className="text-sm text-gray-400 truncate">
                      {getResultSubtitle(result)}
                    </div>
                  </div>

                  {result.type === 'track' && result.durationSec && (
                    <div className="flex items-center text-gray-400 text-sm">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatDuration(result.durationSec)}
                    </div>
                  )}

                  <div className="text-xs text-gray-500 capitalize">
                    {result.type}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Sugerencias */}
          {suggestions.length > 0 && (
            <div className="p-2 border-t border-white/10">
              <div className="text-gray-400 text-xs font-medium px-3 py-2 uppercase tracking-wide">
                Sugerencias
              </div>
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion}
                  onClick={() => setQuery(suggestion)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    selectedIndex === results.length + index
                      ? 'bg-blue-600/20 text-blue-300'
                      : 'hover:bg-white/10 text-white'
                  }`}
                >
                  <Search className="w-4 h-4 text-gray-400" />
                  <span className="truncate">{suggestion}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Estado vacío */}
      {showResults && !isLoading && results.length === 0 && suggestions.length === 0 && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900/95 backdrop-blur-sm border border-white/20 rounded-xl shadow-2xl z-50 p-6 text-center">
          <Search className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-white font-medium mb-1">No se encontraron resultados</p>
          <p className="text-gray-400 text-sm">
            Intenta con otros términos de búsqueda
          </p>
        </div>
      )}
    </div>
  );
}
