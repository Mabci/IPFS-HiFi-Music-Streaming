# Detalles Técnicos de Implementación - Sistema de Autenticación
**Fecha:** 13 de Septiembre, 2025  
**Sesión:** Debugging y resolución de problemas críticos

## 🏗️ Arquitectura del Sistema

### Stack Tecnológico
- **Backend:** Node.js + TypeScript + Express
- **ORM:** Prisma con PostgreSQL (Supabase)
- **Frontend:** Next.js 14 + React + TypeScript
- **UI:** Radix UI + Tailwind CSS
- **Deployment:** Render (Backend) + Vercel (Frontend)
- **Autenticación:** JWT Sessions + OAuth 2.0 (Google)

### Estructura de Base de Datos

#### Tabla User
```sql
CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "image" TEXT,
  "passwordHash" TEXT,           -- ✅ Agregada en esta sesión
  "emailVerified" TIMESTAMP(3),  -- ✅ Agregada en esta sesión
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  
  CONSTRAINT "User_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "User_email_key" UNIQUE ("email")
);
```

#### Tabla UserProfile
```sql
CREATE TABLE "UserProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "displayName" TEXT,
  "bio" TEXT,
  "avatar" TEXT,                 -- ⚠️ Conflicto con avatarUrl en código
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserProfile_userId_key" UNIQUE ("userId"),
  CONSTRAINT "UserProfile_username_key" UNIQUE ("username"),
  CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id")
);
```

#### Tablas de Sesión y Cuentas
```sql
-- Sesiones para autenticación
CREATE TABLE "Session" (
  "id" TEXT NOT NULL,
  "sessionToken" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expires" TIMESTAMP(3) NOT NULL,
  
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Session_sessionToken_key" UNIQUE ("sessionToken"),
  CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id")
);

-- Cuentas OAuth
CREATE TABLE "Account" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "refresh_token" TEXT,
  "access_token" TEXT,
  "expires_at" INTEGER,
  "token_type" TEXT,
  "scope" TEXT,
  "id_token" TEXT,
  "session_state" TEXT,
  
  CONSTRAINT "Account_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Account_provider_providerAccountId_key" UNIQUE ("provider", "providerAccountId"),
  CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id")
);
```

## 🔧 Implementación de Endpoints

### Autenticación Tradicional

#### POST /api/auth/register
```typescript
// Registro con email/password
{
  email: string,
  username: string,
  password: string
}

// Proceso:
// 1. Validar datos de entrada
// 2. Verificar email único
// 3. Verificar username único
// 4. Hash de contraseña (bcrypt, 12 rounds)
// 5. Crear User
// 6. Crear UserProfile
// 7. Crear Session
// 8. Establecer cookie httpOnly
```

#### POST /api/auth/login
```typescript
// Login con credenciales
{
  email: string,
  password: string
}

// Proceso:
// 1. Buscar usuario por email
// 2. Verificar contraseña con bcrypt
// 3. Crear nueva sesión
// 4. Establecer cookie httpOnly
```

### OAuth Google

#### GET /api/auth/google
```typescript
// Redirección a Google OAuth
// Genera URL con:
// - client_id
// - redirect_uri
// - scope: openid email profile
// - response_type: code
```

#### GET /api/auth/google/callback
```typescript
// Callback después de autorización
// Proceso:
// 1. Intercambiar code por tokens
// 2. Obtener perfil de usuario de Google
// 3. Buscar usuario existente por email
// 4. Si no existe: crear User + UserProfile
// 5. Crear/actualizar Account OAuth
// 6. Crear Session
// 7. Establecer cookie con configuración cross-domain
// 8. Redirigir a frontend
```

## 🍪 Configuración de Cookies

### Desarrollo (Local)
```typescript
res.cookie('session', sessionToken, {
  httpOnly: true,
  sameSite: 'lax',
  secure: false,
  maxAge: 30 * 24 * 60 * 60 * 1000 // 30 días
})
```

### Producción (Cross-domain)
```typescript
res.cookie('session', sessionToken, {
  httpOnly: true,
  sameSite: 'none',        // ✅ Permite cross-domain
  secure: true,            // ✅ Requerido para sameSite=none
  domain: '.nyauwu.com',   // ✅ Compartir entre subdominios
  maxAge: 30 * 24 * 60 * 60 * 1000
})
```

## 🎨 Componentes Frontend

