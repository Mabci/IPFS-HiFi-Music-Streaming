import 'dotenv/config';
import Bull from 'bull';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { vpsTranscodingService } from '../services/vps-transcoding-service.js';
import { ipfsGatewayService } from '../services/ipfs-gateway-service.js';
import { getWebSocketService } from '../services/websocket-service.js';

const prisma = new PrismaClient();

// Configuración de Redis (debe coincidir con el servidor principal)
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
};

// Cola de procesamiento de audio (misma que en el servidor principal)
const audioProcessingQueue = new Bull('audio processing', {
  redis: redisConfig,
});

// Configuración del worker
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '2');
const TEMP_WORK_DIR = process.env.TEMP_WORK_DIR || '/tmp/audio-processing';
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:4000';
const WORKER_API_KEY = process.env.WORKER_API_KEY || '';
const VPS_ENABLED = process.env.VPS_ENABLED === 'true';
const FALLBACK_TO_LOCAL = process.env.FALLBACK_TO_LOCAL !== 'false';

// Interfaz para los datos del trabajo
interface AudioProcessingJobData {
  jobId: string;
  userId: string;
  albumData: {
    title: string;
    description: string;
    year: number;
    genre: string;
    artistName: string;
    tracks: Array<{
      title: string;
      trackNumber: number;
      filePath: string;
      originalFilename: string;
    }>;
    coverImagePath?: string;
  };
  tempUploadPath: string;
}

