-- Migración completa del sistema de autenticación
-- Agrega soporte para email/password + mejora OAuth + username único

-- Agregar campos de autenticación email/password al modelo User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" TIMESTAMP(3);

-- Remover campos obsoletos si existen (por si acaso)
ALTER TABLE "User" DROP COLUMN IF EXISTS "name";
ALTER TABLE "User" DROP COLUMN IF EXISTS "image";

-- Asegurar que username en UserProfile sea único
DROP INDEX IF EXISTS "UserProfile_username_key";
CREATE UNIQUE INDEX "UserProfile_username_key" ON "UserProfile"("username");

-- Índices para performance en autenticación
CREATE INDEX IF NOT EXISTS "User_email_verified_idx" ON "User"("emailVerified");
CREATE INDEX IF NOT EXISTS "Account_provider_idx" ON "Account"("provider");
CREATE INDEX IF NOT EXISTS "Account_type_idx" ON "Account"("type");

-- Actualizar Account para soportar múltiples tipos de autenticación
-- El campo 'type' puede ser 'oauth' para Google o 'credentials' para email/password
-- El campo 'provider' puede ser 'google' o 'credentials'
