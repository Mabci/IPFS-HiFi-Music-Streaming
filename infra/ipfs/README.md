# Gateway IPFS Propio - Infraestructura Completa

## Descripción
Gateway IPFS independiente con cache inteligente, métricas y fallback automático a gateways públicos. Diseñado específicamente para streaming de música con soporte completo para HTTP Range Requests.

## Componentes

### 1. Nodo IPFS (Kubo)
- **Puerto 4001**: Swarm P2P
- **Puerto 5001**: API HTTP
- **Puerto 8080**: Gateway HTTP (interno)
- **Configuración**: Optimizada para streaming de audio
- **Storage**: 50GB con garbage collection automático

### 2. Gateway Proxy (Node.js)
- **Puerto 3001**: Endpoint público
- **Cache**: Redis con TTL configurable
- **Fallback**: Gateways públicos automáticos
- **Métricas**: Prometheus integrado
- **Logs**: Winston con rotación

### 3. Base de Datos (PostgreSQL)
- **Puerto 5433**: Evita conflicto con backend principal
- **Tablas**: Pins, métricas, cache stats
- **Índices**: Optimizados para consultas frecuentes

### 4. Cache (Redis)
- **Puerto 6379**: Cache de contenido frecuente
- **Política**: LRU con límite de 512MB
- **TTL**: 1 hora por defecto

## Deployment

### Desarrollo Local
```bash
cd infra/ipfs
docker-compose up -d
```

### VPS Producción
```bash
# Copiar archivos al servidor
scp -r . user@your-vps:/opt/music-ipfs-gateway/

# En el servidor
cd /opt/music-ipfs-gateway
cp gateway-proxy/env.example gateway-proxy/.env
# Editar .env con configuración específica
docker-compose up -d
```

### Google Cloud
```bash
# Usar Cloud Run para gateway-proxy
# Compute Engine para ipfs-node
# Cloud SQL para PostgreSQL
# Memorystore para Redis
```

## Configuración

### Variables de Entorno
- `IPFS_API_URL`: URL del API de Kubo
- `IPFS_GATEWAY_URL`: URL del gateway interno
- `REDIS_URL`: Conexión a Redis
- `DATABASE_URL`: Conexión a PostgreSQL
- `CACHE_TTL`: Tiempo de vida del cache (segundos)

### Gateways Fallback
1. ipfs.io
2. gateway.pinata.cloud
3. cloudflare-ipfs.com
4. dweb.link

## Monitoreo

### Métricas Disponibles
- **HTTP Requests**: Total, duración, códigos de estado
- **Cache**: Hits/misses, eficiencia
- **IPFS**: Requests por fuente, pins activos
- **Performance**: Tiempo de respuesta, bytes servidos

### Endpoints
- `GET /health`: Estado de servicios
- `GET /metrics`: Métricas Prometheus
- `POST /admin/pin/:cid`: Pin manual de contenido
- `GET /ipfs/:cid`: Gateway principal

## Optimizaciones

### Cache Inteligente
- Contenido < 1MB se cachea automáticamente
- Audio streams no se cachean (demasiado grandes)
- TTL basado en popularidad del contenido

### Pinning Automático
- Contenido solicitado vía fallback se pina automáticamente
- Garbage collection basado en métricas de acceso
- Prioridad por popularidad y recencia

### Performance
- HTTP Range Requests completo
- Compresión automática para metadatos
- Rate limiting por IP
- Headers de cache optimizados

## Costos Estimados

### VPS (2GB RAM, 50GB SSD)
- **DigitalOcean**: ~$20/mes
- **Linode**: ~$20/mes
- **Vultr**: ~$18/mes

### Google Cloud
- **Cloud Run**: ~$5-15/mes (según tráfico)
- **Compute Engine**: ~$25/mes (e2-small)
- **Cloud SQL**: ~$15/mes (db-f1-micro)
- **Total**: ~$45-55/mes

## Próximos Pasos
1. Testing de performance vs Pinata
2. Implementar CDN para portadas
3. Load balancer para múltiples instancias
4. Integración con catálogo musical
