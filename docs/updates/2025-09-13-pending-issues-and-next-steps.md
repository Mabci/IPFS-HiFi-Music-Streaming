# Problemas Pendientes y Próximos Pasos
**Fecha:** 13 de Septiembre, 2025  
**Estado:** Documentación de issues pendientes post-debugging

## 🚨 Problemas Críticos Pendientes

### 1. Error UserProfile.avatarUrl - ALTA PRIORIDAD
**Error Actual:**
```
[auth/register] error: PrismaClientKnownRequestError:
Invalid `prisma.user.findUnique()` invocation:
The column 'UserProfile.avatarUrl' does not exist in the current database.
```

**Análisis del Problema:**
- El código en `backend/src/index.ts` hace referencia a `avatarUrl`
- La tabla UserProfile fue creada con columna `avatar` (no `avatarUrl`)
- Inconsistencia entre esquema Prisma y implementación

**Ubicación del Error:**
- Archivo: `backend/src/index.ts` 
- Contexto: Registro tradicional con email/password
- Línea aproximada: Creación de UserProfile en registro

**Solución Requerida:**
Opción A: Agregar columna `avatarUrl` a UserProfile
```javascript
await prisma.$executeRaw`ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;`
```

Opción B: Modificar código para usar `avatar` en lugar de `avatarUrl`

**Impacto:**
- Bloquea completamente el registro tradicional
- OAuth puede estar afectado también
- Sistema de autenticación no funcional al 100%

### 2. Verificación de Persistencia de Sesiones OAuth
**Estado:** Requiere testing completo

**Cambios Aplicados:**
- Configuración de cookies cross-domain
- sameSite: 'none' para producción
- domain: '.nyauwu.com'

**Testing Requerido:**
- [ ] Iniciar sesión con Google OAuth
- [ ] Verificar que la sesión persiste al regresar
- [ ] Confirmar que el usuario aparece como autenticado
- [ ] Probar en diferentes navegadores

### 3. Vinculación de Cuentas por Email
**Estado:** No probado

**Funcionalidad Esperada:**
- Usuario se registra con email/password
- Mismo usuario inicia sesión con Google OAuth usando mismo email
- Cuentas deben vincularse automáticamente

**Testing Requerido:**
- [ ] Registro tradicional con email específico
- [ ] OAuth con mismo email
- [ ] Verificar vinculación en base de datos
- [ ] Confirmar que ambos métodos funcionan para mismo usuario

## ⚠️ Problemas Menores

### 1. Validación de Username Único
**Estado:** Implementado pero no probado

**Testing Requerido:**
- [ ] Intentar registrar username duplicado
- [ ] Verificar mensaje de error apropiado
- [ ] Confirmar que la validación funciona

### 2. Manejo de Errores en Frontend
**Estado:** Básico implementado

**Mejoras Pendientes:**
- Mensajes de error más específicos
- Validación en tiempo real
- Feedback visual mejorado

## 🔧 Tareas Técnicas Pendientes

### 1. Sincronización Final de Base de Datos
**Script Requerido:**
```javascript
// fix-avatarurl-column.js
import { PrismaClient } from '@prisma/client'

async function fixAvatarUrlColumn() {
  const prisma = new PrismaClient()
  
  try {
    // Agregar columna avatarUrl
    await prisma.$executeRaw`ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;`
    
    // Migrar datos de avatar a avatarUrl si existen
    await prisma.$executeRaw`UPDATE "UserProfile" SET "avatarUrl" = "avatar" WHERE "avatar" IS NOT NULL AND "avatarUrl" IS NULL;`
    
    // Verificar estructura
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'UserProfile' 
      AND column_name IN ('avatar', 'avatarUrl')
    `
    console.table(result)
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}
```

### 2. Testing Completo del Sistema
**Casos de Prueba Requeridos:**

#### Registro Tradicional:
- [ ] Registro exitoso con datos válidos
- [ ] Error con email duplicado
- [ ] Error con username duplicado
- [ ] Validación de contraseña débil
- [ ] Validación de email inválido

#### Login Tradicional:
- [ ] Login exitoso con credenciales correctas
- [ ] Error con credenciales incorrectas
- [ ] Error con usuario no existente
- [ ] Persistencia de sesión después del login

#### OAuth Google:
- [ ] Registro nuevo usuario con Google
- [ ] Login usuario existente con Google
- [ ] Vinculación con cuenta email existente
- [ ] Persistencia de sesión después de OAuth

### 3. Optimizaciones de Render Build
**Estado Actual:** Funcional pero puede mejorarse

**Build Command Actual:**
```yaml
buildCommand: npm ci && npx prisma db push --force-reset && npx prisma generate && npm run build
```

**Consideraciones:**
- `--force-reset` puede ser agresivo para producción
- Evaluar si es necesario para deployments futuros
- Considerar comando más conservador una vez estabilizado

## 📋 Plan de Acción Inmediato

### Sesión Siguiente - Prioridad Alta:
1. **Ejecutar script para arreglar avatarUrl** (15 min)
2. **Probar registro tradicional completo** (15 min)
3. **Probar OAuth completo con persistencia** (15 min)
4. **Verificar vinculación de cuentas** (15 min)

### Sesión Siguiente - Prioridad Media:
1. Mejorar manejo de errores en frontend
2. Agregar validaciones adicionales
3. Testing de edge cases
4. Optimizar configuración de Render

## 🎯 Criterios de Éxito

### Sistema Completamente Funcional Cuando:
- [ ] Registro tradicional funciona sin errores
- [ ] Login tradicional funciona sin errores
- [ ] OAuth Google funciona con persistencia de sesión
- [ ] Vinculación de cuentas por email funciona
- [ ] Validaciones de username único funcionan
- [ ] Manejo de errores es robusto
- [ ] No hay errores en logs de Render

### Métricas de Calidad:
- 0 errores en logs de producción
- Tiempo de respuesta < 2 segundos para auth
- 100% de casos de prueba pasando
- Documentación completa actualizada

## 📚 Recursos para Próxima Sesión

### Archivos Clave a Revisar:
- `backend/src/index.ts` - Lógica de autenticación
- `backend/src/services/auth-utils.ts` - Utilidades
- `frontend/app/auth/page.tsx` - Interfaz de usuario
- Logs de Render para debugging

### Scripts Disponibles:
- `backend/add-columns.js` - Agregar columnas
- `backend/create-userprofile-table.js` - Crear tablas
- Template para nuevos scripts en documentación

### Comandos Útiles:
```bash
# Testing local
npm run dev  # Frontend
npm run build  # Backend

# Base de datos
npx prisma studio  # Explorar BD
npx prisma generate  # Regenerar cliente

# Deployment
git push origin master  # Trigger Render deploy
```

---

**Nota:** Esta documentación debe ser el punto de partida para la próxima sesión. El sistema está muy cerca de estar completamente funcional, solo requiere resolver el error de `avatarUrl` y testing completo.
