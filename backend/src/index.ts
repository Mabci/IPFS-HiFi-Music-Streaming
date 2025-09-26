import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import { randomBytes } from 'crypto'
import { PrismaClient } from '@prisma/client'
import catalogRoutes from './routes/catalog.js';
import uploadRoutes from './routes/upload.js';
import workerRoutes from './routes/worker.js';
import searchRoutes from './routes/search.js';
import vpsStatusRoutes from './routes/vps-status.js';
import ipfsStatusRoutes from './routes/ipfs-status.js';
import { subdomainHandler, requireArtistDomain } from './middleware/subdomain-handler.js';
import { initializeWebSocketService } from './services/websocket-service.js';
import {
  isValidEmail,
  isValidPassword,
  isValidUsername,
  hashPassword,
  verifyPassword,
  generateUniqueUsername,
  createUserSession,
  findUserByEmail,
  findUserByUsername,
  isUsernameAvailable,
  createUserWithPassword,
  linkOAuthAccount,
  base64url,
  randomToken,
  addDays
} from './services/auth-utils.js';

const app = express()
const prisma = new PrismaClient()

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/api/auth/google/callback'
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'
const ARTIST_FRONTEND_URL = process.env.ARTIST_FRONTEND_URL || 'http://localhost:3000'
const IS_PROD = process.env.NODE_ENV === 'production'

if (IS_PROD) {
  // Recomendado si hay proxy/CDN delante (para que "secure cookie" funcione correctamente)
  app.set('trust proxy', 1)
}

// Rate limiting básico para endpoints de autenticación
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 60, // hasta 60 requests por ventana
  standardHeaders: true,
  legacyHeaders: false,
})

// CORS configurado para múltiples dominios
const allowedOrigins = [
  FRONTEND_URL,
  ARTIST_FRONTEND_URL,
  'https://nyauwu.com',
  'https://artist.nyauwu.com'
].filter(Boolean);

app.use(cors({ 
  origin: allowedOrigins, 
  credentials: true 
}))
app.use(cookieParser())
app.use(express.json({ limit: '1mb' }))

// Middleware para detectar subdominios
app.use(subdomainHandler)

// Aplica limitador a rutas de auth
app.use('/api/auth', authLimiter)

// Limpieza periódica de sesiones expiradas (cada hora)
setInterval(async () => {
  try {
    const removed = await prisma.session.deleteMany({
      where: { expires: { lt: new Date() } },
    })
    if (removed.count > 0) {
      console.log(`[sessions] cleaned ${removed.count} expired`)
    }
  } catch (e) {
    console.error('[sessions] cleanup error:', e)
  }
}, 60 * 60 * 1000)


// Middleware para exigir sesión
async function requireAuth(req: any, res: express.Response, next: express.NextFunction) {
  try {
    const token = req?.cookies?.session as string | undefined
    if (!token) {
      return res.status(401).json({ ok: false, error: 'unauthorized' })
    }
    const session = await prisma.session.findUnique({
      where: { sessionToken: token },
      include: { User: true }
    })
    if (!session || session.expires < new Date()) {
      res.clearCookie('session', { 
        httpOnly: true, 
        sameSite: IS_PROD ? 'none' : 'lax', 
        secure: IS_PROD,
        domain: IS_PROD ? '.nyauwu.com' : undefined
      })
      if (session) {
        await prisma.session.delete({ where: { sessionToken: token } }).catch(() => {})
      }
      return res.status(401).json({ ok: false, error: 'unauthorized' })
    }
    req.user = session.User
    return next()
  } catch (e) {
    console.error('[requireAuth] error:', e)
    return res.status(500).json({ ok: false, error: 'auth_middleware_failed' })
  }
}

function isValidLikeType(t?: string): t is 'track' | 'album' {
  return t === 'track' || t === 'album'
}

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ ok: true, db: 'ok' })
  } catch (e) {
    console.error('[health] DB error:', e)
    const message = (e as any)?.message ?? 'unknown'
    res.status(500).json({ ok: false, error: 'db_unavailable', message })
  }
})

