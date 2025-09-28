import path from 'node:path'

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: { unoptimized: true },
  // Fijamos la raíz del workspace al directorio del repo (padre de frontend)
  outputFileTracingRoot: path.resolve(process.cwd(), '..'),
  
  // Configuración específica para resolver paths en Vercel
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Asegurar que los alias de TypeScript funcionen correctamente
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(process.cwd()),
    }
    return config
  },
  
  // Configuración para Vercel deployment
  env: {
    BACKEND_URL: process.env.BACKEND_URL || (process.env.NODE_ENV === 'production' ? 'https://ipfs-hifi-music-streaming.onrender.com' : 'http://localhost:4000'),
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || (process.env.NODE_ENV === 'production' ? 'https://ipfs-hifi-music-streaming.onrender.com' : 'http://localhost:4000'),
  },
  
  // Reescritura de rutas API para el backend
  async rewrites() {
    // Asegurar que siempre hay una URL válida para el backend
    const backendUrl = process.env.BACKEND_URL || (process.env.NODE_ENV === 'production' ? 'https://ipfs-hifi-music-streaming.onrender.com' : 'http://localhost:4000');
    
    console.log('[next.config] Backend URL configurada:', backendUrl);
    console.log('[next.config] NODE_ENV:', process.env.NODE_ENV);
    
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
