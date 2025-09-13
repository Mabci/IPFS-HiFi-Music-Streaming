import path from 'node:path'

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: { unoptimized: true },
  // Fijamos la raíz del workspace al directorio del repo (padre de frontend)
  outputFileTracingRoot: path.resolve(process.cwd(), '..'),
  
  // Configuración para Vercel deployment
  env: {
    BACKEND_URL: process.env.BACKEND_URL || 'https://nyauwu.com',
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || 'https://nyauwu.com',
  },
  
  // Reescritura de rutas API para el backend
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