// Inicia el flujo OAuth con Google
app.get('/api/auth/google', async (_req, res) => {
  try {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_REDIRECT_URI) {
      return res.status(500).json({ ok: false, error: 'google_oauth_not_configured' })
    }

    const state = randomToken(16)
    res.cookie('ga_state', state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: IS_PROD,
      maxAge: 10 * 60 * 1000 // 10 minutos
    })

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: GOOGLE_REDIRECT_URI,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'offline',
      prompt: 'consent'
    })

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
    return res.redirect(url)
  } catch (e) {
    console.error('[auth/google] error:', e)
    return res.status(500).json({ ok: false, error: 'auth_init_failed' })
  }
})

// Callback de Google OAuth
app.get('/api/auth/google/callback', async (req, res) => {
  try {
    const code = typeof req.query.code === 'string' ? req.query.code : undefined
    const state = typeof req.query.state === 'string' ? req.query.state : undefined
    const cookieState = (req as any).cookies?.ga_state as string | undefined

    if (!code || !state || !cookieState || state !== cookieState) {
      return res.status(400).json({ ok: false, error: 'invalid_state_or_code' })
    }

    res.clearCookie('ga_state', { httpOnly: true, sameSite: 'lax', secure: IS_PROD })

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
      return res.status(500).json({ ok: false, error: 'google_oauth_not_configured' })
    }

    const tokenParams = new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code'
    })

    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString()
    })
    const tokenJson: any = await tokenResp.json()
    if (!tokenResp.ok) {
      console.error('[auth/callback] token error:', tokenJson)
      return res.status(400).json({ ok: false, error: 'token_exchange_failed', details: tokenJson })
    }

    const accessToken: string | undefined = tokenJson.access_token
    const refreshToken: string | undefined = tokenJson.refresh_token
    const idToken: string | undefined = tokenJson.id_token
    const expiresIn: number | undefined = tokenJson.expires_in

    const uiResp = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    const profile: any = await uiResp.json()
    if (!uiResp.ok) {
      console.error('[auth/callback] userinfo error:', profile)
      return res.status(400).json({ ok: false, error: 'userinfo_failed', details: profile })
    }

    const sub: string = profile.sub
    const email: string | undefined = profile.email
    const name: string | undefined = profile.name
    const picture: string | undefined = profile.picture

    if (!email) {
      return res.status(400).json({ ok: false, error: 'email_required' })
    }

    // Buscar usuario existente por email
    let user = await prisma.user.findUnique({ where: { email } })
    let isNewUser = false
    
    if (!user) {
      // Crear nuevo usuario
      user = await prisma.user.create({ 
        data: { 
          id: randomToken(16),
          email,
          updatedAt: new Date()
        }
      })
      isNewUser = true
    }
    
    // Crear o actualizar perfil de usuario si es nuevo y se proporciona información
    if (isNewUser && name) {
      // Generar username único basado en email
      let baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '')
      let username = baseUsername
      let counter = 1
      
      // Asegurar que el username sea único
      while (await prisma.userProfile.findUnique({ where: { username } })) {
        username = `${baseUsername}${counter}`
        counter++
      }
      
      await prisma.userProfile.create({
        data: {
          userId: user.id,
          username,
          displayName: name,
          bio: null,
          avatarUrl: picture,
          isPublic: true
        }
      })
    }

    // Upsert Account
    const expiresAt = expiresIn ? Math.floor(Date.now() / 1000) + expiresIn : null
    await prisma.account.upsert({
      where: { provider_providerAccountId: { provider: 'google', providerAccountId: sub } },
      update: {
        userId: user.id,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        id_token: idToken
      },
      create: {
        id: randomToken(16),
        userId: user.id,
        type: 'oauth',
        provider: 'google',
        providerAccountId: sub,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        id_token: idToken
      }
    })

    // Crear sesión
    const sessionToken = randomToken(32)
    const expires = addDays(new Date(), 30)
    await prisma.session.create({ data: { 
      id: randomToken(16),
      userId: user.id, 
      sessionToken, 
      expires 
    } })

    // No establecer cookie directamente en redirect cross-domain
    // En su lugar, pasar token como parámetro para que frontend lo procese
    return res.redirect(`${FRONTEND_URL}?oauth_token=${sessionToken}`)
  } catch (e) {
    console.error('[auth/google/callback] error:', e)
    return res.status(500).json({ ok: false, error: 'auth_callback_failed' })
  }
})

