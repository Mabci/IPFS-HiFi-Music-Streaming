import { Router } from 'express';
import { ipfsGatewayService } from '../services/ipfs-gateway-service.js';

// Middleware temporal para auth (se puede extraer después)
async function requireAuth(req: any, res: any, next: any) {
  try {
    const token = req?.cookies?.session as string | undefined;
    if (!token) {
      return res.status(401).json({ ok: false, error: 'no_session' });
    }
    next();
  } catch (e) {
    console.error('[requireAuth] error:', e);
    return res.status(500).json({ ok: false, error: 'auth_middleware_failed' });
  }
}

const router = Router();

/**
 * GET /api/ipfs/status
 * Obtiene el estado de la gateway IPFS privada
 */
router.get('/status', requireAuth, async (req: any, res) => {
  try {
    const stats = await ipfsGatewayService.getGatewayStats();
    
    res.json({
      success: true,
      ipfs: {
        enabled: ipfsGatewayService.isEnabled(),
        ...stats
      }
    });
  } catch (error: any) {
    console.error('Error obteniendo estado de IPFS:', error);
    res.status(500).json({
      success: false,
      error: 'Error consultando estado de IPFS',
      details: error.message
    });
  }
});

/**
 * GET /api/ipfs/health
 * Verifica la salud de la gateway IPFS
 */
router.get('/health', requireAuth, async (req: any, res) => {
  try {
    if (!ipfsGatewayService.isEnabled()) {
      return res.json({
        success: true,
        healthy: false,
        enabled: false,
        message: 'Gateway IPFS privada no está habilitada'
      });
    }

    const isHealthy = await ipfsGatewayService.checkGatewayHealth();
    
    res.json({
      success: true,
      healthy: isHealthy,
      enabled: true,
      message: isHealthy ? 'Gateway IPFS funcionando correctamente' : 'Gateway IPFS no responde'
    });
  } catch (error: any) {
    console.error('Error verificando salud de IPFS:', error);
    res.status(500).json({
      success: false,
      healthy: false,
      error: 'Error verificando IPFS',
      details: error.message
    });
  }
});

/**
 * GET /api/ipfs/verify/:cid
 * Verifica si un CID existe y es accesible
 */
router.get('/verify/:cid', requireAuth, async (req: any, res) => {
  try {
    const { cid } = req.params;
    
    if (!ipfsGatewayService.isEnabled()) {
      return res.status(400).json({
        success: false,
        error: 'Gateway IPFS privada no está habilitada'
      });
    }

    const exists = await ipfsGatewayService.verifyCID(cid);
    
    res.json({
      success: true,
      cid,
      exists,
      accessible: exists,
      url: exists ? ipfsGatewayService.getPublicUrl(cid) : null
    });
  } catch (error: any) {
    console.error('Error verificando CID:', error);
    res.status(500).json({
      success: false,
      error: 'Error verificando CID',
      details: error.message
    });
  }
});

/**
 * POST /api/ipfs/pin/:cid
 * Fija un CID en la gateway privada
 */
router.post('/pin/:cid', requireAuth, async (req: any, res) => {
  try {
    const { cid } = req.params;
    
    if (!ipfsGatewayService.isEnabled()) {
      return res.status(400).json({
        success: false,
        error: 'Gateway IPFS privada no está habilitada'
      });
    }

    const result = await ipfsGatewayService.pinCID(cid);
    
    res.json({
      success: result.success,
      cid,
      message: result.message
    });
  } catch (error: any) {
    console.error('Error fijando CID:', error);
    res.status(500).json({
      success: false,
      error: 'Error fijando CID',
      details: error.message
    });
  }
});

export default router;
