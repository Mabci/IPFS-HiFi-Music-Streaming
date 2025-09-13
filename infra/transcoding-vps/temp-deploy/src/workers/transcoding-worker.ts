import 'dotenv/config';
import Bull from 'bull';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

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
  
  try {
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
    // Aquí iría la integración real con IPFS
    // Por ahora simulamos el upload
    const fileStats = await fs.stat(filePath);
    const fileName = path.basename(filePath);
    
    // Simular CID basado en archivo
    const hash = require('crypto').createHash('sha256');
    hash.update(fileName + fileStats.size);
    const cid = `Qm${hash.digest('hex').substring(0, 44)}`;
    
    console.log(`[IPFS] Subido ${fileName} -> ${cid}`);
    return cid;
  } catch (error) {
    throw new Error(`Error subiendo archivo a IPFS: ${error.message}`);
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
      title: albumData.title,
      description: albumData.description,
      year: albumData.year,
      genre: albumData.genre,
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

// Función para notificar al backend
async function notifyBackend(event: string, data: any) {
  try {
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
  } catch (error) {
    console.error('Error notificando al backend:', error.message);
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