// Devuelve la sesión actual
app.get('/api/auth/session', async (req, res) => {
  try {
    const token = (req as any).cookies?.session as string | undefined
    if (!token) return res.json({ authenticated: false })

    const session = await prisma.session.findUnique({
      where: { sessionToken: token },
      include: { User: true }
    })
    if (!session || session.expires < new Date()) {
      res.clearCookie('session', { 
        httpOnly: true, 
        sameSite: IS_PROD ? 'none' : 'lax', 
        secure: IS_PROD,
        domain: IS_PROD ? '.nyauwu.com' : undefined
      })
      if (session) {
        await prisma.session.delete({ where: { sessionToken: token } }).catch(() => {})
      }
      return res.json({ authenticated: false })
    }

    const { id, email } = session.User
    return res.json({ authenticated: true, user: { id, email } })
  } catch (e) {
    console.error('[auth/session] error:', e)
    return res.status(500).json({ ok: false, error: 'session_failed' })
  }
})

// Endpoint protegido: información del usuario autenticado
app.get('/api/me', requireAuth, async (req, res) => {
  const user = (req as any).user as { id: string; email: string | null }
  const { id, email } = user
  return res.json({ ok: true, user: { id, email } })
})

// Likes de biblioteca
// Lista likes del usuario autenticado (opcional filtrar por ?type=track|album)
app.get('/api/library/likes', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id as string
    const t = typeof req.query.type === 'string' ? req.query.type : undefined
    if (t && !isValidLikeType(t)) {
      return res.status(400).json({ ok: false, error: 'invalid_type' })
    }
    const likes = await prisma.libraryLike.findMany({
      where: { userId, ...(t ? { targetType: t } : {}) },
      orderBy: { createdAt: 'desc' },
    })
    return res.json({ ok: true, likes })
  } catch (e) {
    console.error('[library/likes:list] error:', e)
    return res.status(500).json({ ok: false, error: 'likes_list_failed' })
  }
})

// Crea un like (idempotente)
app.post('/api/library/likes', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id as string
    const { type, id } = req.body || {}
    if (!isValidLikeType(type) || typeof id !== 'string' || !id) {
      return res.status(400).json({ ok: false, error: 'invalid_body' })
    }
    await prisma.libraryLike.upsert({
      where: { userId_targetType_targetId: { userId, targetType: type, targetId: id } },
      update: {},
      create: { 
        id: randomToken(16), // Generar ID único para el like
        userId, 
        targetType: type, 
        targetId: id 
      },
    })
    return res.status(201).json({ ok: true })
  } catch (e) {
    console.error('[library/likes:create] error:', e)
    return res.status(500).json({ ok: false, error: 'like_create_failed' })
  }
})

// Elimina un like
app.delete('/api/library/likes/:type/:id', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id as string
    const type = req.params.type
    const id = req.params.id
    if (!isValidLikeType(type) || !id) {
      return res.status(400).json({ ok: false, error: 'invalid_params' })
    }
    await prisma.libraryLike.delete({
      where: { userId_targetType_targetId: { userId, targetType: type, targetId: id } },
    }).catch(() => {})
    return res.status(204).end()
  } catch (e) {
    console.error('[library/likes:delete] error:', e)
    return res.status(500).json({ ok: false, error: 'like_delete_failed' })
  }
})

