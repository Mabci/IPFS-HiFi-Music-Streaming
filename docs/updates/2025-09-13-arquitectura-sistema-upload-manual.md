# Arquitectura del Sistema de Upload Manual - 13 Septiembre 2025

## Resumen Ejecutivo

Se define la arquitectura completa del nuevo sistema de upload manual de música que reemplazará el sistema de indexación automática problemático. El nuevo sistema permite a los usuarios subir música con metadatos manuales, eliminando todos los problemas técnicos de inferencia automática y manifests IPFS.

## Motivación del Cambio

### Problemas del Sistema Actual
- **Desincronización Prisma-Supabase persistente**
- **Inferencia de metadatos deficiente** ("Unknown Artist", álbumes como "01")
- **Complejidad innecesaria** de parsing de manifests
- **Errores de esquema de base de datos** no resueltos
- **Timeouts frecuentes** en acceso P2P IPFS

### Ventajas del Nuevo Sistema
- **Metadatos precisos** proporcionados por usuarios
- **Eliminación de parsing complejo** de manifests
- **Control total del usuario** sobre su contenido
- **Arquitectura más simple** y mantenible
- **Mejor UX** para artistas y consumidores

## Arquitectura General

### Dominios y Separación de Funcionalidades
```
midominio.com/
├── Consumidores (streaming, búsqueda, playlists)
├── Perfiles públicos de usuarios
└── Biblioteca personal

artist.midominio.com/
├── Upload de música
├── Gestión de contenido
├── Analytics de artista
└── Configuración de perfil de artista
```

### Sistema Dual de Perfiles

#### Perfil Personal (UserProfile)
- **Propósito**: Consumo y socialización musical
- **Funcionalidades**:
  - Playlists personales (públicas/privadas)
  - Historial de "me gusta"
  - Historial de escucha
  - Seguimiento de artistas
  - Compartir gustos musicales

#### Perfil de Artista (ArtistProfile)
- **Activación**: Automática al subir primer contenido
- **Funcionalidades**:
  - Gestión de álbumes subidos
  - Analytics detallados de reproducciones
  - Estadísticas de seguidores
  - Configuración de perfil público
  - Monetización (futuro)

## Flujo de Upload Detallado

### Página 1: Upload de Archivos
**URL**: `artist.midominio.com/upload`

**Funcionalidades**:
- Upload múltiple de archivos de audio
- **Formatos soportados**: WAV, FLAC, MP3, M4A (AAC)
- Validación de formatos en tiempo real
- Barra de progreso de upload
- Detección automática de cantidad de tracks

**Validaciones**:
- Tamaño máximo por archivo: 100MB
- Formatos de audio válidos únicamente
- Mínimo 1 track, máximo 50 tracks por álbum

### Página 2: Orden y Nombres de Pistas
**URL**: `artist.midominio.com/upload/tracks`

**Funcionalidades**:
- **Extracción automática de metadatos**:
  - Título desde metadatos ID3/FLAC o nombre de archivo
  - Número de track desde metadatos o posición de upload
- **Interfaz drag-and-drop** para reordenamiento
- **Fallbacks inteligentes**:
  - Sin metadatos → usar nombre de archivo
  - Sin números → respetar orden de upload
- Edición inline de nombres de tracks

**Componentes UI**:
```tsx
<TrackReorderList>
  <DraggableTrack />
  <TrackMetadataExtractor />
  <TrackOrderControls />
</TrackReorderList>
```

### Página 3: Metadatos del Álbum
**URL**: `artist.midominio.com/upload/metadata`

**Campos Obligatorios**:
- Nombre del álbum
- Nombre del artista
- Año de lanzamiento
- Género musical
- Descripción del álbum
- Portada del álbum (imagen)

**Funcionalidades Adicionales**:
- **Modal de reordenamiento final** de tracks
- Preview de portada con crop automático
- Validación de campos en tiempo real
- Autocompletado de géneros musicales

**Validaciones**:
- Todos los campos son obligatorios
- Año entre 1900 y año actual + 1
- Portada: JPG/PNG, máximo 5MB, mínimo 500x500px
- Descripción: máximo 1000 caracteres

### Página 4: Preview Final
**URL**: `artist.midominio.com/upload/preview`

**Funcionalidades**:
- Vista previa completa del álbum
- Lista de tracks con orden final
- Preview de portada
- Resumen de metadatos
- Estimación de tiempo de procesamiento
- Botón de confirmación para iniciar procesamiento

## Procesamiento Backend

### Cola de Trabajos (Redis/Bull)
**Propósito**: Manejar transcodificación asíncrona sin bloquear la UI

**Flujo de Procesamiento**:
```
1. Usuario confirma upload
2. Crear job en cola Redis
3. Respuesta inmediata al usuario con job ID
4. Worker procesa job en background
5. Notificación WebSocket al completar
```

