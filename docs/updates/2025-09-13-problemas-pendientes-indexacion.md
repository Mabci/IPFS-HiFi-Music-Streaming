# Problemas Pendientes del Sistema de Indexación - 13 Septiembre 2025

## Estado Actual del Sistema

### ✅ Componentes Funcionando
- **Gateway HTTP Access**: Acceso exitoso a manifests via Pinata Gateway
- **Parser Flexible**: Normalización de diferentes estructuras de manifest
- **JSON Malformado**: Limpieza automática de comas extra y formato incorrecto
- **Servidor Backend**: Express + Prisma corriendo sin errores
- **API Endpoints**: Rutas de indexación disponibles y respondiendo

### ❌ Problemas Críticos Pendientes

#### 1. Desincronización Esquema Prisma-Supabase
**Error Principal**:
```
PrismaClientKnownRequestError: The column `Artist.bio` does not exist in the current database.
```

**Diagnóstico**:
- El esquema local `prisma/schema.prisma` incluye campos que no existen en Supabase
- Los comandos `prisma db pull` y `prisma generate` no resuelven la desincronización
- El cliente Prisma generado espera columnas inexistentes

**Intentos de Solución Fallidos**:
1. `npx prisma migrate resolve --applied` - No resolvió
2. `npx prisma db pull --force` - No sincronizó correctamente  
3. `npx prisma generate --force` - Cliente sigue desincronizado
4. Limpieza de cache `node_modules\.prisma` - Sin efecto

**Solución Temporal Implementada**:
- Consultas SQL directas con `prisma.$queryRaw`
- Evita el cliente ORM desincronizado
- **Estado**: Implementado pero no probado completamente

#### 2. Inferencia de Metadatos Deficiente
**Problema**: El parser normalizado produce metadatos genéricos:
- Artista: "Unknown Artist" 
- Álbum: "01" (extraído incorrectamente del primer directorio)

**Manifest Real Analizado**:
```json
{
  "tracks": [
    {
      "name": "01 - Love for people",
      "directory": "01 - Love for people_progressive"
    }
  ]
}
```

**Mejoras Necesarias**:
- Extraer artista desde nombres de tracks (patrón "Número - Título")
- Inferir álbum desde directorio padre o CID metadata
- Detectar patrones comunes en nombres de archivos

#### 3. Validación End-to-End Incompleta
**Pendiente**:
- Inserción exitosa de Artist en base de datos
- Creación de Album con relación correcta
- Inserción de 8 tracks con metadatos
- Creación de AudioQuality entries (LOW/HIGH)
- Actualización de GlobalStats

## Próximos Pasos Críticos

### Paso 1: Diagnóstico de Esquema Real
**Objetivo**: Identificar estructura exacta de tablas en Supabase

**Acciones**:
1. Acceder a Supabase Dashboard → SQL Editor
2. Ejecutar: `\d "Artist"` para ver estructura de tabla Artist
3. Comparar con `prisma/schema.prisma` local
4. Documentar diferencias exactas

**Consultas de Diagnóstico**:
```sql
-- Ver estructura de tabla Artist
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'Artist';

-- Ver todas las tablas
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';
```

### Paso 2: Sincronización Forzada
**Opción A - Recrear Esquema Local**:
```bash
# Respaldar schema actual
cp prisma/schema.prisma prisma/schema.prisma.backup

# Generar schema desde DB real
npx prisma db pull --force --schema=prisma/schema-new.prisma
npx prisma generate --schema=prisma/schema-new.prisma

# Comparar diferencias
diff prisma/schema.prisma prisma/schema-new.prisma
```

**Opción B - Continuar con SQL Directo**:
- Expandir todas las operaciones de base de datos a `$queryRaw`
- Crear funciones helper para cada modelo (Artist, Album, Track)
- Evitar completamente el cliente ORM generado

### Paso 3: Testing Incremental
**Secuencia de Pruebas**:
1. Probar inserción de Artist con SQL directo
2. Validar creación de Album
3. Insertar primer Track
4. Crear AudioQuality entries
5. Actualizar GlobalStats
6. Verificar indexación completa

