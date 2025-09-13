# ADR-006: Arquitectura Completa del Backend Expandido

**Fecha:** 2025-09-04  
**Estado:** Implementado  
**Decisores:** Equipo de desarrollo  

## Contexto

La plataforma de música IPFS ha evolucionado de un prototipo frontend-first a una arquitectura backend completa que incluye gateway IPFS propio, catálogo global de música, sistema de indexación automática y APIs robustas para gestión de contenido.

## Decisión

Implementar una arquitectura backend expandida que incluye:

1. **Gateway IPFS Personalizado**
2. **Base de Datos Expandida con Catálogo Global**
3. **Sistema de Indexación Automática**
4. **APIs de Gestión de Catálogo**
5. **Autenticación y Gestión de Usuarios**

## Arquitectura Detallada

### 1. Componentes Principales

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                      │
│  ┌─────────────────┐ ┌─────────────────┐ ┌──────────────┐  │
│  │   Landing Page  │ │   Music Player  │ │   Library    │  │
│  │                 │ │                 │ │              │  │
│  └─────────────────┘ └─────────────────┘ └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 BACKEND API (Express.js)                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────┐ │
│  │    Auth     │ │   Catalog   │ │  Indexing   │ │ Users  │ │
│  │  /api/auth  │ │/api/catalog │ │/api/indexing│ │/api/   │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                DATABASE (PostgreSQL/Supabase)              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────┐ │
│  │   Artists   │ │   Albums    │ │   Tracks    │ │ Users  │ │
│  │   Genres    │ │  Qualities  │ │ Playlists   │ │Sessions│ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              INFRAESTRUCTURA IPFS                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────┐ │
│  │ Kubo Node   │ │Gateway Proxy│ │Redis Cache  │ │Metrics │ │
│  │   (IPFS)    │ │ (Express)   │ │    (LRU)    │ │(Prom.) │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 2. Flujo de Datos

#### Indexación de Contenido:
```
Nuevo Álbum CID → IPFSIndexer → Manifest Detection → 
Metadata Extraction → Database Upsert → Global Stats Update
```

#### Reproducción de Música:
```
User Request → Catalog API → Track Info → 
Gateway Proxy → IPFS/Cache → Progressive Stream → Frontend Player
```

#### Autenticación:
```
Google OAuth → Backend Validation → Session Creation → 
Cookie Storage → Middleware Protection → API Access
```

### 3. Modelos de Base de Datos

#### Entidades Principales:
- **User**: Usuarios con autenticación Google OAuth
- **Artist**: Artistas con metadata y géneros
- **Album**: Álbumes con CIDs y estadísticas
- **Track**: Canciones individuales con metadata técnica
- **AudioQuality**: Múltiples calidades por track (LOW/HIGH/MAX)
- **Genre**: Géneros jerárquicos con relaciones many-to-many
- **Playlist**: Listas de reproducción de usuarios
- **Session**: Sesiones de autenticación con cookies

#### Entidades de Soporte:
- **Release**: Diferentes versiones de álbumes
- **GlobalStats**: Estadísticas globales de la plataforma
- **TrendingContent**: Contenido popular por períodos

### 4. APIs Implementadas

#### `/api/auth` - Autenticación
- `GET /google` - Iniciar OAuth con Google
- `GET /google/callback` - Callback de OAuth
- `GET /session` - Obtener sesión actual
- `POST /signout` - Cerrar sesión

#### `/api/catalog` - Catálogo Musical
- `GET /artists` - Listar artistas con filtros
- `GET /artists/:id` - Detalles de artista
- `GET /albums` - Listar álbumes con filtros
- `GET /albums/:id` - Detalles de álbum
- `GET /search` - Búsqueda global
- `GET /genres` - Listar géneros
- `GET /trending` - Contenido trending
- `GET /stats` - Estadísticas globales

#### `/api/indexing` - Gestión de Índices
- `POST /album` - Indexar álbum individual
- `POST /batch` - Indexación en lote
- `GET /status/:cid` - Estado de indexación
- `GET /recent` - Álbumes recientes
- `DELETE /album/:cid` - Eliminar del índice
- `POST /reindex/:cid` - Re-indexar álbum

### 5. Gateway IPFS Personalizado

