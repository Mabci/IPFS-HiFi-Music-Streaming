require('dotenv').config()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const compression = require('compression')
const rateLimit = require('express-rate-limit')
const { createClient } = require('redis')
const { Pool } = require('pg')
const axios = require('axios')
const winston = require('winston')
const { register, collectDefaultMetrics, Counter, Histogram, Gauge } = require('prom-client')

// Configuración
const PORT = process.env.PORT || 3001
const IPFS_API_URL = process.env.IPFS_API_URL || 'http://localhost:5001'
const IPFS_GATEWAY_URL = process.env.IPFS_GATEWAY_URL || 'http://localhost:8080'
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
const DATABASE_URL = process.env.DATABASE_URL
const MAIN_DATABASE_URL = process.env.MAIN_DATABASE_URL // BD principal con los CIDs autorizados
const CACHE_TTL = parseInt(process.env.CACHE_TTL) || 3600 // 1 hora
const MAX_CACHE_SIZE = process.env.MAX_CACHE_SIZE || '1GB'

// Logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
})

// Métricas Prometheus
collectDefaultMetrics()
const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
})

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route']
})

const cacheHitsTotal = new Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['type']
})

const ipfsRequestsTotal = new Counter({
  name: 'ipfs_requests_total',
  help: 'Total number of IPFS requests',
  labelNames: ['source', 'status']
})

const activePins = new Gauge({
  name: 'ipfs_active_pins_total',
  help: 'Total number of active pins'
})

const unauthorizedRequests = new Counter({
  name: 'unauthorized_requests_total',
  help: 'Total number of unauthorized CID requests',
  labelNames: ['cid']
})

// Inicializar conexiones
let redisClient
let pgPool
let mainDbPool

async function initializeConnections() {
  // Redis
  try {
    redisClient = createClient({ url: REDIS_URL })
    await redisClient.connect()
    logger.info('Redis connected successfully')
  } catch (error) {
    logger.error('Redis connection failed:', error)
    redisClient = null
  }

  // PostgreSQL Gateway (para métricas)
  if (DATABASE_URL) {
    try {
      pgPool = new Pool({ connectionString: DATABASE_URL })
      await pgPool.query('SELECT 1')
      logger.info('Gateway PostgreSQL connected successfully')
    } catch (error) {
      logger.error('Gateway PostgreSQL connection failed:', error)
      pgPool = null
    }
  }

  // PostgreSQL Principal (para validación de CIDs)
  if (MAIN_DATABASE_URL) {
    try {
      mainDbPool = new Pool({ connectionString: MAIN_DATABASE_URL })
      await mainDbPool.query('SELECT 1')
      logger.info('Main PostgreSQL connected successfully')
    } catch (error) {
      logger.error('Main PostgreSQL connection failed:', error)
      mainDbPool = null
    }
  }
}

const app = express()

// Middleware de seguridad y performance
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false
}))
app.use(compression())
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'HEAD', 'OPTIONS'],
  allowedHeaders: ['Range', 'If-Range', 'Cache-Control', 'Authorization']
}))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // límite por IP
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false
})
app.use(limiter)

// Middleware de métricas
app.use((req, res, next) => {
  const start = Date.now()
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000
    const route = req.route?.path || req.path
    
    httpRequestsTotal.inc({
      method: req.method,
      route,
      status_code: res.statusCode
    })
    
    httpRequestDuration.observe({
      method: req.method,
      route
    }, duration)
  })
  
  next()
})

// Utilidades de cache
async function getCacheKey(cid, range = null) {
  const key = range ? `ipfs:${cid}:${range}` : `ipfs:${cid}`
  return key
}

async function getFromCache(key) {
  if (!redisClient) return null
  
  try {
    const cached = await redisClient.get(key)
    if (cached) {
      cacheHitsTotal.inc({ type: 'hit' })
      return JSON.parse(cached)
    }
    cacheHitsTotal.inc({ type: 'miss' })
    return null
  } catch (error) {
    logger.error('Cache get error:', error)
    return null
  }
}

async function setCache(key, data, ttl = CACHE_TTL) {
  if (!redisClient) return
  
  try {
    await redisClient.setEx(key, ttl, JSON.stringify(data))
  } catch (error) {
    logger.error('Cache set error:', error)
  }
}

// Función para validar CID contra la base de datos principal
async function isAuthorizedCID(cid) {
  if (!mainDbPool) {
    logger.warn('Main database not available, allowing CID by default')
    return true
  }

  try {
    // Buscar el CID en las tablas de tracks, albums, covers, etc.
    const result = await mainDbPool.query(`
      SELECT 1 FROM (
        SELECT ipfs_hash as cid FROM tracks WHERE ipfs_hash = $1
        UNION
        SELECT cover_ipfs_hash as cid FROM albums WHERE cover_ipfs_hash = $1
        UNION
        SELECT cover_ipfs_hash as cid FROM tracks WHERE cover_ipfs_hash = $1
        UNION
        SELECT ipfs_hash as cid FROM user_uploads WHERE ipfs_hash = $1
      ) authorized_cids
      LIMIT 1
    `, [cid])

    const isAuthorized = result.rows.length > 0
    
    if (!isAuthorized) {
      logger.warn(`Unauthorized CID request: ${cid}`)
      unauthorizedRequests.inc({ cid })
    }

    return isAuthorized
  } catch (error) {
    logger.error('CID authorization check failed:', error)
    // En caso de error, denegar por seguridad
    return false
  }
}