**Configuración de Cola**:
- **Concurrencia**: 2-3 jobs simultáneos
- **Reintentos**: 3 intentos automáticos
- **Timeout**: 30 minutos por job
- **Prioridad**: FIFO (First In, First Out)

### Transcodificación en VPS

**Calidades de Audio**:
- **LOW**: AAC 128kbps M4A (compatibilidad universal)
- **HIGH**: FLAC 16-bit/44.1kHz (calidad CD)
- **MAX**: FLAC original o 24-bit/96kHz (Hi-Res)

**Proceso de Transcodificación**:
```bash
# LOW quality
ffmpeg -i input.wav -c:a aac -b:a 128k -f mp4 low.m4a

# HIGH quality  
ffmpeg -i input.wav -c:a flac -sample_fmt s16 -ar 44100 high.flac

# MAX quality (preservar original si es FLAC/WAV)
ffmpeg -i input.wav -c:a flac -sample_fmt s32 -ar 96000 max.flac
```

### Estructura en IPFS (Sin Manifests)

**Directorio del Álbum**:
```
/ipfs/QmAlbumHash/
├── 01-love-for-people/
│   ├── low.m4a
│   ├── high.flac
│   └── max.flac
├── 02-message-of-love/
│   ├── low.m4a
│   ├── high.flac
│   └── max.flac
├── 03-black-snow/
│   ├── low.m4a
│   ├── high.flac
│   └── max.flac
└── cover.jpg
```

**Ventajas de esta Estructura**:
- **Sin manifests JSON**: Todos los metadatos en base de datos
- **Organización clara**: Una carpeta por track
- **Acceso directo**: CID individual por calidad
- **Escalabilidad**: Fácil agregar nuevas calidades

## Esquema de Base de Datos

### Tablas Principales

```sql
-- Usuario base (autenticación)
CREATE TABLE "User" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  googleId VARCHAR(255) UNIQUE,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

-- Perfil personal del usuario
CREATE TABLE "UserProfile" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userId UUID REFERENCES "User"(id) ON DELETE CASCADE,
  username VARCHAR(50) UNIQUE NOT NULL,
  displayName VARCHAR(100) NOT NULL,
  bio TEXT,
  avatarUrl TEXT,
  isPublic BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

-- Perfil de artista (opcional)
CREATE TABLE "ArtistProfile" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userId UUID REFERENCES "User"(id) ON DELETE CASCADE,
  artistName VARCHAR(100) NOT NULL,
  bio TEXT,
  isVerified BOOLEAN DEFAULT false,
  followerCount INTEGER DEFAULT 0,
  totalPlays BIGINT DEFAULT 0,
  totalAlbums INTEGER DEFAULT 0,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

-- Álbumes
CREATE TABLE "Album" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artistProfileId UUID REFERENCES "ArtistProfile"(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  year INTEGER NOT NULL,
  genre VARCHAR(100) NOT NULL,
  coverCid VARCHAR(100) NOT NULL,
  albumCid VARCHAR(100) NOT NULL,
  totalTracks INTEGER NOT NULL,
  totalDurationSec INTEGER NOT NULL,
  uploadedAt TIMESTAMP DEFAULT NOW(),
  isPublic BOOLEAN DEFAULT true,
  playCount BIGINT DEFAULT 0
);

-- Tracks individuales
CREATE TABLE "Track" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  albumId UUID REFERENCES "Album"(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  trackNumber INTEGER NOT NULL,
  durationSec INTEGER NOT NULL,
  trackCid VARCHAR(100) NOT NULL, -- CID de la carpeta del track
  lowQualityCid VARCHAR(100) NOT NULL,
  highQualityCid VARCHAR(100) NOT NULL,
  maxQualityCid VARCHAR(100) NOT NULL,
  playCount BIGINT DEFAULT 0,
  createdAt TIMESTAMP DEFAULT NOW()
);

-- Jobs de procesamiento
CREATE TABLE "ProcessingJob" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userId UUID REFERENCES "User"(id) ON DELETE CASCADE,
  jobId VARCHAR(100) NOT NULL, -- Redis job ID
  status VARCHAR(50) NOT NULL, -- pending, processing, completed, failed
  albumData JSONB NOT NULL, -- Metadatos temporales
  errorMessage TEXT,
  createdAt TIMESTAMP DEFAULT NOW(),
  completedAt TIMESTAMP
);
```

## Sistema de Notificaciones WebSocket

### Eventos de Notificación
```typescript
interface ProcessingNotification {
  jobId: string
  status: 'started' | 'transcoding' | 'uploading' | 'indexing' | 'completed' | 'failed'
  progress: number // 0-100
  message: string
  albumId?: string // Solo cuando se completa
  error?: string // Solo en caso de fallo
}
```

