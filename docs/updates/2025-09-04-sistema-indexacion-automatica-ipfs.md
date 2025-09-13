# Sistema de Indexación Automática IPFS

**Fecha:** 2025-09-04  
**Autor:** Sistema  
**Estado:** Implementado  

## Resumen

Se ha implementado un sistema completo de indexación automática para contenido musical en IPFS que permite crear un catálogo global accesible a todos los usuarios sin necesidad de cargar CIDs manualmente.

## Arquitectura del Sistema

### 1. Servicio de Indexación (`IPFSIndexer`)

**Ubicación:** `backend/src/services/ipfs-indexer.ts`

#### Características principales:
- **Detección automática de manifests:** Busca archivos `album.json` en directorios IPFS
- **Fallback a escaneo manual:** Si no hay manifest, escanea la estructura de directorios
- **Soporte híbrido:** Usa Helia para acceso P2P directo con fallback a gateway HTTP
- **Extracción de metadata:** Procesa información de artistas, álbumes y tracks
- **Gestión de calidades:** Indexa múltiples calidades de audio (LOW/HIGH/MAX)

#### Flujo de indexación:
1. **Carga de manifest:** Intenta cargar `album.json` desde IPFS
2. **Procesamiento de metadata:** Extrae información del artista, álbum y tracks
3. **Creación de entidades:** Upsert de Artist, Album, Track en la base de datos
4. **Indexación de calidades:** Crea registros AudioQuality para cada variante
5. **Actualización de estadísticas:** Actualiza contadores globales

### 2. API de Indexación (`/api/indexing`)

**Ubicación:** `backend/src/routes/indexing.ts`

#### Endpoints disponibles:

##### `POST /api/indexing/album`
Indexa un álbum individual por CID.
```json
{
  "albumCid": "QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "gatewayUrl": "https://gateway.pinata.cloud" // opcional
}
```

##### `POST /api/indexing/batch`
Indexa múltiples álbumes en lote (máximo 5).
```json
{
  "albumCids": ["QmXXX...", "QmYYY..."],
  "gatewayUrl": "https://gateway.pinata.cloud" // opcional
}
```

##### `GET /api/indexing/status/:albumCid`
Verifica si un álbum ya está indexado.

##### `GET /api/indexing/recent`
Obtiene álbumes indexados recientemente.

##### `DELETE /api/indexing/album/:albumCid`
Elimina un álbum del índice público (soft delete).

##### `POST /api/indexing/reindex/:albumCid`
Re-indexa un álbum existente.

### 3. Protecciones y Límites

#### Rate Limiting:
- **Indexación:** 10 requests por IP cada 15 minutos
- **Batch:** Máximo 5 álbumes por request

#### Validaciones:
- Formato CID válido (46-59 caracteres alfanuméricos)
- Timeout de 10 segundos para requests HTTP
- Manejo de errores robusto con logging detallado

## Integración con Base de Datos

### Modelos utilizados:
- **Artist:** Información del artista con géneros y verificación
- **Album:** Metadata del álbum con CID y estadísticas
- **Track:** Información de tracks individuales
- **AudioQuality:** Múltiples calidades por track
- **GlobalStats:** Estadísticas globales de la plataforma

### Estrategia de Upsert:
- **Artists:** Se buscan por nombre, se actualizan géneros y metadata
- **Albums:** Se identifican por `albumCid`, se actualizan metadatos
- **Tracks:** Se identifican por `trackCid`, se mantiene historial

## Casos de Uso

### 1. Indexación Manual
```bash
curl -X POST http://localhost:4000/api/indexing/album \
  -H "Content-Type: application/json" \
  -d '{"albumCid": "QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"}'
```

### 2. Verificación de Estado
```bash
curl http://localhost:4000/api/indexing/status/QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

### 3. Indexación en Lote
```bash
curl -X POST http://localhost:4000/api/indexing/batch \
  -H "Content-Type: application/json" \
  -d '{"albumCids": ["QmXXX...", "QmYYY..."]}'
```

## Optimizaciones Implementadas

### 1. Acceso Híbrido IPFS
- **P2P primero:** Intenta acceso directo vía Helia
- **Gateway fallback:** Si P2P falla, usa gateway HTTP
- **Timeout configurable:** Evita bloqueos prolongados

### 2. Procesamiento Eficiente
- **Manifest-first:** Prioriza archivos manifest para metadata completa
- **Batch processing:** Reutiliza conexión IPFS para múltiples álbumes
- **Upsert strategy:** Evita duplicados, actualiza información existente

### 3. Monitoreo y Logging
- **Logging detallado:** Cada paso del proceso se registra
- **Métricas de error:** Tracking de fallos por tipo
- **Estadísticas globales:** Actualización automática de contadores

## Próximos Pasos

### 1. Automatización Completa
- **Webhook integration:** Recibir notificaciones de nuevo contenido
- **Scheduled indexing:** Escaneo periódico de contenido popular
- **Content discovery:** Crawling automático de redes IPFS

### 2. Optimizaciones Avanzadas
- **Caching inteligente:** Cache de manifests y metadata
- **Parallel processing:** Indexación concurrente de múltiples álbumes
- **Delta updates:** Solo actualizar cambios incrementales

### 3. Integración Frontend
- **Admin panel:** Interface para gestión de indexación
- **Progress tracking:** Seguimiento en tiempo real del progreso
- **Content moderation:** Herramientas para curación de contenido

## Consideraciones de Rendimiento

### Recursos IPFS:
- **Memoria:** ~50MB por instancia de Helia
- **Red:** Bandwidth variable según disponibilidad P2P
- **Almacenamiento:** Solo metadata en base de datos

### Escalabilidad:
- **Horizontal:** Múltiples workers de indexación
- **Vertical:** Optimización de queries Prisma
- **Caching:** Redis para manifests frecuentemente accedidos

## Seguridad

### Validaciones:
- **CID format:** Validación estricta de formato
- **Content filtering:** Verificación de estructura de archivos
- **Rate limiting:** Protección contra abuso

### Privacidad:
- **Soft deletes:** Contenido se marca como no público
- **Audit trail:** Registro de todas las operaciones
- **Access control:** Preparado para permisos granulares

## Conclusión

El sistema de indexación automática proporciona la base para un catálogo global de música descentralizada, eliminando la fricción de carga manual de CIDs y creando una experiencia similar a plataformas centralizadas pero manteniendo los beneficios de IPFS.

La arquitectura híbrida P2P + Gateway garantiza disponibilidad mientras que las optimizaciones de rendimiento y las protecciones de seguridad aseguran un funcionamiento robusto en producción.
