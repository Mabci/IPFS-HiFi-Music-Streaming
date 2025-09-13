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
const CACHE_TTL = parseInt(process.env.CACHE_TTL) || 3600 // 1 hora
const MAX_CACHE_SIZE = process.env.MAX_CACHE_SIZE || '1GB'

// Fallback gateways públicos
const FALLBACK_GATEWAYS = [
  'https://ipfs.io',
  'https://gateway.pinata.cloud',
  'https://cloudflare-ipfs.com',
  'https://dweb.link'
]

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

// Inicializar conexiones
let redisClient
let pgPool

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

  // PostgreSQL (opcional para métricas)
  if (DATABASE_URL) {
    try {
      pgPool = new Pool({ connectionString: DATABASE_URL })
      await pgPool.query('SELECT 1')
      logger.info('PostgreSQL connected successfully')
    } catch (error) {
      logger.error('PostgreSQL connection failed:', error)
      pgPool = null
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

// Función para obtener contenido de IPFS
async function fetchFromIPFS(cid, range = null, useLocal = true) {
  const headers = {}
  if (range) {
    headers.Range = range
  }

  // Intentar nodo local primero
  if (useLocal) {
    try {
      const response = await axios.get(`${IPFS_GATEWAY_URL}/ipfs/${cid}`, {
        headers,
        responseType: 'stream',
        timeout: 10000,
        validateStatus: (status) => status < 500
      })
      
      if (response.status < 400) {
        ipfsRequestsTotal.inc({ source: 'local', status: 'success' })
        return {
          data: response.data,
          headers: response.headers,
          status: response.status
        }
      }
    } catch (error) {
      logger.warn(`Local IPFS failed for ${cid}:`, error.message)
      ipfsRequestsTotal.inc({ source: 'local', status: 'error' })
    }
  }

  // Fallback a gateways públicos
  for (const gateway of FALLBACK_GATEWAYS) {
    try {
      const response = await axios.get(`${gateway}/ipfs/${cid}`, {
        headers,
        responseType: 'stream',
        timeout: 15000,
        validateStatus: (status) => status < 500
      })
      
      if (response.status < 400) {
        ipfsRequestsTotal.inc({ source: 'fallback', status: 'success' })
        logger.info(`Fallback success: ${gateway} for ${cid}`)
        
        // Intentar pin en nodo local para futuros accesos
        pinContent(cid).catch(err => 
          logger.warn(`Auto-pin failed for ${cid}:`, err.message)
        )
        
        return {
          data: response.data,
          headers: response.headers,
          status: response.status
        }
      }
    } catch (error) {
      logger.warn(`Fallback ${gateway} failed for ${cid}:`, error.message)
      ipfsRequestsTotal.inc({ source: 'fallback', status: 'error' })
    }
  }

  throw new Error(`Content not available: ${cid}`)
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

// Endpoint principal del gateway
app.get('/ipfs/:cid(*)', async (req, res) => {
  const { cid } = req.params
  const range = req.headers.range
  
  try {
    // Validar CID básico
    if (!cid || cid.length < 10) {
      return res.status(400).json({ error: 'Invalid CID' })
    }

    logger.info(`Request for ${cid}${range ? ` with range ${range}` : ''}`)

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

    // Obtener contenido de IPFS
    const result = await fetchFromIPFS(cid, range)
    
    // Configurar headers de respuesta
    const responseHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, If-Range, Cache-Control',
      'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable'
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
      return res.status(404).json({ error: 'Content not found' })
    }
    
    res.status(500).json({ error: 'Gateway error' })
  }
})

// Endpoint de salud
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      redis: redisClient ? 'connected' : 'disconnected',
      postgres: pgPool ? 'connected' : 'disconnected',
      ipfs: 'unknown'
    }
  }

  // Verificar IPFS
  try {
    await axios.get(`${IPFS_API_URL}/api/v0/version`, { timeout: 5000 })
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
    await pinContent(cid)
    res.json({ success: true, message: `Pinned ${cid}` })
  } catch (error) {
    logger.error(`Manual pin failed for ${cid}:`, error)
    res.status(500).json({ error: 'Pin failed' })
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
      logger.info(`Music IPFS Gateway Proxy listening on port ${PORT}`)
      logger.info(`IPFS API: ${IPFS_API_URL}`)
      logger.info(`IPFS Gateway: ${IPFS_GATEWAY_URL}`)
      logger.info(`Cache TTL: ${CACHE_TTL}s`)
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
  
  process.exit(0)
})

start()