// Playlists
// Lista playlists del usuario autenticado
app.get('/api/playlists', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id as string
    const playlists = await prisma.playlist.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, isPublic: true, createdAt: true, updatedAt: true }
    })
    return res.json({ ok: true, playlists })
  } catch (e) {
    console.error('[playlists:list] error:', e)
    return res.status(500).json({ ok: false, error: 'playlists_list_failed' })
  }
})

// Crea playlist
app.post('/api/playlists', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id as string
    const { name, isPublic } = req.body || {}
    if (typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ ok: false, error: 'invalid_name' })
    }
    const pl = await prisma.playlist.create({
      data: { 
        id: randomToken(16),
        userId, 
        name: name.trim(), 
        isPublic: Boolean(isPublic),
        updatedAt: new Date()
      }
    })
    return res.status(201).json({ ok: true, playlist: { id: pl.id, name: pl.name, isPublic: pl.isPublic } })
  } catch (e) {
    console.error('[playlists:create] error:', e)
    return res.status(500).json({ ok: false, error: 'playlist_create_failed' })
  }
})

// Obtiene detalles de una playlist (con items)
app.get('/api/playlists/:id', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id as string
    const id = req.params.id
    const pl = await prisma.playlist.findFirst({
      where: { id, userId },
      include: { PlaylistItem: { orderBy: { position: 'asc' } } }
    })
    if (!pl) return res.status(404).json({ ok: false, error: 'not_found' })
    return res.json({ ok: true, playlist: pl })
  } catch (e) {
    console.error('[playlists:get] error:', e)
    return res.status(500).json({ ok: false, error: 'playlist_get_failed' })
  }
})

// Actualiza nombre o visibilidad
app.patch('/api/playlists/:id', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id as string
    const id = req.params.id
    const { name, isPublic } = req.body || {}
    const pl = await prisma.playlist.findFirst({ where: { id, userId } })
    if (!pl) return res.status(404).json({ ok: false, error: 'not_found' })
    const updated = await prisma.playlist.update({
      where: { id },
      data: {
        ...(typeof name === 'string' && name.trim() ? { name: name.trim() } : {}),
        ...(typeof isPublic === 'boolean' ? { isPublic } : {}),
      }
    })
    return res.json({ ok: true, playlist: updated })
  } catch (e) {
    console.error('[playlists:update] error:', e)
    return res.status(500).json({ ok: false, error: 'playlist_update_failed' })
  }
})

// Elimina playlist
app.delete('/api/playlists/:id', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id as string
    const id = req.params.id
    const pl = await prisma.playlist.findFirst({ where: { id, userId } })
    if (!pl) return res.status(404).json({ ok: false, error: 'not_found' })
    await prisma.playlist.delete({ where: { id } })
    return res.status(204).end()
  } catch (e) {
    console.error('[playlists:delete] error:', e)
    return res.status(500).json({ ok: false, error: 'playlist_delete_failed' })
  }
})

// Añade item a playlist (al final por defecto)
app.post('/api/playlists/:id/items', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id as string
    const id = req.params.id
    const { trackId, position } = req.body || {}
    if (typeof trackId !== 'string' || !trackId) {
      return res.status(400).json({ ok: false, error: 'invalid_track' })
    }
    const pl = await prisma.playlist.findFirst({ where: { id, userId } })
    if (!pl) return res.status(404).json({ ok: false, error: 'not_found' })
    const count = await prisma.playlistItem.count({ where: { playlistId: id } })
    const pos = Number.isInteger(position) ? Math.max(0, position as number) : count
    const item = await prisma.playlistItem.create({
      data: { 
        id: randomToken(16),
        playlistId: id, 
        trackId, 
        position: pos 
      }
    })
    // Si el position solicitado está dentro del rango, empuja los siguientes
    if (Number.isInteger(position) && (position as number) < count) {
      await prisma.playlistItem.updateMany({
        where: { playlistId: id, id: { not: item.id }, position: { gte: pos } },
        data: { position: { increment: 1 } }
      })
    }
    return res.status(201).json({ ok: true, item })
  } catch (e) {
    console.error('[playlists:add_item] error:', e)
    return res.status(500).json({ ok: false, error: 'playlist_item_add_failed' })
  }
})

