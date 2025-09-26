import { Request, Response, NextFunction } from 'express';

interface SubdomainRequest extends Request {
  subdomain?: string;
  isArtistDomain?: boolean;
}

/**
 * Middleware para detectar y manejar subdominios
 */
export function subdomainHandler(req: SubdomainRequest, res: Response, next: NextFunction) {
  // Obtener hostname original (considerando proxies como Vercel)
  const originalHost = req.get('x-forwarded-host') || req.get('host') || '';
  const hostname = originalHost.split(':')[0]; // Remover puerto si existe
  
  console.log('[subdomain] Original host:', originalHost);
  console.log('[subdomain] Parsed hostname:', hostname);
  
  // Detectar subdominio
  if (hostname.includes('artist.')) {
    req.subdomain = 'artist';
    req.isArtistDomain = true;
  } else {
    req.subdomain = 'main';
    req.isArtistDomain = false;
  }

  console.log('[subdomain] Detected subdomain:', req.subdomain);
  console.log('[subdomain] Is artist domain:', req.isArtistDomain);

  // Agregar headers para identificar el contexto
  res.setHeader('X-Subdomain', req.subdomain);
  res.setHeader('X-Is-Artist-Domain', req.isArtistDomain ? 'true' : 'false');
  
  next();
}

/**
 * Middleware para restringir rutas solo a artistas
 */
export function requireArtistDomain(req: SubdomainRequest, res: Response, next: NextFunction) {
  if (!req.isArtistDomain) {
    return res.status(403).json({
      success: false,
      error: 'Esta funcionalidad solo está disponible en artist.nyauwu.com',
      redirectUrl: `https://artist.nyauwu.com${req.originalUrl}`
    });
  }
  
  next();
}

/**
 * Middleware para restringir rutas solo al dominio principal
 */
export function requireMainDomain(req: SubdomainRequest, res: Response, next: NextFunction) {
  if (req.isArtistDomain) {
    return res.status(403).json({
      success: false,
      error: 'Esta funcionalidad solo está disponible en nyauwu.com',
      redirectUrl: `https://nyauwu.com${req.originalUrl}`
    });
  }
  
  next();
}