// Procesador del worker de transcodificación
audioProcessingQueue.process(WORKER_CONCURRENCY, async (job: Bull.Job<AudioProcessingJobData>) => {
  const { jobId, userId, albumData, tempUploadPath } = job.data;
  
  console.log(`[Worker] Iniciando procesamiento del trabajo: ${jobId}`);
  console.log(`[Worker] VPS habilitado: ${VPS_ENABLED}`);
  
  try {
    // Intentar usar VPS si está habilitado
    if (VPS_ENABLED && vpsTranscodingService.isEnabled()) {
      console.log(`[Worker] Intentando procesar con VPS: ${jobId}`);
      const vpsResult = await processWithVPS(job.data);
      if (vpsResult.success) {
        console.log(`[Worker] Trabajo completado exitosamente con VPS: ${jobId}`);
        return vpsResult;
      } else if (!FALLBACK_TO_LOCAL) {
        throw new Error(`VPS falló y fallback está deshabilitado: ${vpsResult.message}`);
      }
      console.log(`[Worker] VPS falló, usando procesamiento local: ${vpsResult.message}`);
    }
    
    // Procesamiento local (código original)
    console.log(`[Worker] Procesando localmente: ${jobId}`);
    // Crear directorio de trabajo temporal
    const workDir = path.join(TEMP_WORK_DIR, jobId);
    await fs.mkdir(workDir, { recursive: true });
    
    // Notificar inicio al backend
    await notifyBackend('job_started', { jobId, userId, albumTitle: albumData.title });
    
    // Paso 1: Descargar archivos desde el servidor principal
    job.progress(10);
    await notifyBackend('job_progress', { jobId, userId, progress: 10, message: 'Descargando archivos...' });
    const downloadedFiles = await downloadFiles(albumData.tracks, tempUploadPath, workDir);
    
    // Paso 2: Transcodificar archivos de audio
    job.progress(25);
    await notifyBackend('job_progress', { jobId, userId, progress: 25, message: 'Transcodificando archivos de audio...' });
    const transcodedFiles = await transcodeAudioFiles(downloadedFiles, workDir);
    
    // Paso 3: Subir archivos a IPFS
    job.progress(60);
    await notifyBackend('job_progress', { jobId, userId, progress: 60, message: 'Subiendo archivos a IPFS...' });
    const ipfsResults = await uploadToIPFS(transcodedFiles, albumData.coverImagePath, workDir);
    
    // Paso 4: Crear registros en base de datos
    job.progress(85);
    await notifyBackend('job_progress', { jobId, userId, progress: 85, message: 'Creando registros en base de datos...' });
    const albumId = await createDatabaseRecords(userId, albumData, ipfsResults);
    
    // Paso 5: Limpiar archivos temporales
    job.progress(100);
    await notifyBackend('job_progress', { jobId, userId, progress: 100, message: 'Finalizando procesamiento...' });
    await cleanupWorkDir(workDir);
    
    // Notificar finalización exitosa
    await notifyBackend('job_completed', { jobId, userId, success: true, albumId });
    
    console.log(`[Worker] Trabajo completado exitosamente: ${jobId}`);
    return { success: true, albumId };
    
  } catch (error) {
    console.error(`[Worker] Error procesando trabajo ${jobId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    // Notificar error al backend
    await notifyBackend('job_completed', { jobId, userId, success: false, error: errorMessage });
    
    throw error;
  }
});

// Función para procesar con VPS de transcodificación
async function processWithVPS(jobData: AudioProcessingJobData): Promise<any> {
  const { jobId, userId, albumData } = jobData;
  
  try {
    // Verificar salud del VPS
    const isHealthy = await vpsTranscodingService.checkVPSHealth();
    if (!isHealthy) {
      return { success: false, message: 'VPS no está disponible o no responde' };
    }
    
    // Notificar inicio al backend
    await notifyBackend('job_started', { jobId, userId, albumTitle: albumData.title });
    await notifyBackend('job_progress', { jobId, userId, progress: 5, message: 'Enviando trabajo al VPS...' });
    
    // Enviar trabajo al VPS
    const vpsResponse = await vpsTranscodingService.submitTranscodingJob(jobData);
    
    if (!vpsResponse.success) {
      return { success: false, message: `Error del VPS: ${vpsResponse.message}` };
    }
    
    // Monitorear progreso del trabajo en el VPS
    let completed = false;
    let progress = 10;
    let attempts = 0;
    const maxAttempts = 120; // 10 minutos máximo
    
    while (!completed && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Esperar 5 segundos
      attempts++;
      
      try {
        const status = await vpsTranscodingService.getJobStatus(jobId);
        
        if (status.completed) {
          completed = true;
          
          if (status.success) {
            // Notificar finalización exitosa
            await notifyBackend('job_completed', { 
              jobId, 
              userId, 
              success: true, 
              albumId: status.albumId,
              vpsProcessed: true 
            });
            
            return { 
              success: true, 
              albumId: status.albumId,
              message: 'Procesado exitosamente por VPS'
            };
          } else {
            return { 
              success: false, 
              message: `Error en VPS: ${status.error || 'Error desconocido'}` 
            };
          }
        } else {
          // Actualizar progreso
          const newProgress = Math.min(progress + 2, 95);
          if (newProgress > progress) {
            progress = newProgress;
            await notifyBackend('job_progress', { 
              jobId, 
              userId, 
              progress, 
              message: status.message || 'Procesando en VPS...' 
            });
          }
        }
      } catch (error) {
        console.error(`Error consultando estado del VPS (intento ${attempts}):`, error);
        
        // Si fallan muchos intentos consecutivos, abortar
        if (attempts > 10) {
          return { 
            success: false, 
            message: 'Perdida comunicación con VPS durante procesamiento' 
          };
        }
      }
    }
    
    // Timeout
    if (!completed) {
      await vpsTranscodingService.cancelJob(jobId);
      return { 
        success: false, 
        message: 'Timeout procesando en VPS (10 minutos)' 
      };
    }
    
  } catch (error: any) {
    console.error('Error procesando con VPS:', error);
    return { 
      success: false, 
      message: error.message || 'Error desconocido procesando con VPS' 
    };
  }
  
  return { success: false, message: 'Error inesperado' };
}

// Función para descargar archivos desde el servidor principal
async function downloadFiles(tracks: any[], sourcePath: string, workDir: string) {
  const downloadedFiles = [];
  
  for (const track of tracks) {
    const sourceFile = path.join(sourcePath, track.originalFilename);
    const destFile = path.join(workDir, 'input', track.originalFilename);
    
    // Crear directorio de entrada
    await fs.mkdir(path.dirname(destFile), { recursive: true });
    
    try {
      // En un entorno real, esto sería una descarga HTTP/SFTP desde el servidor principal
      // Por ahora simulamos copiando el archivo (asumiendo acceso compartido)
      await fs.copyFile(sourceFile, destFile);
      
      downloadedFiles.push({
        ...track,
        localPath: destFile,
        duration: await getAudioDuration(destFile)
      });
    } catch (error) {
      console.error(`Error descargando archivo ${track.originalFilename}:`, error);
      throw new Error(`No se pudo descargar el archivo: ${track.originalFilename}`);
    }
  }
  
  return downloadedFiles;
}

// Función para transcodificar archivos de audio usando FFmpeg
async function transcodeAudioFiles(files: any[], workDir: string) {
  const transcodedFiles = [];
  const outputDir = path.join(workDir, 'output');
  await fs.mkdir(outputDir, { recursive: true });
  
  for (const file of files) {
    const baseOutputName = `${file.trackNumber.toString().padStart(2, '0')}-${sanitizeFilename(file.title)}`;
    
    const qualities = {
      low: path.join(outputDir, `${baseOutputName}-low.m4a`),
      high: path.join(outputDir, `${baseOutputName}-high.flac`),
      max: path.join(outputDir, `${baseOutputName}-max.flac`)
    };
    
    // Transcodificar a calidad baja (M4A 128kbps)
    await runFFmpeg(file.localPath, qualities.low, [
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '44100',
      '-ac', '2'
    ]);
    
    // Transcodificar a calidad alta (FLAC 16-bit)
    await runFFmpeg(file.localPath, qualities.high, [
      '-c:a', 'flac',
      '-sample_fmt', 's16',
      '-ar', '44100',
      '-ac', '2'
    ]);
    
    // Transcodificar a calidad máxima (FLAC 24-bit)
    await runFFmpeg(file.localPath, qualities.max, [
      '-c:a', 'flac',
      '-sample_fmt', 's32',
      '-ar', '96000',
      '-ac', '2'
    ]);
    
    transcodedFiles.push({
      trackNumber: file.trackNumber,
      title: file.title,
      duration: file.duration,
      qualities
    });
  }
  
  return transcodedFiles;
}

// Función para ejecutar FFmpeg
async function runFFmpeg(inputPath: string, outputPath: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpegArgs = ['-i', inputPath, ...args, '-y', outputPath];
    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    
    let stderr = '';
    
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg falló con código ${code}: ${stderr}`));
      }
    });
    
    ffmpeg.on('error', (error) => {
      reject(new Error(`Error ejecutando FFmpeg: ${error.message}`));
    });
  });
}

