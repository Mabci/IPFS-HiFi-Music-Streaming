# ADR-0005: Gateway IPFS Propio para Independencia de Pinata

## Estado
Aceptado

## Contexto
Actualmente dependemos de Pinata (versión gratuita) para el gateway IPFS, lo que limita el ancho de banda y control sobre la infraestructura. Necesitamos un gateway propio deployable en VPS o Google Cloud para:

1. **Independencia**: No depender de servicios externos gratuitos
2. **Control**: Gestionar nuestro propio nodo IPFS y cache
3. **Performance**: Optimizar para nuestro caso de uso específico (streaming de audio)
4. **Escalabilidad**: Poder escalar según nuestras necesidades

## Decisión

### Arquitectura del Gateway Propio

**Componente 1: Nodo IPFS (Kubo)**
```
- Kubo (go-ipfs) como daemon principal
- Configuración optimizada para streaming de audio
- Pinning automático de contenido popular
- API HTTP habilitada para interacción programática
```

**Componente 2: Proxy Gateway (Node.js)**
```
- Express.js como proxy inteligente
- Cache en Redis para contenido frecuente
- HTTP Range Requests para streaming progresivo
- Rate limiting y autenticación opcional
- Métricas y logging
```

**Componente 3: Base de Datos de Contenido**
```
- PostgreSQL para indexar contenido disponible
- Tabla de pins activos y su popularidad
- Métricas de acceso para garbage collection inteligente
```

### Estructura de Deployment

#### Opción A: VPS Simple (Recomendada para inicio)
```
- 1 servidor con Docker Compose
- Kubo + Proxy Gateway + Redis + PostgreSQL
- 2-4 GB RAM, 50-100 GB SSD
- Costo: ~$20-40/mes
```

#### Opción B: Google Cloud (Para escalar)
```
- Cloud Run para el proxy gateway
- Compute Engine para Kubo daemon
- Cloud SQL para PostgreSQL
- Memorystore para Redis
```

### Configuración Técnica

**Kubo Configuration:**
```json
{
  "API": {
    "HTTPHeaders": {
      "Access-Control-Allow-Origin": ["*"],
      "Access-Control-Allow-Methods": ["GET", "POST", "PUT", "DELETE"],
      "Access-Control-Allow-Headers": ["Authorization", "Content-Type"]
    }
  },
  "Gateway": {
    "HTTPHeaders": {
      "Access-Control-Allow-Origin": ["*"]
    },
    "RootRedirect": "",
    "Writable": false
  },
  "Swarm": {
    "ConnMgr": {
      "HighWater": 900,
      "LowWater": 600
    }
  },
  "Datastore": {
    "StorageMax": "50GB",
    "GCPeriod": "1h"
  }
}
```

**Proxy Gateway Features:**
- Cache inteligente con TTL configurable
- Compresión automática para metadatos JSON
- Soporte completo para HTTP Range Requests
- Fallback a gateways públicos si contenido no está disponible
- API para gestión de pins y estadísticas

## Beneficios

1. **Independencia total** de servicios externos
2. **Performance optimizada** para streaming de audio
3. **Control completo** sobre cache y pinning
4. **Escalabilidad horizontal** cuando sea necesario
5. **Costos predecibles** y controlables

## Implementación

### Fase 1: Gateway Básico
- Kubo daemon con configuración optimizada
- Proxy Express.js con cache Redis
- Docker Compose para deployment local/VPS

### Fase 2: Indexación Inteligente
- Integración con base de datos PostgreSQL existente
- Sistema de pinning automático basado en popularidad
- Métricas de uso y garbage collection

### Fase 3: Escalabilidad
- Load balancer para múltiples instancias
- CDN para contenido estático (portadas)
- Monitoreo y alertas

## Riesgos y Mitigaciones

**Riesgo**: Costo de ancho de banda
**Mitigación**: Cache inteligente y CDN para contenido popular

**Riesgo**: Disponibilidad del nodo
**Mitigación**: Fallback automático a gateways públicos

**Riesgo**: Gestión de almacenamiento
**Mitigación**: Garbage collection automático basado en métricas de uso

## Próximos Pasos

1. Crear estructura Docker Compose para desarrollo
2. Implementar proxy gateway con cache Redis
3. Integrar con esquema PostgreSQL existente
4. Testing de performance vs Pinata
5. Documentar proceso de deployment en VPS/GCP