### Implementación WebSocket
```typescript
// Cliente (Frontend)
const socket = io('artist.midominio.com')
socket.on('processing-update', (notification: ProcessingNotification) => {
  updateUploadProgress(notification)
})

// Servidor (Backend)
io.to(userId).emit('processing-update', {
  jobId: job.id,
  status: 'transcoding',
  progress: 45,
  message: 'Transcodificando track 3 de 8...'
})
```

## API Endpoints

### Upload Endpoints
```typescript
// Iniciar upload
POST /api/upload/start
Body: { files: FileList }
Response: { uploadId: string, uploadUrls: string[] }

// Confirmar metadatos y procesar
POST /api/upload/process
Body: { 
  uploadId: string,
  metadata: AlbumMetadata,
  trackOrder: TrackOrder[]
}
Response: { jobId: string }

// Estado del procesamiento
GET /api/upload/status/:jobId
Response: ProcessingStatus

// Cancelar procesamiento
DELETE /api/upload/cancel/:jobId
```

### Búsqueda Simple
```typescript
// Búsqueda unificada
GET /api/search?q=query&type=all|artist|album|track&limit=20
Response: {
  artists: ArtistResult[],
  albums: AlbumResult[],
  tracks: TrackResult[]
}

// Implementación SQL
SELECT * FROM "Album" a
JOIN "ArtistProfile" ap ON a.artistProfileId = ap.id
WHERE 
  a.title ILIKE '%query%' OR 
  ap.artistName ILIKE '%query%' OR
  a.id IN (
    SELECT albumId FROM "Track" 
    WHERE title ILIKE '%query%'
  )
```

## Componentes Reutilizables del Sistema Actual

### Del IPFSIndexer Actual
```typescript
// ✅ Mantener y adaptar
- upsertArtist() → createArtistProfile()
- calculateTotalDuration() → sin cambios
- updateGlobalStats() → expandir para artistas
- parseDuration() → sin cambios
- Conexión Prisma → migrar a nuevo esquema

// ❌ Eliminar completamente
- loadAlbumManifest()
- normalizeManifest()
- indexFromManifest()
- indexFromDirectoryScan()
- Todas las interfaces de manifests
- Acceso IPFS directo (Helia)
```

## Plan de Migración

### Fase 1: Eliminación del Sistema Actual
1. **Backup del código actual** en branch separado
2. **Eliminar archivos del indexador**:
   - `backend/src/services/ipfs-indexer.ts`
   - Endpoints `/api/indexing/*`
   - Interfaces y tipos relacionados
3. **Extraer componentes reutilizables** a nuevos servicios

### Fase 2: Implementación del Nuevo Sistema
1. **Actualizar esquema Prisma** con nuevas tablas
2. **Implementar cola Redis/Bull** para procesamiento
3. **Crear endpoints de upload** y metadatos
4. **Desarrollar UI de upload** en Next.js
5. **Configurar WebSockets** para notificaciones

### Fase 3: Testing y Deployment
1. **Testing end-to-end** del flujo completo
2. **Configurar VPS de transcodificación**
3. **Deploy a producción** con rollback plan
4. **Monitoreo y métricas** de adopción

## Métricas de Éxito

### Técnicas
- **Tiempo de procesamiento**: < 5 minutos por álbum de 10 tracks
- **Tasa de éxito**: > 95% de uploads completados
- **Tiempo de respuesta**: < 2 segundos para búsquedas
- **Disponibilidad**: > 99.5% uptime

### UX
- **Abandono en upload**: < 20% antes de completar
- **Satisfacción de artistas**: > 4.5/5 en encuestas
- **Tiempo de onboarding**: < 10 minutos primer álbum
- **Adopción**: > 50% de usuarios crean perfil de artista

## Consideraciones de Seguridad

### Upload de Archivos
- **Validación de tipos MIME** estricta
- **Escaneo de malware** en archivos subidos
- **Límites de rate limiting** por usuario
- **Cuotas de almacenamiento** por artista

### Autenticación y Autorización
- **JWT tokens** con expiración corta
- **Refresh tokens** seguros
- **Permisos granulares** por perfil
- **Audit logs** de acciones críticas

## Conclusiones

Este nuevo sistema de upload manual elimina completamente los problemas técnicos del sistema de indexación automática, proporcionando:

1. **Arquitectura más simple** y mantenible
2. **Metadatos precisos** controlados por usuarios
3. **Mejor experiencia** para artistas y consumidores
4. **Escalabilidad** para crecimiento futuro
5. **Flexibilidad** para nuevas funcionalidades

La implementación se realizará en fases para minimizar riesgos y permitir testing incremental de cada componente.
