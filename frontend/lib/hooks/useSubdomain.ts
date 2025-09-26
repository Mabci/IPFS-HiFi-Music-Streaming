import { useState, useEffect } from 'react';

interface SubdomainInfo {
  isArtistDomain: boolean;
  isMainDomain: boolean;
  subdomain: string;
  backendUrl: string;
  frontendUrl: string;
}

export function useSubdomain(): SubdomainInfo {
  const [subdomainInfo, setSubdomainInfo] = useState<SubdomainInfo>({
    isArtistDomain: false,
    isMainDomain: true,
    subdomain: 'main',
    backendUrl: 'http://localhost:4000',
    frontendUrl: 'http://localhost:3000'
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const isArtistDomain = hostname.includes('artist.');
      const isMainDomain = !isArtistDomain;
      
      // Determinar URLs según el entorno y subdominio
      let backendUrl: string;
      let frontendUrl: string;
      
      // Detección más robusta del entorno: si hostname contiene los dominios de producción
      const isProduction = hostname.includes('nyauwu.com') || hostname.includes('vercel.app') || hostname.includes('netlify.app');
      
      if (isProduction) {
        backendUrl = 'https://ipfs-hifi-music-streaming.onrender.com';
        frontendUrl = isArtistDomain ? 'https://artist.nyauwu.com' : 'https://nyauwu.com';
        console.log('🌐 PRODUCTION MODE - Backend URL:', backendUrl);
      } else {
        backendUrl = 'http://localhost:4000';
        frontendUrl = 'http://localhost:3000';
        console.log('🔧 DEVELOPMENT MODE - Backend URL:', backendUrl);
      }
      
      setSubdomainInfo({
        isArtistDomain,
        isMainDomain,
        subdomain: isArtistDomain ? 'artist' : 'main',
        backendUrl,
        frontendUrl
      });
    }
  }, []);

  return subdomainInfo;
}

/**
 * Hook para obtener la URL correcta según el contexto
 */
export function useContextualUrl() {
  const { isArtistDomain, backendUrl } = useSubdomain();
  
  const getApiUrl = (endpoint: string) => {
    return `${backendUrl}${endpoint}`;
  };
  
  const getArtistUrl = (path: string = '') => {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    const isProduction = hostname.includes('nyauwu.com') || hostname.includes('vercel.app') || hostname.includes('netlify.app');
    
    if (isProduction) {
      return `https://artist.nyauwu.com${path}`;
    }
    return `http://localhost:3000${path}`;
  };
  
  const getMainUrl = (path: string = '') => {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    const isProduction = hostname.includes('nyauwu.com') || hostname.includes('vercel.app') || hostname.includes('netlify.app');
    
    if (isProduction) {
      return `https://nyauwu.com${path}`;
    }
    return `http://localhost:3000${path}`;
  };
  
  return {
    isArtistDomain,
    getApiUrl,
    getArtistUrl,
    getMainUrl,
    backendUrl
  };
}
