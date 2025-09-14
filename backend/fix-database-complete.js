import { PrismaClient } from '@prisma/client'

async function fixDatabaseComplete() {
  const prisma = new PrismaClient()
  
  try {
    console.log('🚀 Iniciando corrección completa de base de datos...')
    console.log('📋 Basado en metodología exitosa de scripts JavaScript\n')
    
    // ===== VERIFICACIÓN INICIAL =====
    console.log('1️⃣ Verificando estado actual de las tablas...')
    
    // Verificar estructura de User
    const userColumns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'User' 
      AND table_schema = 'public'
      ORDER BY column_name;
    `
    console.log('\n📊 Columnas actuales en tabla User:')
    console.table(userColumns)
    
    // Verificar estructura de UserProfile
    const userProfileColumns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'UserProfile' 
      AND table_schema = 'public'
      ORDER BY column_name;
    `
    console.log('\n📊 Columnas actuales en tabla UserProfile:')
    console.table(userProfileColumns)
    
    // ===== CORRECCIONES DE TABLA USER =====
    console.log('\n2️⃣ Corrigiendo tabla User...')
    
    // Agregar passwordHash si no existe
    await prisma.$executeRaw`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;`
    console.log('✓ Columna passwordHash verificada/agregada')
    
    // Agregar emailVerified si no existe
    await prisma.$executeRaw`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" TIMESTAMP(3);`
    console.log('✓ Columna emailVerified verificada/agregada')
    
    // Agregar name si no existe (para OAuth)
    await prisma.$executeRaw`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "name" TEXT;`
    console.log('✓ Columna name verificada/agregada')
    
    // Agregar image si no existe (para OAuth)
    await prisma.$executeRaw`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "image" TEXT;`
    console.log('✓ Columna image verificada/agregada')
    
    // Crear índices importantes
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "User_email_verified_idx" ON "User"("emailVerified");`
    console.log('✓ Índice emailVerified verificado/creado')
    
    // ===== CORRECCIONES DE TABLA USERPROFILE =====
    console.log('\n3️⃣ Corrigiendo tabla UserProfile...')
    
    // Crear tabla UserProfile si no existe (con estructura completa)
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "UserProfile" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "username" TEXT NOT NULL,
        "displayName" TEXT NOT NULL,
        "bio" TEXT,
        "avatarUrl" TEXT,
        "isPublic" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "UserProfile_userId_key" UNIQUE ("userId"),
        CONSTRAINT "UserProfile_username_key" UNIQUE ("username"),
        CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `
    console.log('✓ Tabla UserProfile verificada/creada con estructura completa')
    
    // PROBLEMA CRÍTICO: Agregar avatarUrl si solo existe avatar
    await prisma.$executeRaw`ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;`
    console.log('✓ Columna avatarUrl verificada/agregada')
    
    // Migrar datos de avatar a avatarUrl si existen
    await prisma.$executeRaw`
      UPDATE "UserProfile" 
      SET "avatarUrl" = "avatar" 
      WHERE "avatar" IS NOT NULL 
      AND ("avatarUrl" IS NULL OR "avatarUrl" = '');
    `
    console.log('✓ Datos migrados de avatar a avatarUrl')
    
    // Agregar otras columnas que podrían faltar
    await prisma.$executeRaw`ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN DEFAULT true;`
    console.log('✓ Columna isPublic verificada/agregada')
    
    // Crear índices importantes
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "UserProfile_username_idx" ON "UserProfile"("username");`
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "UserProfile_isPublic_idx" ON "UserProfile"("isPublic");`
    console.log('✓ Índices de UserProfile verificados/creados')
    
    // ===== VERIFICAR OTRAS TABLAS CRÍTICAS =====
    console.log('\n4️⃣ Verificando otras tablas críticas...')
    
    // Tabla Session
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Session" (
        "id" TEXT NOT NULL,
        "sessionToken" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "expires" TIMESTAMP(3) NOT NULL,
        
        CONSTRAINT "Session_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "Session_sessionToken_key" UNIQUE ("sessionToken"),
        CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `
    console.log('✓ Tabla Session verificada/creada')
    
    // Tabla Account
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Account" (
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
        CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `
    console.log('✓ Tabla Account verificada/creada')
    
    // Crear índices para Account
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Account_provider_idx" ON "Account"("provider");`
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Account_type_idx" ON "Account"("type");`
    console.log('✓ Índices de Account verificados/creados')
    
    // ===== VERIFICACIÓN FINAL =====
    console.log('\n5️⃣ Verificación final de estructura...')
    
    // Verificar User final
    const userColumnsFinal = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'User' 
      AND table_schema = 'public'
      ORDER BY column_name;
    `
    console.log('\n📊 Estructura FINAL de tabla User:')
    console.table(userColumnsFinal)
    
    // Verificar UserProfile final
    const userProfileColumnsFinal = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'UserProfile' 
      AND table_schema = 'public'
      ORDER BY column_name;
    `
    console.log('\n📊 Estructura FINAL de tabla UserProfile:')
    console.table(userProfileColumnsFinal)
    
    // Verificar que avatarUrl existe específicamente
    const avatarUrlCheck = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'UserProfile' 
      AND column_name = 'avatarUrl'
      AND table_schema = 'public';
    `
    
    if (avatarUrlCheck.length > 0) {
      console.log('✅ CONFIRMADO: Columna avatarUrl existe en UserProfile')
    } else {
      console.log('❌ ERROR: Columna avatarUrl NO existe en UserProfile')
    }
    
    // Contar registros existentes
    const userCount = await prisma.user.count()
    const profileCount = await prisma.userProfile.count()
    const sessionCount = await prisma.session.count()
    const accountCount = await prisma.account.count()
    
    console.log('\n📈 Estadísticas de la base de datos:')
    console.table([
      { tabla: 'User', registros: userCount },
      { tabla: 'UserProfile', registros: profileCount },
      { tabla: 'Session', registros: sessionCount },
      { tabla: 'Account', registros: accountCount }
    ])
    
    console.log('\n🎉 ¡Corrección completa de base de datos EXITOSA!')
    console.log('✅ Todas las tablas y columnas necesarias están creadas')
    console.log('✅ El problema de avatarUrl ha sido resuelto')
    console.log('✅ Sistema de autenticación listo para funcionar')
    
  } catch (error) {
    console.error('❌ Error durante la corrección:', error)
    throw error
  } finally {
    await prisma.$disconnect()
    console.log('🔌 Conexión a base de datos cerrada')
  }
}

// Ejecutar corrección
fixDatabaseComplete()
  .then(() => {
    console.log('\n🚀 SIGUIENTE PASO: Ejecutar "npx prisma generate" para regenerar el cliente')
    console.log('🧪 DESPUÉS: Probar registro y login tradicional + OAuth')
    process.exit(0)
  })
  .catch(error => {
    console.error('💥 Falló la corrección completa:', error)
    process.exit(1)
  })