### Página de Autenticación (/auth)
```typescript
// Componentes utilizados:
- Tabs (Login/Register)
- Card (Contenedor principal)
- Input (Campos de formulario)
- Label (Etiquetas)
- Alert (Mensajes de error/éxito)
- Button (Acciones)

// Estados manejados:
- activeTab: 'login' | 'register'
- formData: { email, username, password }
- loading: boolean
- error: string | null
- success: string | null
```

### Componentes UI Creados
```typescript
// input.tsx - Campo de entrada reutilizable
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string
}

// card.tsx - Contenedores con estilos
- Card
- CardHeader  
- CardTitle
- CardDescription
- CardContent
- CardFooter

// tabs.tsx - Navegación entre formularios
- Tabs
- TabsList
- TabsTrigger  
- TabsContent

// label.tsx - Etiquetas con variantes
- Label (con variants)

// alert.tsx - Mensajes de estado
- Alert
- AlertTitle
- AlertDescription
```

## 🚀 Configuración de Deployment

### Render (Backend)
```yaml
# render.yaml
services:
  - type: web
    name: ipfs-hifi-music-streaming
    env: node
    buildCommand: npm ci && npx prisma db push --force-reset && npx prisma generate && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase: name: postgresql-database
      - key: GOOGLE_CLIENT_ID
        sync: false
      - key: GOOGLE_CLIENT_SECRET  
        sync: false
      - key: FRONTEND_URL
        value: https://www.nyauwu.com
```

### Variables de Entorno
```bash
# Backend (.env)
DATABASE_URL="postgresql://..."
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
FRONTEND_URL="https://www.nyauwu.com"
NODE_ENV="production"

# Frontend (.env.local)
NEXT_PUBLIC_API_URL="https://ipfs-hifi-music-streaming.onrender.com"
```

## 🔒 Seguridad Implementada

### Hashing de Contraseñas
```typescript
import bcrypt from 'bcrypt'

// Registro
const passwordHash = await bcrypt.hash(password, 12)

// Login
const isValid = await bcrypt.compare(password, user.passwordHash)
```

### Validación de Entrada
```typescript
import validator from 'validator'

// Email
if (!validator.isEmail(email)) {
  return res.status(400).json({ error: 'invalid_email' })
}

// Contraseña
if (!password || password.length < 8) {
  return res.status(400).json({ error: 'weak_password' })
}

// Username
if (!username || username.length < 3 || username.length > 20) {
  return res.status(400).json({ error: 'invalid_username' })
}
```

### Rate Limiting
```typescript
// Implementado en endpoints críticos
// Límite: 5 intentos por IP por minuto
```

## 🔄 Flujo de Vinculación de Cuentas

### Escenario: Usuario con Email/Password + Google OAuth
```typescript
// 1. Usuario se registra con email@example.com + password
// 2. Usuario intenta OAuth con mismo email@example.com
// 3. Sistema detecta email existente
// 4. Vincula cuenta OAuth al usuario existente
// 5. Usuario puede usar ambos métodos de login

// Implementación en callback:
const existingUser = await prisma.user.findUnique({
  where: { email: profile.email }
})

if (existingUser) {
  // Vincular cuenta OAuth existente
  await prisma.account.upsert({
    where: {
      provider_providerAccountId: {
        provider: 'google',
        providerAccountId: profile.id
      }
    },
    update: { /* actualizar tokens */ },
    create: { /* crear nueva vinculación */ }
  })
}
```

## 📊 Métricas y Monitoreo

### Health Check Endpoint
```typescript
GET /api/health
Response: {
  "ok": true,
  "db": "ok"
}
```

### Logging Implementado
```typescript
// Todos los endpoints tienen logging detallado
console.log('[auth/register] attempt:', { email, username })
console.error('[auth/register] error:', error)
console.log('[auth/google/callback] success:', { userId, email })
```

## 🧪 Testing Requerido

### Casos de Prueba Críticos
```typescript
// Registro tradicional
✅ Email único
✅ Username único  
⚠️ Creación de UserProfile (pendiente avatarUrl)

// Login tradicional
✅ Credenciales válidas
✅ Hash de contraseña
⚠️ Persistencia de sesión (requiere testing)

// OAuth Google
✅ Autorización
✅ Callback
⚠️ Persistencia cross-domain (requiere testing)
⚠️ Vinculación de cuentas (requiere testing)
```

---

**Esta documentación técnica proporciona el contexto completo para continuar el desarrollo y debugging del sistema de autenticación.**
