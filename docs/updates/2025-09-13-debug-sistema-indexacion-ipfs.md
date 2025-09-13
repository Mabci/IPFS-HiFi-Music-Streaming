# Debug del Sistema de Indexación IPFS - 13 Septiembre 2025

## Resumen Ejecutivo

Durante esta sesión se trabajó en resolver errores críticos del sistema de indexación automática para álbumes musicales en IPFS. Se identificaron y abordaron múltiples problemas relacionados con el parser de manifests, sincronización de esquemas de base de datos y acceso a gateways IPFS.

**Estado Final**: Sistema parcialmente funcional con workarounds implementados, pero aún presenta errores de esquema de base de datos que impiden la indexación completa.

## Contexto Inicial

### Problema Principal
El sistema de indexación fallaba al procesar un CID real (`bafybeiby6cg5pii2gvaclwso7izh2gpsma76zz52fi3cwsv3snpf3lvaxm`) con el error:
```
Error: Manifest missing album section
```

### Arquitectura Existente
- **Backend**: Node.js + Express + Prisma + PostgreSQL (Supabase)
- **Indexador**: `IPFSIndexer` service con acceso híbrido P2P + Gateway HTTP
- **Base de datos**: Supabase PostgreSQL con modelos Artist, Album, Track, AudioQuality
- **API**: Endpoints REST en `/api/indexing/`

## Problemas Identificados y Soluciones Implementadas

### 1. Parser de Manifest Inflexible

**Problema**: El parser original esperaba una estructura específica con sección `album`, pero el manifest real tenía estructura diferente.

**Manifest Esperado**:
```json
{
  "album": {
    "name": "Album Name",
    "artist": "Artist Name"
  },
  "tracks": [...]
}
```

**Manifest Real**:
```json
{
  "version": "1.0",
  "type": "progressive_album", 
  "tracks": [
    {
      "name": "01 - Love for people",
      "directory": "01 - Love for people_progressive",
      "metadata": {
        "title": "01 - Love for people",
        "track": 0
      }
    }
  ]
}
```

**Solución Implementada**:
- Creado método `normalizeManifest()` que convierte diferentes estructuras a forma canónica
- Agregado parsing de JSON malformado (comas extra)
- Extracción inteligente de artista/álbum desde tracks cuando no están en la raíz
- Inferencia de nombres desde directorios de tracks

**Archivos Modificados**:
- `backend/src/services/ipfs-indexer.ts`: Líneas 174-187, 452-538

### 2. Error de Upsert en Modelo Artist

**Problema**: El modelo `Artist` no tenía campo `name` como único, causando error en `prisma.artist.upsert()`.

**Error Original**:
```
Type '{ name: string; }' is not assignable to type 'ArtistWhereUniqueInput'
```

**Solución Implementada**:
- Reemplazado `upsert` con estrategia `findFirst` + `create/update`
- Lógica de preservación de datos existentes

**Código Antes**:
```typescript
return await prisma.artist.upsert({
  where: { name: artistData.name }, // ERROR: name no es único
  // ...
})
```

**Código Después**:
```typescript
let artist = await prisma.artist.findFirst({
  where: { name: artistData.name }
})
if (artist) {
  // actualizar
} else {
  // crear
}
```

### 3. Problemas de Sincronización Prisma-Supabase

**Problema**: Desincronización entre esquema Prisma local y estructura real de base de datos Supabase.

**Errores Encontrados**:
```
The column `Artist.bio` does not exist in the current database
FATAL: Tenant or user not found
Can't reach database server at aws-1-us-east-2.pooler.supabase.com:6543
P3005: The database schema is not empty
```

**Soluciones Intentadas**:
1. `npx prisma migrate resolve --applied` para marcar migraciones como aplicadas
2. `npx prisma db pull --force` para sincronizar esquema
3. `npx prisma generate --force` para regenerar cliente
4. Limpieza de cache: `Remove-Item -Recurse -Force node_modules\.prisma`

