import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class WebSocketService {
  private io: SocketIOServer;
  private userSockets: Map<string, string> = new Map(); // userId -> socketId

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`Cliente conectado: ${socket.id}`);

      // Autenticar usuario
      socket.on('authenticate', async (data: { userId: string }) => {
        try {
          const { userId } = data;
          
          // Verificar que el usuario existe
          const user = await prisma.user.findUnique({
            where: { id: userId }
          });

          if (user) {
            this.userSockets.set(userId, socket.id);
            socket.join(`user:${userId}`);
            socket.emit('authenticated', { success: true });
            console.log(`Usuario autenticado: ${userId}`);
          } else {
            socket.emit('authentication_error', { message: 'Usuario no encontrado' });
          }
        } catch (error) {
          console.error('Error en autenticación:', error);
          socket.emit('authentication_error', { message: 'Error de autenticación' });
        }
      });

      // Suscribirse a actualizaciones de trabajo específico
      socket.on('subscribe_job', (data: { jobId: string }) => {
        socket.join(`job:${data.jobId}`);
        console.log(`Cliente suscrito al trabajo: ${data.jobId}`);
      });

      // Desconexión
      socket.on('disconnect', () => {
        // Remover usuario de la lista de sockets activos
        for (const [userId, socketId] of this.userSockets.entries()) {
          if (socketId === socket.id) {
            this.userSockets.delete(userId);
            break;
          }
        }
        console.log(`Cliente desconectado: ${socket.id}`);
      });
    });
  }

  // Notificar progreso de trabajo a usuario específico
  public notifyJobProgress(userId: string, jobId: string, progress: number, status: string, message?: string) {
    const notification = {
      type: 'job_progress',
      jobId,
      progress,
      status,
      message,
      timestamp: new Date().toISOString()
    };

    // Enviar a usuario específico
    this.io.to(`user:${userId}`).emit('job_update', notification);
    
    // Enviar a suscriptores del trabajo específico
    this.io.to(`job:${jobId}`).emit('job_update', notification);

    console.log(`Notificación enviada - Usuario: ${userId}, Trabajo: ${jobId}, Progreso: ${progress}%`);
  }

  // Notificar finalización de trabajo
  public notifyJobCompleted(userId: string, jobId: string, success: boolean, albumId?: string, error?: string) {
    const notification = {
      type: 'job_completed',
      jobId,
      success,
      albumId,
      error,
      timestamp: new Date().toISOString()
    };

    this.io.to(`user:${userId}`).emit('job_completed', notification);
    this.io.to(`job:${jobId}`).emit('job_completed', notification);

    console.log(`Trabajo finalizado - Usuario: ${userId}, Trabajo: ${jobId}, Éxito: ${success}`);
  }

  // Notificar error de trabajo
  public notifyJobError(userId: string, jobId: string, error: string, stage?: string) {
    const notification = {
      type: 'job_error',
      jobId,
      error,
      stage,
      timestamp: new Date().toISOString()
    };

    this.io.to(`user:${userId}`).emit('job_error', notification);
    this.io.to(`job:${jobId}`).emit('job_error', notification);

    console.log(`Error en trabajo - Usuario: ${userId}, Trabajo: ${jobId}, Error: ${error}`);
  }

  // Notificar inicio de trabajo
  public notifyJobStarted(userId: string, jobId: string, albumTitle: string) {
    const notification = {
      type: 'job_started',
      jobId,
      albumTitle,
      timestamp: new Date().toISOString()
    };

    this.io.to(`user:${userId}`).emit('job_started', notification);
    this.io.to(`job:${jobId}`).emit('job_started', notification);

    console.log(`Trabajo iniciado - Usuario: ${userId}, Trabajo: ${jobId}, Álbum: ${albumTitle}`);
  }

  // Obtener estadísticas de conexiones
  public getConnectionStats() {
    return {
      totalConnections: this.io.sockets.sockets.size,
      authenticatedUsers: this.userSockets.size,
      rooms: Array.from(this.io.sockets.adapter.rooms.keys())
    };
  }

  // Enviar notificación general a usuario
  public notifyUser(userId: string, type: string, data: any) {
    const notification = {
      type,
      data,
      timestamp: new Date().toISOString()
    };

    this.io.to(`user:${userId}`).emit('notification', notification);
  }

  // Broadcast a todos los usuarios conectados
  public broadcast(type: string, data: any) {
    const notification = {
      type,
      data,
      timestamp: new Date().toISOString()
    };

    this.io.emit('broadcast', notification);
  }
}

// Instancia singleton del servicio WebSocket
let webSocketService: WebSocketService | null = null;

export function initializeWebSocketService(httpServer: HTTPServer): WebSocketService {
  if (!webSocketService) {
    webSocketService = new WebSocketService(httpServer);
  }
  return webSocketService;
}

export function getWebSocketService(): WebSocketService | null {
  return webSocketService;
}