// Función para obtener contenido de IPFS (SOLO LOCAL)
async function fetchFromIPFS(cid, range = null) {
  const headers = {}
  if (range) {
    headers.Range = range
  }

  try {
    const response = await axios.get(`${IPFS_GATEWAY_URL}/ipfs/${cid}`, {
      headers,
      responseType: 'stream',
      timeout: 30000, // Timeout más largo para contenido local
      validateStatus: (status) => status < 500
    })
    
    if (response.status < 400) {
      ipfsRequestsTotal.inc({ source: 'local', status: 'success' })
      return {
        data: response.data,
        headers: response.headers,
        status: response.status
      }
    } else {
      throw new Error(`IPFS gateway returned status ${response.status}`)
    }
  } catch (error) {
    logger.error(`Local IPFS failed for ${cid}:`, error.message)
    ipfsRequestsTotal.inc({ source: 'local', status: 'error' })
    throw new Error(`Content not available in private gateway: ${cid}`)
  }
}

// Función para hacer pin de contenido
async function pinContent(cid) {
  try {
    await axios.post(`${IPFS_API_URL}/api/v0/pin/add?arg=${cid}`, null, {
      timeout: 30000
    })
    logger.info(`Pinned content: ${cid}`)
    
    // Actualizar métricas
    if (pgPool) {
      await pgPool.query(
        'INSERT INTO pins (cid, pinned_at, access_count) VALUES ($1, NOW(), 1) ON CONFLICT (cid) DO UPDATE SET access_count = pins.access_count + 1',
        [cid]
      ).catch(err => logger.error('Pin metrics error:', err))
    }
  } catch (error) {
    logger.error(`Pin failed for ${cid}:`, error.message)
    throw error
  }
}

// Endpoint principal del gateway (CON VALIDACIÓN PRIVADA)
app.get('/ipfs/:cid(*)', async (req, res) => {
  const { cid } = req.params
  const range = req.headers.range
  
  try {
    // Validar CID básico
    if (!cid || cid.length < 10) {
      return res.status(400).json({ error: 'Invalid CID' })
    }

    logger.info(`Request for ${cid}${range ? ` with range ${range}` : ''}`)

    // VALIDACIÓN CRÍTICA: Verificar si el CID está autorizado
    const isAuthorized = await isAuthorizedCID(cid)
    if (!isAuthorized) {
      logger.warn(`BLOCKED: Unauthorized CID access attempt: ${cid}`)
      return res.status(403).json({ 
        error: 'Content not available in private gateway',
        message: 'This gateway only serves content from our platform'
      })
    }

    // Verificar cache para contenido pequeño (metadatos, imágenes)
    const cacheKey = await getCacheKey(cid, range)
    const isLikelyAudio = req.headers['user-agent']?.includes('audio') || 
                         req.path.match(/\.(mp3|flac|aac|ogg|wav)$/i)
    
    if (!isLikelyAudio && !range) {
      const cached = await getFromCache(cacheKey)
      if (cached) {
        res.set(cached.headers)
        return res.status(cached.status).send(Buffer.from(cached.data, 'base64'))
      }
    }

    // Obtener contenido de IPFS LOCAL únicamente
    const result = await fetchFromIPFS(cid, range)
    
    // Configurar headers de respuesta
    const responseHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, If-Range, Cache-Control',
      'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Gateway-Type': 'private'
    }

    // Copiar headers importantes del upstream
    if (result.headers['content-type']) {
      responseHeaders['Content-Type'] = result.headers['content-type']
    }
    if (result.headers['content-length']) {
      responseHeaders['Content-Length'] = result.headers['content-length']
    }
    if (result.headers['content-range']) {
      responseHeaders['Content-Range'] = result.headers['content-range']
    }

    res.set(responseHeaders)
    res.status(result.status)

    // Stream la respuesta
    result.data.pipe(res)

    // Cache contenido pequeño para futuros accesos
    if (!isLikelyAudio && !range && result.headers['content-length']) {
      const size = parseInt(result.headers['content-length'])
      if (size < 1024 * 1024) { // < 1MB
        const chunks = []
        result.data.on('data', chunk => chunks.push(chunk))
        result.data.on('end', () => {
          const buffer = Buffer.concat(chunks)
          setCache(cacheKey, {
            data: buffer.toString('base64'),
            headers: responseHeaders,
            status: result.status
          })
        })
      }
    }

  } catch (error) {
    logger.error(`Gateway error for ${cid}:`, error)
    
    if (error.message.includes('not available')) {
      return res.status(404).json({ 
        error: 'Content not found',
        message: 'Content not available in private gateway'
      })
    }
    
    res.status(500).json({ error: 'Gateway error' })
  }
})

