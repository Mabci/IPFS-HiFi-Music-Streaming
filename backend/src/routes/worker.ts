import express from 'express';
import { PrismaClient } from '@prisma/client';
import { getWebSocketService } from '../services/websocket-service.js';

const router = express.Router();
const prisma = new PrismaClient();

// Middleware de autenticación para workers
const requireWorkerAuth = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  const expectedToken = `Bearer ${process.env.WORKER_API_KEY}`;
  
  if (!authHeader || authHeader !== expectedToken) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  
  next();
};

// POST /api/worker/notify - Recibir notificaciones del worker
router.post('/notify', requireWorkerAuth, async (req: any, res) => {
  try {
    const { event, data } = req.body;
    const wsService = getWebSocketService();
    
    if (!wsService) {
      console.error('WebSocket service no disponible');
      return res.status(500).json({ error: 'WebSocket service no disponible' });
    }
    
    switch (event) {
      case 'job_started':
        wsService.notifyJobStarted(data.userId, data.jobId, data.albumTitle);
        break;
        
      case 'job_progress':
        wsService.notifyJobProgress(data.userId, data.jobId, data.progress, 'processing', data.message);
        break;
        
      case 'job_completed':
        if (data.success) {
          // Actualizar estado en base de datos
          await prisma.processingJob.update({
            where: { jobId: data.jobId },
            data: {
              status: 'completed',
              completedAt: new Date()
            }
          });
          
          wsService.notifyJobCompleted(data.userId, data.jobId, true, data.albumId);
        } else {
          // Actualizar estado de error
          await prisma.processingJob.update({
            where: { jobId: data.jobId },
            data: {
              status: 'failed',
              errorMessage: data.error,
              completedAt: new Date()
            }
          });
          
          wsService.notifyJobCompleted(data.userId, data.jobId, false, undefined, data.error);
        }
        break;
        
      case 'job_error':
        wsService.notifyJobError(data.userId, data.jobId, data.error, data.stage);
        break;
        
      default:
        console.warn(`Evento desconocido del worker: ${event}`);
    }
    
    res.json({ success: true, message: 'Notificación procesada' });
    
  } catch (error) {
    console.error('Error procesando notificación del worker:', error);
    res.status(500).json({ 
      error: 'Error procesando notificación',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// GET /api/worker/health - Health check para workers
router.get('/health', requireWorkerAuth, (req, res) => {
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    message: 'Worker API funcionando correctamente'
  });
});

export default router;
