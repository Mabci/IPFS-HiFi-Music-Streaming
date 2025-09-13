import { Worker } from 'bullmq';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';

const execAsync = promisify(exec);

// Configuración Redis
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
};

// Configuración del worker
const WORKER_API_KEY = process.env.WORKER_API_KEY || 'worker-secret-key';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

console.log('🚀 Iniciando Worker de Transcodificación...');
console.log('📡 Redis:', `${redisConfig.host}:${redisConfig.port}`);
console.log('🔗 Backend:', BACKEND_URL);

// Worker de transcodificación
const transcodingWorker = new Worker('transcoding', async (job) => {
  console.log(`[${job.id}] 🎵 Procesando trabajo de transcodificación...`);
  
  try {
    const { userId, albumData, files } = job.data;
    
    // Actualizar progreso
    await job.updateProgress(10);
    await notifyBackend('processing.started', { jobId: job.id, userId });
    
    // Crear directorio de trabajo
    const workDir = `/tmp/transcoding-${job.id}`;
    await fs.promises.mkdir(workDir, { recursive: true });
    
    console.log(`[${job.id}] 📁 Directorio de trabajo: ${workDir}`);
    
    // Procesar cada archivo
    const processedTracks = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`[${job.id}] 🎧 Procesando track ${i + 1}/${files.length}: ${file.originalName}`);
      
      const trackResult = await processAudioFile(file, workDir, job);
      processedTracks.push({
        ...trackResult,
        trackNumber: i + 1,
        title: file.metadata?.title || path.parse(file.originalName).name,
        artist: file.metadata?.artist || albumData.artist,
        duration: file.metadata?.duration || 0
      });
      
      // Actualizar progreso
      const progress = 10 + (i + 1) / files.length * 70;
      await job.updateProgress(progress);
    }
    
    // Simular subida a IPFS y creación de álbum
    await job.updateProgress(85);
    const albumCid = await createAlbumStructure(processedTracks, albumData, workDir);
    
    // Simular creación en base de datos
    await job.updateProgress(95);
    const albumId = await simulateCreateAlbum(userId, albumData, processedTracks, albumCid);
    
    // Limpiar archivos temporales
    await fs.promises.rm(workDir, { recursive: true, force: true });
    
    await job.updateProgress(100);
    await notifyBackend('processing.completed', { 
      jobId: job.id, 
      userId, 
      albumId, 
      albumCid 
    });
    
    console.log(`[${job.id}] ✅ Procesamiento completado - Álbum: ${albumId}`);
    
    return {
      success: true,
      albumId,
      albumCid,
      tracks: processedTracks.length
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${job.id}] ❌ Error en procesamiento:`, errorMessage);
    
    await notifyBackend('processing.failed', { 
      jobId: job.id, 
      error: errorMessage 
    });
    
    throw error;
  }
}, {
  connection: redisConfig,
  concurrency: 2, // Procesar máximo 2 trabajos simultáneamente
});

// Función para procesar un archivo de audio
async function processAudioFile(file: any, workDir: string, job: any): Promise<any> {
  const inputPath = file.tempPath;
  const baseName = sanitizeFilename(path.parse(file.originalName).name);
  
  // Rutas de salida
  const lowQualityPath = path.join(workDir, `${baseName}-low.m4a`);
  const highQualityPath = path.join(workDir, `${baseName}-high.flac`);
  const maxQualityPath = path.join(workDir, `${baseName}-max.flac`);
  
  console.log(`[${job.id}] 🔄 Transcodificando: ${file.originalName}`);
  
  // Transcodificar a diferentes calidades
  await Promise.all([
    // Calidad baja (128k M4A)
    execAsync(`ffmpeg -i "${inputPath}" -c:a aac -b:a 128k -y "${lowQualityPath}"`),
    
    // Calidad alta (FLAC comprimido)
    execAsync(`ffmpeg -i "${inputPath}" -c:a flac -compression_level 5 -y "${highQualityPath}"`),
    
    // Calidad máxima (FLAC sin compresión)
    execAsync(`ffmpeg -i "${inputPath}" -c:a flac -compression_level 0 -y "${maxQualityPath}"`)
  ]);
  
  // Simular subida a IPFS
  const lowCid = await simulateIPFSUpload(lowQualityPath);
  const highCid = await simulateIPFSUpload(highQualityPath);
  const maxCid = await simulateIPFSUpload(maxQualityPath);
  
  console.log(`[${job.id}] 📦 CIDs generados:`, { lowCid, highCid, maxCid });
  
  return {
    lowQualityCid: lowCid,
    highQualityCid: highCid,
    maxQualityCid: maxCid,
    originalName: file.originalName
  };
}

// Simular subida a IPFS
async function simulateIPFSUpload(filePath: string): Promise<string> {
  const stats = await fs.promises.stat(filePath);
  const fileName = path.basename(filePath);
  
  // Generar CID simulado basado en archivo
  const hash = require('crypto').createHash('sha256');
  hash.update(fileName + stats.size + Date.now());
  const cid = `Qm${hash.digest('hex').substring(0, 44)}`;
  
  console.log(`[IPFS] Simulado: ${fileName} -> ${cid}`);
  return cid;
}

// Crear estructura de álbum
async function createAlbumStructure(tracks: any[], albumData: any, workDir: string): Promise<string> {
  // Simular creación de estructura de álbum en IPFS
  const albumHash = require('crypto').createHash('sha256');
  albumHash.update(JSON.stringify({ albumData, tracks }));
  const albumCid = `Qm${albumHash.digest('hex').substring(0, 44)}`;
  
  console.log(`[IPFS] Álbum creado: ${albumCid}`);
  return albumCid;
}

// Simular creación en base de datos
async function simulateCreateAlbum(userId: string, albumData: any, tracks: any[], albumCid: string): Promise<string> {
  // Generar ID de álbum simulado
  const albumId = `album_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  console.log(`[DB] Álbum simulado creado: ${albumId}`);
  console.log(`[DB] Usuario: ${userId}`);
  console.log(`[DB] Tracks: ${tracks.length}`);
  console.log(`[DB] CID: ${albumCid}`);
  
  return albumId;
}

// Notificar al backend
async function notifyBackend(event: string, data: any): Promise<void> {
  try {
    await axios.post(`${BACKEND_URL}/api/worker/notify`, {
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error notificando al backend:', errorMessage);
  }
}

// Función auxiliar para sanitizar nombres de archivo
function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9\-_]/g, '-').toLowerCase();
}

// Manejo de eventos del worker
transcodingWorker.on('completed', (job) => {
  console.log(`✅ Trabajo ${job.id} completado exitosamente`);
});

transcodingWorker.on('failed', (job, err) => {
  console.error(`❌ Trabajo ${job?.id} falló:`, err.message);
});

transcodingWorker.on('error', (err) => {
  console.error('❌ Error en el worker:', err);
});

// Manejo de cierre graceful
process.on('SIGINT', async () => {
  console.log('🛑 Cerrando worker...');
  await transcodingWorker.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Cerrando worker...');
  await transcodingWorker.close();
  process.exit(0);
});

console.log('✅ Worker de transcodificación iniciado y esperando trabajos...');