// Elimina item de playlist
app.delete('/api/playlists/:id/items/:itemId', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id as string
    const id = req.params.id
    const itemId = req.params.itemId
    const pl = await prisma.playlist.findFirst({ where: { id, userId } })
    if (!pl) return res.status(404).json({ ok: false, error: 'not_found' })
    const item = await prisma.playlistItem.findUnique({ where: { id: itemId } })
    if (!item || item.playlistId !== id) return res.status(404).json({ ok: false, error: 'item_not_found' })
    await prisma.$transaction([
      prisma.playlistItem.delete({ where: { id: itemId } }),
      prisma.playlistItem.updateMany({
        where: { playlistId: id, position: { gt: item.position } },
        data: { position: { decrement: 1 } }
      })
    ])
    return res.status(204).end()
  } catch (e) {
    console.error('[playlists:delete_item] error:', e)
    return res.status(500).json({ ok: false, error: 'playlist_item_delete_failed' })
  }
})

// Reordenar items: acepta array de {id, position}
app.post('/api/playlists/:id/reorder', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id as string
    const id = req.params.id
    const { items } = req.body || {}
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ ok: false, error: 'invalid_items' })
    }
    const pl = await prisma.playlist.findFirst({ where: { id, userId } })
    if (!pl) return res.status(404).json({ ok: false, error: 'not_found' })
    // Validar pertenencia
    const existing = await prisma.playlistItem.findMany({ where: { playlistId: id } })
    const map = new Map(existing.map((i: any) => [i.id, i]))
    for (const it of items) {
      if (!it || typeof it.id !== 'string' || typeof it.position !== 'number' || !map.has(it.id)) {
        return res.status(400).json({ ok: false, error: 'invalid_item_entry' })
      }
    }
    await prisma.$transaction(items.map((it: any) =>
      prisma.playlistItem.update({ where: { id: it.id }, data: { position: it.position } })
    ))
    return res.json({ ok: true })
  } catch (e) {
    console.error('[playlists:reorder] error:', e)
    return res.status(500).json({ ok: false, error: 'playlist_reorder_failed' })
  }
})

// Registro con email/password
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, username } = req.body || {}
    
    // Validaciones
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ ok: false, error: 'invalid_email' })
    }
    
    if (!password || !isValidPassword(password)) {
      return res.status(400).json({ ok: false, error: 'invalid_password', message: 'Password must be 8-128 characters' })
    }
    
    if (username && !isValidUsername(username)) {
      return res.status(400).json({ ok: false, error: 'invalid_username', message: 'Username must be 3-30 alphanumeric characters' })
    }
    
    // Verificar si el email ya existe
    const existingUser = await findUserByEmail(email)
    if (existingUser) {
      return res.status(409).json({ ok: false, error: 'email_already_exists' })
    }
    
    // Verificar si el username ya existe (si se proporciona)
    if (username && !(await isUsernameAvailable(username))) {
      return res.status(409).json({ ok: false, error: 'username_taken' })
    }
    
    // Crear usuario
    const user = await createUserWithPassword(email, password, username)
    
    // Crear sesión
    const sessionToken = await createUserSession(user.id)
    
    res.cookie('session', sessionToken, {
      httpOnly: true,
      sameSite: IS_PROD ? 'none' : 'lax',
      secure: IS_PROD,
      domain: IS_PROD ? '.nyauwu.com' : undefined, // Cookie válida para todos los subdominios
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 días
    })
    
    return res.status(201).json({ 
      ok: true, 
      user: { 
        id: user.id, 
        email: user.email,
        needsUsername: !username 
      } 
    })
  } catch (e) {
    console.error('[auth/register] error:', e)
    return res.status(500).json({ ok: false, error: 'registration_failed' })
  }
})

