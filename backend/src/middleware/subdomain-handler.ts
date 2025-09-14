import { Request, Response, NextFunction } from 'express';

interface SubdomainRequest extends Request {
  subdomain?: string;
  isArtistDomain?: boolean;
}

/**
 * Middleware para detectar y manejar subdominios
 */
export function subdomainHandler(req: SubdomainRequest, res: Response, next: NextFunction) {
  const host = req.get('host') || '';
  const hostname = host.split(':')[0]; // Remover puerto si existe
  
  // Detectar subdominio
  if (hostname.includes('artist.')) {
    req.subdomain = 'artist';
    req.isArtistDomain = true;
  } else {
    req.subdomain = 'main';
    req.isArtistDomain = false;
  }

  // Agregar headers para identificar el contexto
  res.setHeader('X-Subdomain', req.subdomain);
  
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