// Endpoint de salud
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    gateway_type: 'private',
    services: {
      redis: redisClient ? 'connected' : 'disconnected',
      postgres_gateway: pgPool ? 'connected' : 'disconnected',
      postgres_main: mainDbPool ? 'connected' : 'disconnected',
      ipfs: 'unknown'
    }
  }

  // Verificar IPFS
  try {
    await axios.post(`${IPFS_API_URL}/api/v0/version`, {}, { timeout: 5000 })
    health.services.ipfs = 'connected'
  } catch (error) {
    health.services.ipfs = 'disconnected'
    health.status = 'degraded'
  }

  const statusCode = health.status === 'ok' ? 200 : 503
  res.status(statusCode).json(health)
})

// Endpoint de métricas
app.get('/metrics', async (req, res) => {
  try {
    // Actualizar métricas de pins activos
    if (pgPool) {
      const result = await pgPool.query('SELECT COUNT(*) as count FROM pins')
      activePins.set(parseInt(result.rows[0].count))
    }

    res.set('Content-Type', register.contentType)
    res.end(await register.metrics())
  } catch (error) {
    logger.error('Metrics error:', error)
    res.status(500).end()
  }
})

// Endpoint para gestión de pins (admin)
app.post('/admin/pin/:cid', async (req, res) => {
  const { cid } = req.params
  
  try {
    // Verificar autorización antes de hacer pin
    const isAuthorized = await isAuthorizedCID(cid)
    if (!isAuthorized) {
      return res.status(403).json({ 
        error: 'Unauthorized CID',
        message: 'Cannot pin unauthorized content'
      })
    }

    await pinContent(cid)
    res.json({ success: true, message: `Pinned ${cid}` })
  } catch (error) {
    logger.error(`Manual pin failed for ${cid}:`, error)
    res.status(500).json({ error: 'Pin failed' })
  }
})

// Endpoint para sincronizar pins desde la BD principal
app.post('/admin/sync-pins', async (req, res) => {
  if (!mainDbPool) {
    return res.status(503).json({ error: 'Main database not available' })
  }

  try {
    logger.info('Starting pin synchronization...')
    
    // Obtener todos los CIDs autorizados
    const result = await mainDbPool.query(`
      SELECT DISTINCT cid FROM (
        SELECT ipfs_hash as cid FROM tracks WHERE ipfs_hash IS NOT NULL
        UNION
        SELECT cover_ipfs_hash as cid FROM albums WHERE cover_ipfs_hash IS NOT NULL
        UNION
        SELECT cover_ipfs_hash as cid FROM tracks WHERE cover_ipfs_hash IS NOT NULL
        UNION
        SELECT ipfs_hash as cid FROM user_uploads WHERE ipfs_hash IS NOT NULL
      ) all_cids
    `)

    const cids = result.rows.map(row => row.cid)
    logger.info(`Found ${cids.length} authorized CIDs to sync`)

    let pinned = 0
    let failed = 0

    // Pin cada CID (en paralelo, pero limitado)
    const batchSize = 5
    for (let i = 0; i < cids.length; i += batchSize) {
      const batch = cids.slice(i, i + batchSize)
      
      await Promise.allSettled(
        batch.map(async (cid) => {
          try {
            await pinContent(cid)
            pinned++
          } catch (error) {
            failed++
            logger.warn(`Failed to pin ${cid}:`, error.message)
          }
        })
      )
    }

    logger.info(`Pin sync completed: ${pinned} pinned, ${failed} failed`)
    res.json({ 
      success: true, 
      message: `Sync completed: ${pinned} pinned, ${failed} failed`,
      stats: { total: cids.length, pinned, failed }
    })

  } catch (error) {
    logger.error('Pin sync failed:', error)
    res.status(500).json({ error: 'Sync failed' })
  }
})

// Manejo de errores global
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error)
  res.status(500).json({ error: 'Internal server error' })
})

// Inicializar y arrancar servidor
async function start() {
  try {
    await initializeConnections()
    
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Private Music IPFS Gateway listening on port ${PORT}`)
      logger.info(`IPFS API: ${IPFS_API_URL}`)
      logger.info(`IPFS Gateway: ${IPFS_GATEWAY_URL}`)
      logger.info(`Cache TTL: ${CACHE_TTL}s`)
      logger.info(`Gateway Type: PRIVATE (no public fallbacks)`)
    })
  } catch (error) {
    logger.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Manejo de señales de cierre
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully')
  
  if (redisClient) {
    await redisClient.quit()
  }
  
  if (pgPool) {
    await pgPool.end()
  }

  if (mainDbPool) {
    await mainDbPool.end()
  }
  
  process.exit(0)
})

start()