// Login con email/password
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {}
    
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'email_and_password_required' })
    }
    
    // Buscar usuario por email
    const user = await findUserByEmail(email)
    if (!user || !user.passwordHash) {
      return res.status(401).json({ ok: false, error: 'invalid_credentials' })
    }
    
    // Verificar password
    const isValidPassword = await verifyPassword(password, user.passwordHash)
    if (!isValidPassword) {
      return res.status(401).json({ ok: false, error: 'invalid_credentials' })
    }
    
    // Crear sesión
    const sessionToken = await createUserSession(user.id)
    
    res.cookie('session', sessionToken, {
      httpOnly: true,
      sameSite: IS_PROD ? 'none' : 'lax',
      secure: IS_PROD,
      domain: IS_PROD ? '.nyauwu.com' : undefined, // Cookie válida para todos los subdominios
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 días
    })
    
    return res.json({ 
      ok: true, 
      user: { 
        id: user.id, 
        email: user.email,
        hasUsername: !!user.UserProfile?.username
      } 
    })
  } catch (e) {
    console.error('[auth/login] error:', e)
    return res.status(500).json({ ok: false, error: 'login_failed' })
  }
})

// Verificar disponibilidad de username
app.get('/api/auth/check-username/:username', async (req, res) => {
  try {
    const { username } = req.params
    
    if (!isValidUsername(username)) {
      return res.status(400).json({ ok: false, error: 'invalid_username' })
    }
    
    const available = await isUsernameAvailable(username)
    return res.json({ ok: true, available })
  } catch (e) {
    console.error('[auth/check-username] error:', e)
    return res.status(500).json({ ok: false, error: 'check_failed' })
  }
})

// Establecer username (para usuarios que no lo tienen)
app.post('/api/auth/set-username', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id as string
    const { username } = req.body || {}
    
    if (!username || !isValidUsername(username)) {
      return res.status(400).json({ ok: false, error: 'invalid_username' })
    }
    
    // Verificar si el usuario ya tiene username
    const existingProfile = await prisma.userProfile.findUnique({
      where: { userId }
    })
    
    if (existingProfile) {
      return res.status(409).json({ ok: false, error: 'username_already_set' })
    }
    
    // Verificar disponibilidad
    if (!(await isUsernameAvailable(username))) {
      return res.status(409).json({ ok: false, error: 'username_taken' })
    }
    
    // Crear perfil de usuario
    await prisma.userProfile.create({
      data: {
        userId,
        username,
        displayName: username,
        isPublic: true
      }
    })
    
    return res.json({ ok: true })
  } catch (e) {
    console.error('[auth/set-username] error:', e)
    return res.status(500).json({ ok: false, error: 'username_set_failed' })
  }
})

// Agregar password a cuenta OAuth existente
app.post('/api/auth/add-password', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id as string
    const { password } = req.body || {}
    
    if (!password || !isValidPassword(password)) {
      return res.status(400).json({ ok: false, error: 'invalid_password', message: 'Password must be 8-128 characters' })
    }
    
    // Verificar que el usuario no tenga ya password
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return res.status(404).json({ ok: false, error: 'user_not_found' })
    }
    
    if (user.passwordHash) {
      return res.status(409).json({ ok: false, error: 'password_already_exists' })
    }
    
    // Agregar password hash
    const passwordHash = await hashPassword(password)
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash }
    })
    
    return res.json({ ok: true })
  } catch (e) {
    console.error('[auth/add-password] error:', e)
    return res.status(500).json({ ok: false, error: 'add_password_failed' })
  }
})

// Obtener métodos de autenticación del usuario
app.get('/api/auth/methods', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id as string
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        Account: {
          select: {
            provider: true,
            type: true
          }
        }
      }
    })
    
    if (!user) {
      return res.status(404).json({ ok: false, error: 'user_not_found' })
    }
    
    const methods = {
      email: !!user.passwordHash,
      google: user.Account.some((acc: { provider: string }) => acc.provider === 'google'),
      providers: user.Account.map((acc: { provider: string }) => acc.provider)
    }
    
    return res.json({ ok: true, methods })
  } catch (e) {
    console.error('[auth/methods] error:', e)
    return res.status(500).json({ ok: false, error: 'methods_failed' })
  }
})

