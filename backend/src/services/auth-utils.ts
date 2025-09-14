import bcrypt from 'bcrypt'
import validator from 'validator'
import { randomBytes } from 'crypto'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Configuración de bcrypt
const SALT_ROUNDS = 12

export function base64url(input: Buffer | string): string {
  const buff = typeof input === 'string' ? Buffer.from(input) : input
  return buff.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

export function randomToken(bytes = 32): string {
  return base64url(randomBytes(bytes))
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

// Validación de email
export function isValidEmail(email: string): boolean {
  return validator.isEmail(email) && email.length <= 255
}

// Validación de password
export function isValidPassword(password: string): boolean {
  return password.length >= 8 && password.length <= 128
}

// Validación de username
export function isValidUsername(username: string): boolean {
  // Username debe ser alfanumérico, guiones bajos permitidos, 3-30 caracteres
  return /^[a-zA-Z0-9_]{3,30}$/.test(username)
}

// Hash de password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

// Verificar password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// Generar username único basado en email
export async function generateUniqueUsername(email: string): Promise<string> {
  let baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '')
  
  // Asegurar que tenga al menos 3 caracteres
  if (baseUsername.length < 3) {
    baseUsername = 'user' + baseUsername
  }
  
  // Truncar si es muy largo
  if (baseUsername.length > 25) {
    baseUsername = baseUsername.substring(0, 25)
  }
  
  let username = baseUsername
  let counter = 1
  
  // Buscar username único
  while (await prisma.userProfile.findUnique({ where: { username } })) {
    const suffix = counter.toString()
    const maxBase = 30 - suffix.length
    const truncatedBase = baseUsername.substring(0, maxBase)
    username = `${truncatedBase}${suffix}`
    counter++
  }
  
  return username
}

// Crear sesión de usuario
export async function createUserSession(userId: string): Promise<string> {
  const sessionToken = randomToken(32)
  const expires = addDays(new Date(), 30)
  
  await prisma.session.create({
    data: {
      id: randomToken(16),
      userId,
      sessionToken,
      expires
    }
  })
  
  return sessionToken
}

// Buscar usuario por email
export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    include: {
      UserProfile: true,
      Account: true
    }
  })
}

// Buscar usuario por username
export async function findUserByUsername(username: string) {
  const userProfile = await prisma.userProfile.findUnique({
    where: { username },
    include: {
      User: {
        include: {
          Account: true
        }
      }
    }
  })
  
  return userProfile?.User || null
}

// Verificar si username está disponible
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const existing = await prisma.userProfile.findUnique({
    where: { username }
  })
  return !existing
}

// Crear usuario con email/password
export async function createUserWithPassword(
  email: string, 
  password: string, 
  username?: string
) {
  const passwordHash = await hashPassword(password)
  
  const user = await prisma.user.create({
    data: {
      id: randomToken(16),
      email,
      passwordHash,
      updatedAt: new Date()
    }
  })
  
  // Crear perfil si se proporciona username
  if (username) {
    await prisma.userProfile.create({
      data: {
        userId: user.id,
        username,
        displayName: username,
        isPublic: true
      }
    })
  }
  
  return user
}

// Vincular cuenta OAuth a usuario existente
export async function linkOAuthAccount(
  userId: string,
  provider: string,
  providerAccountId: string,
  accessToken?: string,
  refreshToken?: string,
  expiresAt?: number,
  idToken?: string
) {
  return prisma.account.create({
    data: {
      id: randomToken(16),
      userId,
      type: 'oauth',
      provider,
      providerAccountId,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      id_token: idToken
    }
  })
}
