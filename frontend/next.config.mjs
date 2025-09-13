import path from 'node:path'

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: { unoptimized: true },
  // Fijamos la raíz del workspace al directorio del repo (padre de frontend)
  outputFileTracingRoot: path.resolve(process.cwd(), '..'),
};

export default nextConfig;
