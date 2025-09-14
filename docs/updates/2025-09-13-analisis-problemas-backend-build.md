# Análisis Detallado de Problemas de Build del Backend - 2025-09-13

## **Mapeo Completo de Errores TypeScript**

### **1. Errores en `src/index.ts`**

#### **Error de importación cookie-parser**
```typescript
// Línea 4
import cookieParser from 'cookie-parser'
// Error: TS7016 - Could not find declaration file
```
**Causa**: Aunque `@types/cookie-parser` está en package.json, TypeScript no lo resuelve correctamente.

#### **Errores de relaciones Prisma**
```typescript
// Línea 80 - Error TS2561
include: { user: true }
// Debería ser: include: { User: true }

// Línea 89 - Error TS2339
session.user
// Debería ser: session.User

// Líneas 206, 211, 212 - Error TS2353
name: profile.name,    // Campo no existe en User
image: profile.image   // Campo no existe en User
```

#### **Errores de IDs faltantes**
```typescript
// Línea 228 - Error TS2322
// Falta campo 'id' requerido en AccountUncheckedCreateInput

// Línea 243 - Error TS2322  
// Falta campo 'id' requerido en SessionUncheckedCreateInput

// Línea 323 - Error TS2322
// Falta campo 'id' requerido en LibraryLikeUncheckedCreateInput
```

### **2. Errores en `src/routes/catalog.ts`**

#### **Modelo inexistente**
```typescript
// Líneas 36, 52, 93, 375, 513, 570
prisma.artist.findMany()
// Error: Property 'artist' does not exist
// Debería ser: prisma.artistProfile.findMany()
```

#### **Campos eliminados del esquema**
```typescript
// Album model - campos que el código espera pero no existen:
album.releaseDate     // Líneas 211, 294
album.coverUrl        // Líneas 213, 296  
album.recordLabel     // Líneas 218, 301
album.catalogNumber   // Línea 302
album.likeCount       // Líneas 220, 304

// Relaciones incorrectas:
album.artist          // Líneas 222-224, 306-312
album.albumGenres     // Líneas 226, 318
album.tracks          // Línea 323
album.covers          // Línea 343
```

#### **Modelos faltantes**
```typescript
// Línea 447
prisma.genre.findMany()
// Error: Property 'genre' does not exist

// Línea 500  
prisma.trendingContent.findMany()
// Error: Property 'trendingContent' does not exist
```

#### **Errores de include/select**
```typescript
// Línea 191
_count: { tracks: true }
// Error: 'tracks' does not exist, should be 'Track'

// Línea 257
include: { artist: true }
// Error: 'artist' does not exist, should be 'ArtistProfile'

// Línea 425
include: { album: true }
// Error: 'album' does not exist, should be 'Album'
```

### **3. Errores en `src/routes/upload.ts`**

```typescript
// Línea 23
multer.diskStorage({ error: (error) => { /* */ } })
// Error: TS2345 - Argument type 'unknown' not assignable to 'Error | null'

// Línea 162  
callback(error)
// Error: TS2345 - Argument type 'Error' not assignable to 'null'
```

### **4. Errores en `src/services/album-utils.ts`**

```typescript
// Línea 117
prisma.artist.findFirst()
// Error: Property 'artist' does not exist

// Línea 119
where: { isPublic: true }
// Error: Property 'isPublic' does not exist in TrackWhereInput
```

## **Análisis de Dependencias del Código**

### **Funcionalidades que requieren modelos complejos**

#### **Sistema de Géneros**
- **Archivos afectados**: `catalog.ts` (líneas 65, 124, 226, 318, 447)
- **Modelos requeridos**: `Genre`, `AlbumGenre`, `ArtistGenre`
- **Funcionalidad**: Categorización y filtrado por géneros musicales

#### **Sistema de Covers**
- **Archivos afectados**: `catalog.ts` (línea 343)
- **Modelos requeridos**: `AlbumCover`
- **Funcionalidad**: Múltiples fuentes de portadas (MusicBrainz, iTunes, manual)

#### **Sistema de Trending**
- **Archivos afectados**: `catalog.ts` (líneas 500-552)
- **Modelos requeridos**: `TrendingContent`
- **Funcionalidad**: Contenido en tendencia por períodos

#### **Metadatos Extendidos de Álbum**
- **Campos requeridos**: `releaseDate`, `recordLabel`, `catalogNumber`, `likeCount`, `coverUrl`
- **Funcionalidad**: Información detallada de releases

### **Funcionalidades Core (Mínimas)**

#### **Autenticación OAuth**
- **Modelos**: `User`, `Account`, `Session`
- **Campos críticos**: `User.name`, `User.image` (para perfil OAuth)
- **Estado**: Parcialmente funcional

#### **Catálogo Básico**
- **Modelos**: `Album`, `Track`, `ArtistProfile`
- **Funcionalidad**: Listado y búsqueda básica
- **Estado**: Requiere correcciones de nombres

#### **Playlists y Likes**
- **Modelos**: `Playlist`, `PlaylistItem`, `LibraryLike`
- **Estado**: Funcional con correcciones menores

## **Estrategia de Corrección Recomendada**

### **Fase 1: Correcciones Críticas (Deployment Mínimo)**

#### **1.1 Corregir `src/index.ts`**
```typescript
// Cambios requeridos:
- Añadir User.name y User.image al esquema O eliminar del código
- Corregir session.user → session.User
- Añadir @default(cuid()) a IDs faltantes en esquema
- Verificar importación cookie-parser
```

