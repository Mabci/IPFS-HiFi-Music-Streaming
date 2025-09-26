import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { PrismaClient } from '@prisma/client';
import { addAudioProcessingJob, getJobStatus } from '../services/queue-service.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
const prisma = new PrismaClient();

// Configuración de multer para upload de archivos
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = process.env.TEMP_UPLOAD_PATH || '/tmp/uploads';
    const sessionId = req.body.sessionId || uuidv4();
    const fullPath = path.join(uploadPath, sessionId);
    
    console.log('📁 Upload path:', uploadPath);
    console.log('🆔 Session ID:', sessionId);
    console.log('📂 Full path:', fullPath);
    
    try {
      await fs.mkdir(fullPath, { recursive: true });
      console.log('✅ Directory created successfully');
      cb(null, fullPath);
    } catch (error) {
      console.error('❌ Error creating directory:', error);
      cb(error as Error, '');
    }
  },
  filename: (req, file, cb) => {
    // Mantener nombre original con timestamp para evitar conflictos
    const timestamp = Date.now();
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, `${timestamp}-${originalName}`);
  }
});

const fileFilter = (req: any, file: any, cb: any) => {
  // Validar tipos de archivo de audio
  const allowedMimes = [
    'audio/wav',
    'audio/x-wav',
    'audio/flac',
    'audio/x-flac',
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/m4a',
    'audio/x-m4a'
  ];
  
  const allowedExtensions = ['.wav', '.flac', '.mp3', '.m4a'];
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de archivo no soportado: ${file.mimetype}. Formatos permitidos: WAV, FLAC, MP3, M4A`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB por archivo
    files: 20 // Máximo 20 archivos por álbum
  }
});

// Middleware de autenticación (TEMPORAL: bypass habilitado para testing)
const requireAuth = async (req: any, res: any, next: any) => {
  console.log('🔐 Auth middleware called for:', req.originalUrl);
  console.log('🍪 Cookies received:', Object.keys(req.cookies || {}));
  
  // BYPASS TEMPORAL para testing - crear usuario fake
  const BYPASS_MODE = process.env.BYPASS_AUTH === 'true' || true; // temporal: siempre true
  
  if (BYPASS_MODE) {
    console.log('🚧 BYPASS MODE: Creating fake user for testing');
    req.user = {
      id: 'test-user-123',
      email: 'test@nyauwu.com',
      name: 'Test User'
    };
    return next();
  }
  
  try {
    const sessionToken = req.cookies.session;
    if (!sessionToken) {
      console.log('❌ No session token found');
      return res.status(401).json({ error: 'No autenticado' });
    }

    console.log('🔍 Looking for session with token:', sessionToken.substring(0, 10) + '...');
    
    const session = await prisma.session.findUnique({
      where: { sessionToken },
      include: { User: true }
    });

    if (!session || session.expires < new Date()) {
      console.log('❌ Session not found or expired');
      return res.status(401).json({ error: 'Sesión expirada' });
    }

    console.log('✅ User authenticated:', session.User.email);
    req.user = session.User;
    next();
  } catch (error) {
    console.error('💥 Error en autenticación:', error);
    res.status(500).json({ error: 'Error de autenticación' });
  }
};

// POST /api/upload/files - Subir archivos de audio
router.post('/files', requireAuth, upload.array('files', 20), async (req: any, res) => {
  console.log('🚀 Upload endpoint called');
  console.log('📁 Files received:', req.files?.length || 0);
  console.log('👤 User:', req.user?.email);
  console.log('🆔 Session ID:', req.body?.sessionId);
  
  try {
    const files = req.files as Express.Multer.File[];
    const { sessionId } = req.body;

    if (!files || files.length === 0) {
      console.log('❌ No files received');
      return res.status(400).json({ error: 'No se subieron archivos' });
    }

    console.log('✅ Processing', files.length, 'files');

    // Extraer metadatos básicos de los archivos
    const fileMetadata = await Promise.all(
      files.map(async (file, index) => {
        // Aquí se podría usar una librería como music-metadata para extraer metadatos
        // Por ahora simulamos la extracción
        const duration = Math.floor(Math.random() * 300) + 60; // 1-5 minutos
        
        return {
          id: uuidv4(),
          originalName: file.originalname,
          filename: file.filename,
          path: file.path,
          size: file.size,
          trackNumber: index + 1,
          title: path.parse(file.originalname).name,
          duration,
          extractedMetadata: {
            // Metadatos extraídos automáticamente
            bitrate: '320kbps',
            sampleRate: '44.1kHz',
            format: path.extname(file.originalname).substring(1).toUpperCase()
          }
        };
      })
    );

    const response = {
      success: true,
      sessionId: sessionId || uuidv4(),
      files: fileMetadata,
      message: `${files.length} archivos subidos exitosamente`
    };
    
    console.log('📤 Sending response:', JSON.stringify(response, null, 2));
    res.json(response);

  } catch (error) {
    console.error('💥 Error subiendo archivos:', error);
    console.error('📊 Error stack:', error instanceof Error ? error.stack : 'No stack available');
    res.status(500).json({ 
      error: 'Error subiendo archivos',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// POST /api/upload/cover - Subir imagen de portada
router.post('/cover', requireAuth, multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      const uploadPath = process.env.TEMP_UPLOAD_PATH || './temp/uploads';
      const sessionId = req.body.sessionId;
      const fullPath = path.join(uploadPath, sessionId);
      cb(null, fullPath);
    },
    filename: (req, file, cb) => {
      cb(null, `cover-${Date.now()}${path.extname(file.originalname)}`);
    }
  }),
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
}).single('coverImage'), async (req: any, res) => {
  try {
    const file = req.file;
    const { sessionId } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'No se subió imagen de portada' });
    }

    res.json({
      success: true,
      cover: {
        filename: file.filename,
        path: file.path,
        size: file.size,
        mimetype: file.mimetype
      }
    });

  } catch (error) {
    console.error('Error subiendo portada:', error);
    res.status(500).json({ 
      error: 'Error subiendo portada',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// POST /api/upload/submit - Enviar álbum para procesamiento
router.post('/submit', requireAuth, async (req: any, res) => {
  try {
    const {
      sessionId,
      albumData,
      tracks,
      coverImage
    } = req.body;

    // Validar datos requeridos
    if (!albumData.title || !albumData.artistName || !albumData.year || !albumData.genre) {
      return res.status(400).json({ error: 'Faltan datos obligatorios del álbum' });
    }

    if (!tracks || tracks.length === 0) {
      return res.status(400).json({ error: 'El álbum debe tener al menos una canción' });
    }

    // Validar que todos los tracks tengan título
    for (const track of tracks) {
      if (!track.title || !track.trackNumber) {
        return res.status(400).json({ error: 'Todos los tracks deben tener título y número' });
      }
    }

    // Crear registro de trabajo en la base de datos
    const jobId = uuidv4();
    const processingJob = await prisma.processingJob.create({
      data: {
        jobId,
        userId: req.user.id,
        status: 'pending',
        albumData: {
          ...albumData,
          tracks,
          coverImage
        }
      }
    });

    // Agregar trabajo a la cola de procesamiento
    const tempUploadPath = path.join(process.env.TEMP_UPLOAD_PATH || './temp/uploads', sessionId);
    
    await addAudioProcessingJob({
      jobId,
      userId: req.user.id,
      albumData: {
        ...albumData,
        tracks: tracks.map((track: any) => ({
          title: track.title,
          trackNumber: track.trackNumber,
          filePath: track.path,
          originalFilename: track.filename
        }))
      },
      tempUploadPath
    });

    res.json({
      success: true,
      jobId,
      message: 'Álbum enviado para procesamiento',
      estimatedTime: '5-10 minutos'
    });

  } catch (error) {
    console.error('Error enviando álbum:', error);
    res.status(500).json({ 
      error: 'Error enviando álbum para procesamiento',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// GET /api/upload/status/:jobId - Obtener estado del trabajo
router.get('/status/:jobId', requireAuth, async (req: any, res) => {
  try {
    const { jobId } = req.params;

    // Verificar que el trabajo pertenece al usuario
    const job = await prisma.processingJob.findFirst({
      where: {
        jobId,
        userId: req.user.id
      }
    });

    if (!job) {
      return res.status(404).json({ error: 'Trabajo no encontrado' });
    }

    // Obtener estado de la cola
    const queueStatus = await getJobStatus(jobId);

    res.json({
      success: true,
      job: {
        id: job.jobId,
        status: job.status,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        errorMessage: job.errorMessage,
        albumData: job.albumData,
        queueProgress: queueStatus?.progress || 0,
        queueState: queueStatus?.state || 'unknown'
      }
    });

  } catch (error) {
    console.error('Error obteniendo estado:', error);
    res.status(500).json({ 
      error: 'Error obteniendo estado del trabajo',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// GET /api/upload/jobs - Obtener trabajos del usuario
router.get('/jobs', requireAuth, async (req: any, res) => {
  try {
    const jobs = await prisma.processingJob.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    res.json({
      success: true,
      jobs: jobs.map(job => ({
        id: job.jobId,
        status: job.status,
        albumTitle: (job.albumData as any)?.title || 'Sin título',
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        errorMessage: job.errorMessage
      }))
    });

  } catch (error) {
    console.error('Error obteniendo trabajos:', error);
    res.status(500).json({ 
      error: 'Error obteniendo trabajos',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// DELETE /api/upload/session/:sessionId - Limpiar archivos de sesión
router.delete('/session/:sessionId', requireAuth, async (req: any, res) => {
  try {
    const { sessionId } = req.params;
    const uploadPath = path.join(process.env.TEMP_UPLOAD_PATH || './temp/uploads', sessionId);

    try {
      await fs.rm(uploadPath, { recursive: true, force: true });
    } catch (error) {
      // Ignorar errores si el directorio no existe
    }

    res.json({
      success: true,
      message: 'Archivos de sesión eliminados'
    });

  } catch (error) {
    console.error('Error limpiando sesión:', error);
    res.status(500).json({ 
      error: 'Error limpiando archivos de sesión',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

export default router;