## Código de Continuación

### Testing de SQL Directo
```typescript
// Probar inserción de artista aisladamente
const testArtist = await prisma.$queryRaw`
  INSERT INTO "Artist" (name, country, genres, "isVerified", "followerCount", "createdAt", "updatedAt")
  VALUES ('Test Artist', null, ARRAY[]::text[], false, 0, NOW(), NOW())
  RETURNING *
` as any[]

console.log('Artist creado:', testArtist[0])
```

### Verificación de Esquema
```typescript
// Verificar columnas disponibles en Artist
const artistColumns = await prisma.$queryRaw`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'Artist'
` as any[]

console.log('Columnas disponibles:', artistColumns)
```

## Logs de Referencia

### Último Estado Exitoso
```
[IPFSIndexer] Initialized in gateway-only mode
[IPFSIndexer] Loading manifest from: https://gateway.pinata.cloud/ipfs/bafybeiby6cg5pii2gvaclwso7izh2gpsma76zz52fi3cwsv3snpf3lvaxm/album.json
[IPFSIndexer] Manifest loaded successfully from gateway
[IPFSIndexer] Normalized manifest: { "trackCount": 8, "tracks": [...] }
```

### Error Bloqueante
```
[IPFSIndexer] Error indexing from manifest: PrismaClientKnownRequestError:
Invalid `prisma.artist.findFirst()` invocation
The column `Artist.bio` does not exist in the current database.
```

## Archivos Críticos Modificados

### `backend/src/services/ipfs-indexer.ts`
- **Líneas 342-380**: Método `upsertArtist()` con SQL directo
- **Líneas 452-538**: Parser `normalizeManifest()` 
- **Líneas 138-158**: Gateway-only `loadAlbumManifest()`

### `backend/prisma/schema.prisma`
- **Estado**: Desincronizado con base de datos real
- **Acción Requerida**: Sincronización o abandono de ORM

## Métricas de Progreso

- **Parser de Manifest**: 100% funcional
- **Acceso Gateway**: 100% funcional  
- **Normalización**: 90% funcional (mejoras de inferencia pendientes)
- **Base de Datos**: 20% funcional (bloqueado por esquema)
- **Indexación End-to-End**: 0% funcional

## Tiempo Estimado para Resolución

- **Diagnóstico de esquema**: 30 minutos
- **Sincronización Prisma**: 1-2 horas
- **Testing completo**: 1 hora
- **Mejoras de inferencia**: 2-3 horas

**Total estimado**: 4-6 horas de trabajo adicional

## Comandos de Continuación

```powershell
# Levantar servidor
cd "C:\Users\Mabci\Documents\Plataforma de musica IPFS\backend"
npm run dev

# Probar indexación (esperará error de DB)
$Body = @{
  albumCid = "bafybeiby6cg5pii2gvaclwso7izh2gpsma76zz52fi3cwsv3snpf3lvaxm"
  gatewayUrl = "https://gateway.pinata.cloud"
} | ConvertTo-Json

Invoke-RestMethod -Method POST -Uri "http://localhost:4000/api/indexing/album" -ContentType "application/json" -Body $Body

# Diagnóstico de esquema
npx prisma studio  # Ver estructura visual
npx prisma db pull --print  # Ver schema que generaría
```

## Notas para Desarrollador Futuro

1. **No reinventar la rueda**: El parser flexible ya maneja múltiples formatos de manifest
2. **Priorizar estabilidad**: Resolver DB antes que optimizaciones
3. **Mantener logs detallados**: El debugging actual depende de logs extensivos
4. **Considerar alternativas**: Si Prisma sigue problemático, evaluar TypeORM o Drizzle
5. **Testing incremental**: Probar cada componente aisladamente antes de integración

La arquitectura base es sólida, solo requiere resolver la sincronización de base de datos para ser completamente funcional.