#### **1.2 Simplificar `src/routes/catalog.ts`**
```typescript
// Cambios requeridos:
- prisma.artist → prisma.artistProfile
- Eliminar referencias a géneros (líneas 65, 124, 226, 318, 447)
- Eliminar trending content (líneas 500-552)
- Eliminar covers (línea 343)
- Simplificar metadatos de álbum
```

#### **1.3 Corregir `src/routes/upload.ts`**
```typescript
// Cambios requeridos:
- Corregir tipos de callbacks multer
- Verificar manejo de errores
```

#### **1.4 Corregir `src/services/album-utils.ts`**
```typescript
// Cambios requeridos:
- prisma.artist → prisma.artistProfile
- Eliminar filtro isPublic de Track O añadirlo al esquema
```

### **Fase 2: Funcionalidades Avanzadas (Post-Deployment)**

#### **2.1 Restaurar Sistema de Géneros**
- Re-añadir modelos `Genre`, `AlbumGenre`, `ArtistGenre`
- Restaurar lógica de categorización
- Migrar datos existentes

#### **2.2 Implementar Sistema de Covers**
- Re-añadir modelo `AlbumCover`
- Integrar con MusicBrainz y iTunes APIs
- Implementar cache de imágenes

#### **2.3 Sistema de Trending**
- Re-añadir modelo `TrendingContent`
- Implementar algoritmo de trending
- Configurar jobs periódicos

### **Fase 3: Optimizaciones**

#### **3.1 Performance**
- Optimizar queries complejas
- Implementar paginación
- Cache de resultados frecuentes

#### **3.2 Robustez**
- Manejo de errores mejorado
- Validación de datos
- Rate limiting específico

## **Modificaciones Específicas Requeridas**

### **Esquema Prisma - Cambios Mínimos**

```prisma
model User {
  id            String         @id @default(cuid())
  email         String         @unique
  name          String?        // AÑADIR para OAuth
  image         String?        // AÑADIR para OAuth
  googleId      String?        @unique
  // ... resto igual
}

model LibraryLike {
  id         String   @id @default(cuid()) // AÑADIR default
  // ... resto igual
}

model Playlist {
  id           String         @id @default(cuid()) // AÑADIR default
  // ... resto igual
}

model PlaylistItem {
  id         String   @id @default(cuid()) // AÑADIR default
  // ... resto igual
}

model Session {
  id           String   @id @default(cuid()) // AÑADIR default
  // ... resto igual
}

model Track {
  // ... campos existentes
  isPublic     Boolean        @default(true) // AÑADIR si se necesita
  // ... resto igual
}
```

### **Código Backend - Cambios Mínimos**

#### **`src/index.ts`**
```typescript
// Línea 80, 267
include: { User: true } // Cambiar de 'user' a 'User'

// Línea 89, 277  
session.User // Cambiar de 'session.user' a 'session.User'

// Líneas 206, 211, 212 - SI User.name/image se añaden al esquema:
name: profile.name,    // Mantener
image: profile.image   // Mantener

// O SI se eliminan del código:
// Eliminar estas líneas completamente
```

#### **`src/routes/catalog.ts`**
```typescript
// Cambiar TODAS las ocurrencias:
prisma.artist → prisma.artistProfile

// Eliminar o comentar secciones problemáticas:
// - Líneas 65, 124, 226, 318: lógica de géneros
// - Líneas 447-460: endpoint de géneros  
// - Líneas 500-552: trending content
// - Línea 343: covers

// Simplificar metadatos de álbum:
// Eliminar referencias a campos inexistentes
```

## **Checklist de Verificación Pre-Deployment**

### **Build Local**
- [ ] `npm install` sin errores
- [ ] `npx prisma generate` exitoso
- [ ] `npx tsc --noEmit` sin errores TypeScript
- [ ] `npm run build` exitoso
- [ ] `npm start` funciona localmente

### **Funcionalidad Mínima**
- [ ] `/health` responde correctamente
- [ ] `/api/test` responde correctamente  
- [ ] `/api/db-test` conecta a base de datos
- [ ] Rutas básicas de catálogo funcionan
- [ ] Sistema de autenticación básico funciona

### **Configuración Render**
- [ ] Variables de entorno configuradas
- [ ] Build command correcto
- [ ] Start command correcto
- [ ] Conexión a Supabase verificada
- [ ] Conexión a Redis verificada

## **Riesgos y Mitigaciones**

### **Riesgo: Pérdida de Funcionalidad**
- **Mitigación**: Documentar exactamente qué se elimina temporalmente
- **Plan**: Roadmap claro para restaurar funcionalidades

### **Riesgo: Datos Incompatibles**
- **Mitigación**: Backup de base de datos antes de cambios
- **Plan**: Scripts de migración para cambios de esquema

### **Riesgo: Regresiones**
- **Mitigación**: Testing exhaustivo de funcionalidades core
- **Plan**: Rollback plan si deployment falla

## **Conclusión**

El backend requiere refactoring significativo para ser compatible con el esquema actual de Prisma. La estrategia recomendada es un deployment mínimo funcional seguido de restauración incremental de funcionalidades avanzadas.

**Tiempo estimado para Phase 1**: 2-3 horas de desarrollo + testing
**Tiempo estimado para deployment exitoso**: 4-6 horas total