// Función para obtener duración del audio usando FFprobe
async function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'quiet',
      '-show_entries', 'format=duration',
      '-of', 'csv=p=0',
      filePath
    ]);
    
    let stdout = '';
    
    ffprobe.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    ffprobe.on('close', (code) => {
      if (code === 0) {
        const duration = parseFloat(stdout.trim());
        resolve(Math.floor(duration));
      } else {
        reject(new Error(`FFprobe falló con código ${code}`));
      }
    });
    
    ffprobe.on('error', (error) => {
      reject(new Error(`Error ejecutando FFprobe: ${error.message}`));
    });
  });
}

// Función para subir archivos a IPFS
async function uploadToIPFS(transcodedFiles: any[], coverImagePath?: string, workDir?: string) {
  const ipfsResults = {
    albumCid: '',
    coverCid: '',
    tracks: [] as any[]
  };
  
  // Subir cover si existe
  if (coverImagePath && workDir) {
    const coverFile = path.join(workDir, 'cover.jpg');
    try {
      await fs.copyFile(coverImagePath, coverFile);
      ipfsResults.coverCid = await uploadFileToIPFS(coverFile);
    } catch (error) {
      console.warn('Error subiendo cover:', error);
    }
  }
  
  // Subir tracks
  for (const track of transcodedFiles) {
    const trackCids = {
      lowQualityCid: await uploadFileToIPFS(track.qualities.low),
      highQualityCid: await uploadFileToIPFS(track.qualities.high),
      maxQualityCid: await uploadFileToIPFS(track.qualities.max)
    };
    
    ipfsResults.tracks.push({
      trackNumber: track.trackNumber,
      title: track.title,
      durationSec: track.duration,
      ...trackCids
    });
  }
  
  // Generar CID del álbum
  ipfsResults.albumCid = generateAlbumCid(ipfsResults.tracks);
  
  return ipfsResults;
}