**Solución Final Implementada**:
- Reemplazado acceso ORM con consultas SQL directas usando `prisma.$queryRaw`
- Evita problemas de esquema desincronizado

**Código SQL Directo**:
```typescript
const existingArtist = await prisma.$queryRaw`
  SELECT id, name, country, genres, "isVerified", "followerCount", "createdAt", "updatedAt"
  FROM "Artist" 
  WHERE name = ${artistData.name} 
  LIMIT 1
` as any[]
```

### 4. Acceso IPFS Fallido

**Problema**: El acceso P2P directo a IPFS fallaba consistentemente, causando timeouts.

**Error**:
```
[IPFSIndexer] IPFS direct access failed, trying gateway
[IPFSIndexer] No manifest found or accessible
```

**Solución Implementada**:
- Eliminado acceso IPFS directo (Helia)
- Configurado modo "gateway-only" 
- Simplificado método `initialize()` para no crear nodo IPFS
- Mejorado logging y timeout para requests HTTP

**Código Modificado**:
```typescript
async initialize() {
  // Usar exclusivamente gateway HTTP - no inicializar nodo IPFS
  console.log('[IPFSIndexer] Initialized in gateway-only mode')
}

private async loadAlbumManifest(albumCid: string): Promise<AlbumManifest | null> {
  // Usar exclusivamente gateway HTTP
  const manifestUrl = `${this.gatewayUrl}/ipfs/${albumCid}/album.json`
  const response = await axios.get(manifestUrl, { 
    timeout: 15000,
    headers: { 'Accept': 'application/json, text/plain, */*' }
  })
  return response.data
}
```

## Resultados de Testing

### Manifest Loading - ✅ EXITOSO
- URL verificada: `https://gateway.pinata.cloud/ipfs/bafybeiby6cg5pii2gvaclwso7izh2gpsma76zz52fi3cwsv3snpf3lvaxm/album.json`
- Manifest cargado correctamente desde gateway
- JSON malformado parseado exitosamente

### Normalización - ✅ EXITOSO  
- 8 tracks detectados correctamente
- Estructura canónica generada
- Artista inferido como "Unknown Artist" (mejorable)
- Álbum inferido como "01" (mejorable)

### Base de Datos - ❌ FALLA PERSISTENTE
- Error persistente: `The column Artist.bio does not exist in the current database`
- Consultas SQL directas implementadas pero no probadas completamente
- Supabase conectado correctamente

## Archivos Modificados

### `backend/src/services/ipfs-indexer.ts`
**Cambios Principales**:
- Líneas 105-108: Simplificado `initialize()` para modo gateway-only
- Líneas 138-158: Reescrito `loadAlbumManifest()` para usar solo gateway HTTP
- Líneas 174-187: Agregado parsing flexible de JSON malformado
- Líneas 342-380: Reemplazado `upsertArtist()` con consultas SQL directas
- Líneas 452-538: Implementado `normalizeManifest()` para múltiples formatos

**Interfaces Agregadas**:
- `NormalizedAlbumManifest`: Estructura canónica post-normalización

**Métodos Agregados**:
- `normalizeManifest()`: Convierte diferentes estructuras a forma canónica
- `getBasename()`: Extrae nombres de archivo limpiando rutas/prefijos
- `extractQualityFile()`: Procesa diferentes representaciones de calidad de audio

## Problemas Pendientes

### 1. Sincronización de Esquema Prisma-Supabase
**Descripción**: Desincronización persistente entre esquema local y base de datos real.

**Síntomas**:
- Error `Artist.bio` column not found
- Comandos `prisma db pull` y `prisma generate` no resuelven el problema
- Cliente Prisma generado no coincide con estructura real

**Próximos Pasos**:
1. Verificar estructura real de tablas en Supabase dashboard
2. Comparar con `schema.prisma` local
3. Considerar recrear migraciones desde cero
4. Evaluar usar exclusivamente consultas SQL directas

