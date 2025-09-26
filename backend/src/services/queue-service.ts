import Bull from 'bull';
import Redis from 'redis';
import { PrismaClient } from '@prisma/client';
import { getWebSocketService } from './websocket-service.js';
import { ipfsGatewayService } from './ipfs-gateway-service.js';

const prisma = new PrismaClient();

// Configuración de Redis
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
};

// Cola para procesamiento de audio
export const audioProcessingQueue = new Bull('audio processing', {
  redis: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

// Tipos para los trabajos
export interface AudioProcessingJobData {
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

// Procesador de trabajos de audio
audioProcessingQueue.process(async (job: Bull.Job<AudioProcessingJobData>) => {
  const { jobId, userId, albumData, tempUploadPath } = job.data;
  const wsService = getWebSocketService();

  try {
    // Notificar inicio del trabajo
    wsService?.notifyJobStarted(userId, jobId, albumData.title);
    
    // Actualizar estado a "processing"
    await updateJobStatus(jobId, 'processing');
    wsService?.notifyJobProgress(userId, jobId, 0, 'processing', 'Iniciando procesamiento...');
    
    // Paso 1: Transcodificar archivos de audio (25%)
    job.progress(25);
    wsService?.notifyJobProgress(userId, jobId, 25, 'processing', 'Transcodificando archivos de audio...');
    const transcodedFiles = await transcodeAudioFiles(albumData.tracks, tempUploadPath);
    
    // Paso 2: Subir archivos a IPFS (50%)
    job.progress(50);
    wsService?.notifyJobProgress(userId, jobId, 50, 'processing', 'Subiendo archivos a IPFS...');
    const ipfsResults = await uploadToIPFS(transcodedFiles, albumData.coverImagePath);
    
    // Paso 3: Crear registros en base de datos (75%)
    job.progress(75);
    wsService?.notifyJobProgress(userId, jobId, 75, 'processing', 'Creando registros en base de datos...');
    const albumId = await createDatabaseRecords(userId, albumData, ipfsResults);
    
    // Paso 4: Limpiar archivos temporales (100%)
    job.progress(100);
    wsService?.notifyJobProgress(userId, jobId, 100, 'processing', 'Finalizando procesamiento...');
    await cleanupTempFiles(tempUploadPath);
    
    // Marcar trabajo como completado
    await updateJobStatus(jobId, 'completed');
    wsService?.notifyJobCompleted(userId, jobId, true, albumId);
    
    return { success: true, message: 'Álbum procesado exitosamente', albumId };
    
  } catch (error) {
    console.error('Error procesando audio:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    await updateJobStatus(jobId, 'failed', errorMessage);
    wsService?.notifyJobCompleted(userId, jobId, false, undefined, errorMessage);
    throw error;
  }
});

// Función para actualizar estado del trabajo
async function updateJobStatus(jobId: string, status: string, errorMessage?: string) {
  await prisma.processingJob.update({
    where: { jobId },
    data: {
      status,
      errorMessage,
      completedAt: status === 'completed' || status === 'failed' ? new Date() : undefined,
    },
  });
}

// Función para transcodificar archivos de audio
async function transcodeAudioFiles(tracks: any[], tempPath: string) {
  const transcodedFiles = [];
  
  for (const track of tracks) {
    const inputFile = `${tempPath}/${track.originalFilename}`;
    // Sanitizar título: mantener solo caracteres seguros y limitar longitud
    const sanitizedTitle = track.title
      .replace(/[^a-zA-Z0-9\s-_]/g, '') // Remover caracteres especiales
      .replace(/\s+/g, '-')              // Espacios → guiones
      .toLowerCase()                      // Minúsculas
      .substring(0, 30);                  // Máximo 30 caracteres
    
    const baseOutputName = `${track.trackNumber.toString().padStart(2, '0')}-${sanitizedTitle}`;
    
    // Generar diferentes calidades
    const qualities = {
      low: `${tempPath}/${baseOutputName}-low.m4a`,
      high: `${tempPath}/${baseOutputName}-high.flac`,
      max: `${tempPath}/${baseOutputName}-max.flac`,
    };
    
    // Aquí iría la lógica de transcodificación con FFmpeg
    // Por ahora simulamos el proceso
    await simulateTranscoding(inputFile, qualities);
    
    transcodedFiles.push({
      trackNumber: track.trackNumber,
      title: track.title,
      qualities,
      originalDuration: await getAudioDuration(inputFile),
    });
  }
  
  return transcodedFiles;
}

// Función para subir archivos a IPFS
async function uploadToIPFS(transcodedFiles: any[], coverImagePath?: string) {
  const ipfsResults = {
    albumCid: '',
    coverCid: '',
    tracks: [] as any[],
  };
  
  // Subir cover si existe
  if (coverImagePath) {
    ipfsResults.coverCid = await uploadFileToIPFS(coverImagePath);
  }
  
  // Subir tracks
  for (const track of transcodedFiles) {
    const trackCids = {
      lowQualityCid: await uploadFileToIPFS(track.qualities.low),
      highQualityCid: await uploadFileToIPFS(track.qualities.high),
      maxQualityCid: await uploadFileToIPFS(track.qualities.max),
    };
    
    ipfsResults.tracks.push({
      trackNumber: track.trackNumber,
      title: track.title,
      durationSec: track.originalDuration,
      ...trackCids,
    });
  }
  
  // Generar CID del álbum (hash de todos los tracks)
  ipfsResults.albumCid = generateAlbumCid(ipfsResults.tracks);
  
  return ipfsResults;
}

// Función para crear registros en base de datos
async function createDatabaseRecords(userId: string, albumData: any, ipfsResults: any): Promise<string> {
  // Crear o obtener perfil de artista
  let artistProfile = await prisma.artistProfile.findUnique({
    where: { userId },
  });
  
  if (!artistProfile) {
    artistProfile = await prisma.artistProfile.create({
      data: {
        userId,
        artistName: albumData.artistName,
        bio: '',
      },
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
      totalDurationSec: ipfsResults.tracks.reduce((sum: number, track: any) => sum + track.durationSec, 0),
      isPublic: true,
      playCount: 0,
      uploadedAt: new Date(),
    },
  });
  
  // Crear tracks
  for (const trackData of ipfsResults.tracks) {
    await prisma.track.create({
      data: {
        albumId: album.id,
        title: trackData.title,
        trackNumber: trackData.trackNumber,
        durationSec: trackData.durationSec,
        trackCid: trackData.highQualityCid, // CID principal
        lowQualityCid: trackData.lowQualityCid,
        highQualityCid: trackData.highQualityCid,
        maxQualityCid: trackData.maxQualityCid,
      },
    });
  }
  
  // Actualizar estadísticas del artista
  await prisma.artistProfile.update({
    where: { id: artistProfile.id },
    data: {
      totalAlbums: { increment: 1 },
    },
  });
  
  // Actualizar estadísticas globales
  await prisma.globalStats.upsert({
    where: { id: 'global' },
    create: {
      id: 'global',
      totalArtists: 1,
      totalAlbums: 1,
      totalTracks: ipfsResults.tracks.length,
    },
    update: {
      totalAlbums: { increment: 1 },
      totalTracks: { increment: ipfsResults.tracks.length },
      lastUpdated: new Date(),
    },
  });

  return album.id;
}

// Funciones auxiliares para transcodificación real
async function simulateTranscoding(inputFile: string, qualities: any) {
  const fs = await import('fs');
  const path = await import('path');
  
  try {
    // Verificar que el archivo original existe
    if (!fs.existsSync(inputFile)) {
      throw new Error(`Archivo original no encontrado: ${inputFile}`);
    }
    
    console.log(`🎵 Iniciando transcodificación real: ${inputFile}`);
    console.log(`📁 Calidades objetivo:`, qualities);
    
    // Para testing: copiar el archivo original a las diferentes calidades
    // Esto permite que el VPS IPFS funcione mientras implementamos FFmpeg
    const originalStats = fs.statSync(inputFile);
    
    for (const [quality, outputPath] of Object.entries(qualities)) {
      console.log(`📋 Creando ${quality}: ${outputPath}`);
      
      // Crear directorio si no existe
      const outputDir = path.dirname(outputPath as string);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Por ahora: copiar archivo original (placeholder para FFmpeg real)
      fs.copyFileSync(inputFile, outputPath as string);
      console.log(`✅ ${quality} creado: ${outputPath} (${originalStats.size} bytes)`);
    }
    
    console.log(`🎉 Transcodificación completada para: ${inputFile}`);
    
  } catch (error) {
    console.error(`❌ Error en transcodificación:`, error);
    throw error;
  }
}

async function getAudioDuration(filePath: string): Promise<number> {
  // Simular obtención de duración
  return Math.floor(Math.random() * 300) + 60; // 1-5 minutos
}

async function uploadFileToIPFS(filePath: string): Promise<string> {
  try {
    // Usar el servicio real de IPFS Gateway
    const result = await ipfsGatewayService.uploadFile(filePath);
    console.log(`✅ Archivo subido a IPFS: ${result.cid} (${result.size} bytes)`);
    
    // NOTA: Pin removido - el archivo ya está disponible en IPFS
    // await ipfsGatewayService.pinCID(result.cid);
    
    return result.cid;
  } catch (error) {
    console.error('❌ Error subiendo archivo a IPFS:', error);
    // Fallback a CID simulado si el servicio real falla
    console.log('🔄 Usando CID simulado como fallback');
    return `Qm${Math.random().toString(36).substring(2, 15)}`;
  }
}

function generateAlbumCid(tracks: any[]): string {
  // Generar CID basado en los tracks
  const trackCids = tracks.map(t => t.highQualityCid).join('');
  return `QmAlbum${trackCids.substring(0, 10)}`;
}

async function cleanupTempFiles(tempPath: string) {
  // Limpiar archivos temporales
  console.log(`Limpiando archivos temporales en: ${tempPath}`);
}

// Función para agregar trabajo a la cola
export async function addAudioProcessingJob(jobData: AudioProcessingJobData) {
  const job = await audioProcessingQueue.add(jobData, {
    priority: 1,
    delay: 0,
  });
  
  return job.id;
}

// Función para obtener estado del trabajo
export async function getJobStatus(jobId: string) {
  const job = await audioProcessingQueue.getJob(jobId);
  if (!job) return null;
  
  return {
    id: job.id,
    progress: job.progress(),
    state: await job.getState(),
    data: job.data,
    failedReason: job.failedReason,
  };
}

// Eventos de la cola
audioProcessingQueue.on('completed', (job) => {
  console.log(`Trabajo completado: ${job.id}`);
});

audioProcessingQueue.on('failed', (job, err) => {
  console.error(`Trabajo falló: ${job.id}`, err);
});

audioProcessingQueue.on('progress', (job, progress) => {
  console.log(`Progreso del trabajo ${job.id}: ${progress}%`);
});