// Función para subir archivo individual a IPFS
async function uploadFileToIPFS(filePath: string): Promise<string> {
  try {
    // Usar gateway IPFS privada si está habilitada
    if (ipfsGatewayService.isEnabled()) {
      const result = await ipfsGatewayService.uploadFile(filePath);
      
      // Fijar el CID para asegurar disponibilidad
      const pinResult = await ipfsGatewayService.pinCID(result.cid);
      if (!pinResult.success) {
        console.warn(`[IPFS] Advertencia fijando CID ${result.cid}: ${pinResult.message}`);
      }
      
      console.log(`[IPFS] Subido ${result.name} -> ${result.cid} (${result.size} bytes)`);
      return result.cid;
    } else {
      // Fallback: simular upload para desarrollo
      const fileStats = await fs.stat(filePath);
      const fileName = path.basename(filePath);
      
      const hash = require('crypto').createHash('sha256');
      hash.update(fileName + fileStats.size + Date.now());
      const cid = `Qm${hash.digest('hex').substring(0, 44)}`;
      
      console.log(`[IPFS] Simulado ${fileName} -> ${cid} (gateway privada deshabilitada)`);
      return cid;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Error subiendo archivo a IPFS: ${errorMessage}`);
  }
}

// Función para crear registros en base de datos
async function createDatabaseRecords(userId: string, albumData: any, ipfsResults: any): Promise<string> {
  // Crear o obtener perfil de artista
  let artistProfile = await prisma.artistProfile.findUnique({
    where: { userId }
  });
  
  if (!artistProfile) {
    artistProfile = await prisma.artistProfile.create({
      data: {
        userId,
        artistName: albumData.artistName,
        bio: ''
      }
    });
  }
  
  // Crear álbum
  const album = await prisma.album.create({
    data: {
      artistProfileId: artistProfile.id,
      artistId: artistProfile.id, // AGREGAR EL CAMPO FALTANTE
      title: albumData.title,
      description: albumData.description || '',
      year: albumData.year,
      genre: albumData.genre || 'Uncategorized',
      coverCid: ipfsResults.coverCid,
      albumCid: ipfsResults.albumCid,
      totalTracks: ipfsResults.tracks.length,
      totalDurationSec: ipfsResults.tracks.reduce((sum: number, track: any) => sum + track.durationSec, 0)
    }
  });
  
  // Crear tracks
  for (const trackData of ipfsResults.tracks) {
    await prisma.track.create({
      data: {
        albumId: album.id,
        title: trackData.title,
        trackNumber: trackData.trackNumber,
        durationSec: trackData.durationSec,
        trackCid: trackData.highQualityCid,
        lowQualityCid: trackData.lowQualityCid,
        highQualityCid: trackData.highQualityCid,
        maxQualityCid: trackData.maxQualityCid
      }
    });
  }
  
  // Actualizar estadísticas
  await prisma.artistProfile.update({
    where: { id: artistProfile.id },
    data: { totalAlbums: { increment: 1 } }
  });
  
  return album.id;
}

// Función para notificar al backend y WebSocket
async function notifyBackend(event: string, data: any) {
  try {
    // Notificar via HTTP al backend
    await axios.post(`${BACKEND_API_URL}/api/worker/notify`, {
      event,
      data
    }, {
      headers: {
        'Authorization': `Bearer ${WORKER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });

    // Notificar via WebSocket si está disponible
    const wsService = getWebSocketService();
    if (wsService && data.userId && data.jobId) {
      switch (event) {
        case 'job_started':
          wsService.notifyJobStarted(data.userId, data.jobId, data.albumTitle || 'Álbum sin título');
          break;
        case 'job_progress':
          wsService.notifyJobProgress(data.userId, data.jobId, data.progress, 'processing', data.message);
          break;
        case 'job_completed':
          if (data.success) {
            wsService.notifyJobCompleted(data.userId, data.jobId, true, data.albumId);
          } else {
            wsService.notifyJobError(data.userId, data.jobId, data.error || 'Error desconocido');
          }
          break;
        default:
          console.log(`Evento WebSocket no manejado: ${event}`);
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error notificando al backend:', errorMessage);
  }
}

// Funciones auxiliares
function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9\-_]/g, '-').toLowerCase();
}

function generateAlbumCid(tracks: any[]): string {
  const trackCids = tracks.map(t => t.highQualityCid).join('');
  const hash = require('crypto').createHash('sha256');
  hash.update(trackCids);
  return `QmAlbum${hash.digest('hex').substring(0, 40)}`;
}

async function cleanupWorkDir(workDir: string) {
  try {
    await fs.rm(workDir, { recursive: true, force: true });
    console.log(`[Worker] Directorio de trabajo limpiado: ${workDir}`);
  } catch (error) {
    console.error('Error limpiando directorio de trabajo:', error);
  }
}

// Eventos de la cola
audioProcessingQueue.on('completed', (job) => {
  console.log(`[Worker] Trabajo completado: ${job.id}`);
});

audioProcessingQueue.on('failed', (job, err) => {
  console.error(`[Worker] Trabajo falló: ${job.id}`, err);
});

audioProcessingQueue.on('progress', (job, progress) => {
  console.log(`[Worker] Progreso del trabajo ${job.id}: ${progress}%`);
});

// Manejo de señales para cierre limpio
process.on('SIGTERM', async () => {
  console.log('[Worker] Recibida señal SIGTERM, cerrando worker...');
  await audioProcessingQueue.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Worker] Recibida señal SIGINT, cerrando worker...');
  await audioProcessingQueue.close();
  await prisma.$disconnect();
  process.exit(0);
});

console.log(`[Worker] Worker de transcodificación iniciado con concurrencia: ${WORKER_CONCURRENCY}`);
console.log(`[Worker] Conectado a Redis: ${redisConfig.host}:${redisConfig.port}`);
console.log(`[Worker] Directorio de trabajo: ${TEMP_WORK_DIR}`);