### 2. Mejora de Inferencia de Metadatos
**Descripción**: El parser normalizado infiere "Unknown Artist" y álbum como "01".

**Mejoras Necesarias**:
- Extraer artista desde nombres de tracks (ej: "Shiro Sagisu - Track Name")
- Inferir nombre de álbum desde directorio padre o patrones comunes
- Agregar soporte para metadatos ID3 embebidos

### 3. Validación de Indexación Completa
**Descripción**: No se pudo completar una indexación end-to-end exitosa.

**Pendiente**:
- Resolver errores de base de datos
- Probar inserción de Artist, Album, Track, AudioQuality
- Validar actualización de estadísticas globales
- Verificar endpoints de consulta

## Comandos de Testing

### Levantar Servidor
```powershell
cd "C:\Users\Mabci\Documents\Plataforma de musica IPFS\backend"
npm run dev
```

### Probar Indexación
```powershell
$Body = @{
  albumCid = "bafybeiby6cg5pii2gvaclwso7izh2gpsma76zz52fi3cwsv3snpf3lvaxm"
  gatewayUrl = "https://gateway.pinata.cloud"
} | ConvertTo-Json

Invoke-RestMethod -Method POST -Uri "http://localhost:4000/api/indexing/album" -ContentType "application/json" -Body $Body
```

### Sincronizar Prisma (Intentos)
```powershell
npx prisma migrate resolve --applied 20250822031317_init
npx prisma migrate resolve --applied 20250905_add_catalog_features
npx prisma db pull --force
npx prisma generate --force
```

## Logs de Debugging

### Manifest Loading Exitoso
```
[IPFSIndexer] Loading manifest from: https://gateway.pinata.cloud/ipfs/bafybeiby6cg5pii2gvaclwso7izh2gpsma76zz52fi3cwsv3snpf3lvaxm/album.json
[IPFSIndexer] Manifest loaded successfully from gateway
```

### Normalización Exitosa
```
[IPFSIndexer] Normalized manifest: {
  "album": { "name": "01", "artist": "Unknown Artist" },
  "tracks": [ /* 8 tracks */ ],
  "trackCount": 8
}
```

### Error Persistente de Base de Datos
```
PrismaClientKnownRequestError: Invalid `prisma.artist.findFirst()` invocation
The column `Artist.bio` does not exist in the current database.
```

## Recomendaciones para Continuación

### Prioridad Alta
1. **Resolver Sincronización Prisma**: Investigar estructura real de Supabase vs esquema local
2. **Completar Testing SQL Directo**: Validar que las consultas `$queryRaw` funcionen
3. **Probar Indexación End-to-End**: Una vez resuelto DB, completar flujo completo

### Prioridad Media  
1. **Mejorar Inferencia de Metadatos**: Extraer artista/álbum de nombres de tracks
2. **Agregar Validaciones**: Verificar CIDs, timeouts, formatos de manifest
3. **Optimizar Performance**: Cache de manifests, conexión DB pool

### Prioridad Baja
1. **Restaurar Acceso P2P**: Una vez estable el gateway, reintegrar Helia opcional
2. **Métricas y Monitoring**: Logs estructurados, métricas de indexación
3. **Testing Automatizado**: Unit tests para parser, integration tests para API

## Conclusiones

Esta sesión logró avances significativos en la robustez del parser de manifests y la arquitectura de acceso a IPFS, pero reveló problemas fundamentales de sincronización entre el ORM Prisma y la base de datos Supabase. 

El sistema está cerca de ser funcional, pero requiere resolver la desincronización de esquemas antes de poder completar indexaciones exitosas. Las soluciones implementadas (parser flexible, modo gateway-only, consultas SQL directas) proporcionan una base sólida para continuar el desarrollo.

**Tiempo Invertido**: ~3 horas de debugging intensivo
**Progreso**: 70% - Sistema funcional excepto por problemas de base de datos
**Próximo Milestone**: Indexación exitosa end-to-end con inserción en base de datos
