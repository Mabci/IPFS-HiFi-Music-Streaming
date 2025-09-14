import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const url = request.nextUrl.clone();
  
  // Detectar si es el subdominio de artistas
  const isArtistDomain = hostname.includes('artist.');
  const isMainDomain = !isArtistDomain;
  
  // Rutas que solo deben estar disponibles en el subdominio de artistas
  const artistOnlyPaths = ['/upload'];
  
  // Rutas que solo deben estar disponibles en el dominio principal
  const mainOnlyPaths = ['/auth', '/library', '/playlists'];
  
  // Verificar si la ruta actual requiere redirección
  const currentPath = url.pathname;
  
  // Si estamos en el dominio principal pero accediendo a rutas de artistas
  if (isMainDomain && artistOnlyPaths.some(path => currentPath.startsWith(path))) {
    // Redirigir al subdominio de artistas
    if (process.env.NODE_ENV === 'production') {
      url.hostname = 'artist.nyauwu.com';
    } else {
      // En desarrollo, mantener localhost pero agregar header
      const response = NextResponse.next();
      response.headers.set('x-artist-redirect', 'true');
      return response;
    }
    return NextResponse.redirect(url);
  }
  
  // Si estamos en el subdominio de artistas pero accediendo a rutas principales
  if (isArtistDomain && mainOnlyPaths.some(path => currentPath.startsWith(path))) {
    // Redirigir al dominio principal
    if (process.env.NODE_ENV === 'production') {
      url.hostname = 'nyauwu.com';
    } else {
      // En desarrollo, mantener localhost pero agregar header
      const response = NextResponse.next();
      response.headers.set('x-main-redirect', 'true');
      return response;
    }
    return NextResponse.redirect(url);
  }
  
  // Agregar headers para identificar el contexto
  const response = NextResponse.next();
  response.headers.set('x-subdomain', isArtistDomain ? 'artist' : 'main');
  response.headers.set('x-is-artist-domain', isArtistDomain.toString());
  
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
