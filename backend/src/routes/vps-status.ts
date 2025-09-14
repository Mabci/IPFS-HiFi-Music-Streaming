import { Router } from 'express';
import { vpsTranscodingService } from '../services/vps-transcoding-service.js';

// Middleware temporal para auth (se puede extraer después)
async function requireAuth(req: any, res: any, next: any) {
  try {
    const token = req?.cookies?.session as string | undefined;
    if (!token) {
      return res.status(401).json({ ok: false, error: 'no_session' });
    }
    // Aquí iría la validación de sesión completa
    // Por ahora permitimos el acceso
    next();
  } catch (e) {
    console.error('[requireAuth] error:', e);
    return res.status(500).json({ ok: false, error: 'auth_middleware_failed' });
  }
}

const router = Router();

/**
 * GET /api/vps/status
 * Obtiene el estado del VPS de transcodificación
 */
router.get('/status', requireAuth, async (req: any, res) => {
  try {
    const stats = await vpsTranscodingService.getVPSStats();
    
    res.json({
      success: true,
      vps: {
        enabled: vpsTranscodingService.isEnabled(),
        ...stats
      }
    });
  } catch (error: any) {
    console.error('Error obteniendo estado del VPS:', error);
    res.status(500).json({
      success: false,
      error: 'Error consultando estado del VPS',
      details: error.message
    });
  }
});

/**
 * GET /api/vps/health
 * Verifica la salud del VPS
 */
router.get('/health', requireAuth, async (req: any, res) => {
  try {
    if (!vpsTranscodingService.isEnabled()) {
      return res.json({
        success: true,
        healthy: false,
        enabled: false,
        message: 'VPS no está habilitado'
      });
    }

    const isHealthy = await vpsTranscodingService.checkVPSHealth();
    
    res.json({
      success: true,
      healthy: isHealthy,
      enabled: true,
      message: isHealthy ? 'VPS funcionando correctamente' : 'VPS no responde'
    });
  } catch (error: any) {
    console.error('Error verificando salud del VPS:', error);
    res.status(500).json({
      success: false,
      healthy: false,
      error: 'Error verificando VPS',
      details: error.message
    });
  }
});

/**
 * GET /api/vps/job/:jobId/status
 * Consulta el estado de un trabajo específico
 */
router.get('/job/:jobId/status', requireAuth, async (req: any, res) => {
  try {
    const { jobId } = req.params;
    
    if (!vpsTranscodingService.isEnabled()) {
      return res.status(400).json({
        success: false,
        error: 'VPS no está habilitado'
      });
    }

    const status = await vpsTranscodingService.getJobStatus(jobId);
    
    res.json({
      success: true,
      jobId,
      status
    });
  } catch (error: any) {
    console.error('Error consultando estado del trabajo:', error);
    res.status(500).json({
      success: false,
      error: 'Error consultando estado del trabajo',
      details: error.message
    });
  }
});

/**
 * DELETE /api/vps/job/:jobId
 * Cancela un trabajo en el VPS
 */
router.delete('/job/:jobId', requireAuth, async (req: any, res) => {
  try {
    const { jobId } = req.params;
    
    if (!vpsTranscodingService.isEnabled()) {
      return res.status(400).json({
        success: false,
        error: 'VPS no está habilitado'
      });
    }

    const cancelled = await vpsTranscodingService.cancelJob(jobId);
    
    res.json({
      success: true,
      jobId,
      cancelled,
      message: cancelled ? 'Trabajo cancelado exitosamente' : 'No se pudo cancelar el trabajo'
    });
  } catch (error: any) {
    console.error('Error cancelando trabajo:', error);
    res.status(500).json({
      success: false,
      error: 'Error cancelando trabajo',
      details: error.message
    });
  }
});

export default router;