// Cambiar password (para usuarios que ya tienen password)
app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id as string
    const { currentPassword, newPassword } = req.body || {}
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ ok: false, error: 'current_and_new_password_required' })
    }
    
    if (!isValidPassword(newPassword)) {
      return res.status(400).json({ ok: false, error: 'invalid_new_password', message: 'Password must be 8-128 characters' })
    }
    
    const user = await prisma.user.findUnique({ 
      where: { id: userId },
      select: { id: true, email: true, passwordHash: true }
    })
    if (!user || !user.passwordHash) {
      return res.status(400).json({ ok: false, error: 'no_password_set' })
    }
    
    // Verificar password actual
    const isValidCurrent = await verifyPassword(currentPassword, user.passwordHash)
    if (!isValidCurrent) {
      return res.status(401).json({ ok: false, error: 'invalid_current_password' })
    }
    
    // Actualizar password
    const newPasswordHash = await hashPassword(newPassword)
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash }
    })
    
    return res.json({ ok: true })
  } catch (e) {
    console.error('[auth/change-password] error:', e)
    return res.status(500).json({ ok: false, error: 'change_password_failed' })
  }
})

// Intercambiar token OAuth por cookie de sesión
app.post('/api/auth/exchange-token', async (req, res) => {
  try {
    const { token } = req.body || {}
    
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ ok: false, error: 'token_required' })
    }
    
    // Verificar que el token de sesión existe y es válido
    const session = await prisma.session.findUnique({
      where: { sessionToken: token },
      include: { User: true }
    })
    
    if (!session || session.expires < new Date()) {
      return res.status(401).json({ ok: false, error: 'invalid_or_expired_token' })
    }
    
    // Establecer cookie de sesión
    res.cookie('session', token, {
      httpOnly: true,
      sameSite: IS_PROD ? 'none' : 'lax',
      secure: IS_PROD,
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 días
    })
    
    return res.json({ 
      ok: true, 
      user: { 
        id: session.User.id, 
        email: session.User.email 
      } 
    })
  } catch (e) {
    console.error('[auth/exchange-token] error:', e)
    return res.status(500).json({ ok: false, error: 'token_exchange_failed' })
  }
})

// Cierra sesión
app.post('/api/auth/signout', async (req, res) => {
  try {
    const token = (req as any).cookies?.session as string | undefined
    if (token) {
      await prisma.session.delete({ where: { sessionToken: token } }).catch(() => {})
    }
    res.clearCookie('session', { httpOnly: true, sameSite: 'lax', secure: IS_PROD })
    return res.status(204).end()
  } catch (e) {
    console.error('[auth/signout] error:', e)
    return res.status(500).json({ ok: false, error: 'signout_failed' })
  }
})

// Rutas del catálogo musical (disponibles en ambos dominios)
app.use('/api/catalog', catalogRoutes)
app.use('/api/search', searchRoutes)

// Rutas específicas para artistas (solo en artist.nyauwu.com)
app.use('/api/upload', requireArtistDomain, uploadRoutes)
app.use('/api/worker', requireArtistDomain, workerRoutes)
app.use('/api/vps', requireArtistDomain, vpsStatusRoutes)
app.use('/api/ipfs', requireArtistDomain, ipfsStatusRoutes)

const PORT = Number(process.env.PORT || 4000)

// Crear servidor HTTP para WebSockets
import { createServer } from 'http'
const httpServer = createServer(app)

// Inicializar WebSocket service
const wsService = initializeWebSocketService(httpServer)

httpServer.listen(PORT, () => {
  console.log(`[backend] listening on http://localhost:${PORT}`)
  console.log(`[websocket] WebSocket server initialized`)
})