#### Componentes:
- **Kubo Node**: Nodo IPFS completo con API y Gateway
- **Gateway Proxy**: Proxy Express con cache y métricas
- **Redis Cache**: Cache LRU con TTL configurable
- **PostgreSQL**: Métricas de pins y estadísticas
- **Prometheus**: Monitoreo y métricas

#### Características:
- **HTTP Range Requests**: Streaming progresivo
- **Fallback Automático**: A gateways públicos si falla local
- **Auto-pinning**: Pin automático de contenido accedido
- **Rate Limiting**: Protección contra abuso
- **Métricas Detalladas**: Prometheus + Grafana ready

### 6. Seguridad y Performance

#### Autenticación:
- **Google OAuth 2.0**: Autenticación segura
- **HTTP-only Cookies**: Sesiones seguras
- **CORS Configurado**: Solo dominios autorizados
- **Rate Limiting**: En endpoints críticos

#### Performance:
- **Database Indexing**: Índices optimizados en Prisma
- **Connection Pooling**: Supabase Pooler para producción
- **Caching Strategy**: Redis para gateway, browser cache para assets
- **Pagination**: En todas las listas de resultados

#### Monitoring:
- **Structured Logging**: Winston con múltiples transports
- **Error Tracking**: Logging detallado de errores
- **Metrics Collection**: Prometheus para gateway y APIs
- **Health Checks**: Endpoints de salud para servicios

## Beneficios

### 1. Escalabilidad
- **Horizontal**: Múltiples instancias de gateway y backend
- **Vertical**: Optimizaciones de base de datos y cache
- **Modular**: Servicios independientes y desacoplados

### 2. Disponibilidad
- **Fallback Automático**: Gateway público si falla local
- **Cache Inteligente**: Reduce dependencia de IPFS
- **Error Recovery**: Manejo robusto de fallos

### 3. Experiencia de Usuario
- **Catálogo Global**: Sin necesidad de CIDs manuales
- **Búsqueda Avanzada**: Filtros y ordenamiento
- **Streaming Progresivo**: Reproducción inmediata
- **Autenticación Fluida**: Google OAuth integrado

### 4. Operacional
- **Monitoreo Completo**: Métricas y logs detallados
- **Deployment Flexible**: Docker Compose + Cloud options
- **Configuración Centralizada**: Variables de entorno
- **Backup Strategy**: Base de datos + IPFS pinning

## Consideraciones

### 1. Costos
- **VPS/Cloud**: $20-50/mes para instancia básica
- **Base de Datos**: Supabase free tier o $25/mes pro
- **Bandwidth**: Variable según uso de gateway
- **Storage**: Solo metadata, contenido en IPFS

### 2. Mantenimiento
- **Updates**: Actualizaciones regulares de dependencias
- **Monitoring**: Supervisión de métricas y logs
- **Backup**: Estrategia de respaldo de base de datos
- **Security**: Actualizaciones de seguridad

### 3. Limitaciones Actuales
- **IPFS Discovery**: Dependiente de DHT y peers
- **Cold Start**: Primer acceso puede ser lento
- **Content Moderation**: Sistema básico implementado
- **Mobile Optimization**: Pendiente optimización específica

## Próximos Pasos

### 1. Optimizaciones Inmediatas
- **CDN Integration**: Para covers y metadata
- **Advanced Caching**: Estrategias más sofisticadas
- **Load Balancing**: Para múltiples instancias de gateway
- **Database Optimization**: Query optimization y indexing

### 2. Funcionalidades Avanzadas
- **Content Discovery**: Crawling automático de IPFS
- **Recommendation Engine**: Sistema de recomendaciones
- **Social Features**: Seguimiento de artistas, compartir
- **Mobile App**: Aplicación nativa

### 3. Infraestructura
- **Kubernetes**: Orquestación de contenedores
- **CI/CD Pipeline**: Deployment automático
- **Multi-region**: Despliegue en múltiples regiones
- **Edge Computing**: CDN y edge caching

## Conclusión

La arquitectura backend expandida proporciona una base sólida para una plataforma de música descentralizada que combina los beneficios de IPFS con la experiencia de usuario de plataformas centralizadas. La modularidad del diseño permite escalamiento incremental y la adición de nuevas funcionalidades sin disrupciones mayores.

El sistema está preparado para manejar desde usuarios individuales hasta comunidades grandes, manteniendo performance y disponibilidad mientras preserva los principios de descentralización y propiedad de datos.
