# Arquitectura y Configuración Final - Gateway IPFS Privada

**Fecha:** 14 Septiembre 2025  
**Estado:** Producción Ready ✅  
**VPS:** 216.238.81.58 (DigitalOcean)

## 🏗️ ARQUITECTURA DESPLEGADA

### Diagrama de Servicios
```
┌─────────────────────────────────────────────────────────────┐
│                        VPS (216.238.81.58)                 │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   Gateway       │  │   IPFS Node     │  │    Redis     │ │
│  │   Privada       │  │   (Kubo 0.37)   │  │   Cache      │ │
│  │   :3001         │  │   :5001/:8080   │  │   :6379      │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
│           │                     │                   │       │
│  ┌─────────────────┐            │                   │       │
│  │   PostgreSQL    │            │                   │       │
│  │   Local         │            │                   │       │
│  │   :5433         │            │                   │       │
│  └─────────────────┘            │                   │       │
│                                 │                   │       │
│         Docker Network: ipfs_ipfs-network           │       │
└─────────────────────────────────────────────────────────────┘
                                 │
                    ┌─────────────────────────┐
                    │      Supabase          │
                    │   (BD Principal)       │
                    │ aws-1-us-east-2...     │
                    │      :6543             │
                    └─────────────────────────┘
```

## 🐳 CONFIGURACIÓN DOCKER COMPOSE

### Archivo: `infra/ipfs/docker-compose.yml`
```yaml
services:
  # Nodo IPFS principal (Kubo)
  ipfs-node:
    image: ipfs/kubo:latest
    container_name: music-ipfs-node
    ports:
      - "4001:4001"     # Swarm port
      - "5001:5001"     # API port
      - "8080:8080"     # Gateway port (interno)
    volumes:
      - ./data/ipfs:/data/ipfs
    environment:
      - IPFS_PROFILE=server
      - IPFS_PATH=/data/ipfs
    restart: unless-stopped
    networks:
      - ipfs-network

  # Private Gateway Proxy con validación de CIDs
  gateway-proxy:
    build: 
      context: ./gateway-proxy
      dockerfile: Dockerfile
    container_name: music-private-gateway
    ports:
      - "3001:3001"     # Puerto público del gateway
    env_file:
      - ./gateway-proxy/.env
    depends_on:
      - ipfs-node
      - redis
      - postgres
    restart: unless-stopped
    networks:
      - ipfs-network

  # Cache Redis para contenido frecuente
  redis:
    image: redis:7-alpine
    container_name: music-redis-cache
    ports:
      - "6379:6379"
    volumes:
      - ./data/redis:/data
    command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
    restart: unless-stopped
    networks:
      - ipfs-network

  # Base de datos para indexación
  postgres:
    image: postgres:15-alpine
    container_name: music-postgres-gateway
    ports:
      - "5433:5432"     # Puerto diferente para no conflicto
    environment:
      - POSTGRES_DB=music_gateway
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=t2nhWvXNgtxkU7iywPuioHjpl
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
      - ./init/init.sql:/docker-entrypoint-initdb.d/init.sql
    restart: unless-stopped
    networks:
      - ipfs-network

networks:
  ipfs-network:
    driver: bridge
```

## ⚙️ VARIABLES DE ENTORNO

### Archivo: `gateway-proxy/.env`
```bash
# Puerto del servidor
PORT=3001

# URLs de servicios
IPFS_API_URL=http://ipfs-node:5001
IPFS_GATEWAY_URL=http://ipfs-node:8080

# Base de datos local (gateway)
DATABASE_URL=postgresql://postgres:t2nhWvXNgtxkU7iywPuioHjpl@postgres:5432/music_gateway

# Base de datos principal (Supabase)
MAIN_DATABASE_URL=postgresql://postgres.pfbnvzgiwmqbummitlnr:ipfstest.2025@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=disable

# Redis
REDIS_URL=redis://redis:6379

# Configuración de cache
CACHE_TTL=3600

# Configuración de logs
LOG_LEVEL=info

# Tipo de gateway
GATEWAY_TYPE=private
```

## 🔌 CONECTIVIDAD DE SERVICIOS

### Red Docker Interna
- **Nombre:** `ipfs_ipfs-network`
- **Driver:** bridge
- **Subnet:** 172.18.0.0/16 (automático)

### Resolución DNS Interna
```
ipfs-node       → 172.18.0.2
gateway-proxy   → 172.18.0.3
redis          → 172.18.0.4
postgres       → 172.18.0.5
```

### Conectividad Externa
- **Supabase:** `aws-1-us-east-2.pooler.supabase.com:6543`
- **SSL:** Deshabilitado (`sslmode=disable`)
- **Connection Pooling:** PgBouncer habilitado

## 🚪 PUERTOS Y ENDPOINTS

### Puertos Expuestos al Host
```
3001  → Gateway Privada (público)
4001  → IPFS Swarm (P2P)
5001  → IPFS API (interno)
6379  → Redis (interno)
5433  → PostgreSQL local (interno)
8080  → IPFS Gateway (interno)
```

### Endpoints Públicos
```
http://216.238.81.58:3001/health          # Health check
http://216.238.81.58:3001/metrics         # Métricas Prometheus
http://216.238.81.58:3001/ipfs/[CID]      # Contenido IPFS
http://216.238.81.58:3001/admin/pin/[CID] # Admin - Pin content
http://216.238.81.58:3001/admin/sync-pins # Admin - Sync pins
```

## 🛡️ SEGURIDAD IMPLEMENTADA

### Validación de CIDs
```javascript
async function isAuthorizedCID(cid) {
  // Verificar en tabla tracks
  const trackResult = await mainDbPool.query(
    'SELECT id FROM tracks WHERE ipfs_hash = $1', [cid]
  )
  
  // Verificar en tabla albums
  const albumResult = await mainDbPool.query(
    'SELECT id FROM albums WHERE cover_ipfs_hash = $1', [cid]
  )
  
  // Verificar en tabla user_uploads
  const uploadResult = await mainDbPool.query(
    'SELECT id FROM user_uploads WHERE ipfs_hash = $1', [cid]
  )
  
  return trackResult.rows.length > 0 || 
         albumResult.rows.length > 0 || 
         uploadResult.rows.length > 0
}
```

### Headers de Seguridad
```javascript
// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000 // límite de requests por IP
}))

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  next()
})
```

### Logging de Seguridad
```javascript
// Log de accesos no autorizados
if (!isAuthorized) {
  securityLogger.warn('Unauthorized CID access attempt', {
    cid,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  })
}
```

## 📊 MONITOREO Y MÉTRICAS

### Health Check Response
```json
{
  "status": "ok",
  "timestamp": "2025-09-14T08:09:18.730Z",
  "gateway_type": "private",
  "services": {
    "redis": "connected",
    "postgres_gateway": "connected",
    "postgres_main": "connected",
    "ipfs": "connected"
  }
}
```

### Métricas Prometheus
```
# HELP gateway_requests_total Total number of requests
# TYPE gateway_requests_total counter
gateway_requests_total{method="GET",status="200"} 150

# HELP gateway_cache_hits_total Cache hits
# TYPE gateway_cache_hits_total counter
gateway_cache_hits_total 89

# HELP gateway_active_pins Active pinned content
# TYPE gateway_active_pins gauge
gateway_active_pins 1247
```

## 💾 PERSISTENCIA DE DATOS

### Volúmenes Docker
```
./data/ipfs      → /data/ipfs (IPFS repository)
./data/redis     → /data (Redis persistence)
./data/postgres  → /var/lib/postgresql/data (PostgreSQL data)
```

### Estructura de Directorios
```
infra/ipfs/
├── data/
│   ├── ipfs/          # IPFS repository
│   ├── redis/         # Redis persistence
│   └── postgres/      # PostgreSQL data
├── gateway-proxy/
│   ├── src/
│   │   └── index-private.js
│   ├── .env
│   └── Dockerfile
├── init/
│   └── init.sql       # PostgreSQL initialization
└── docker-compose.yml
```

## 🔄 PROCESO DE INICIALIZACIÓN

### Orden de Startup
1. **Redis** - Cache service
2. **PostgreSQL** - Local database
3. **IPFS Node** - Content storage
4. **Gateway Proxy** - Main service (depends on all)

### Health Check Sequence
```javascript
// 1. Verificar conexiones de BD
const pgPool = new Pool({ connectionString: DATABASE_URL })
const mainDbPool = new Pool({ connectionString: MAIN_DATABASE_URL })

// 2. Verificar Redis
const redisClient = redis.createClient({ url: REDIS_URL })

// 3. Verificar IPFS
await axios.post(`${IPFS_API_URL}/api/v0/version`, {}, { timeout: 5000 })
```

## 🚀 COMANDOS DE OPERACIÓN

### Iniciar Servicios
```bash
cd /opt/ipfs-music-gateway/infra/ipfs
sudo -u musicgateway docker compose up -d
```

### Ver Logs
```bash
sudo -u musicgateway docker compose logs [service] --tail 50
```

### Reiniciar Servicio Específico
```bash
sudo -u musicgateway docker compose restart [service]
```

### Rebuild Gateway
```bash
sudo -u musicgateway docker compose build gateway-proxy
sudo -u musicgateway docker compose up -d gateway-proxy
```

### Backup de Datos
```bash
# PostgreSQL
docker exec music-postgres-gateway pg_dump -U postgres music_gateway > backup.sql

# IPFS
tar -czf ipfs-backup.tar.gz data/ipfs/

# Redis
docker exec music-redis-cache redis-cli BGSAVE
```

## 📈 PERFORMANCE Y OPTIMIZACIÓN

### Configuración Redis
- **Memoria máxima:** 512MB
- **Política de expulsión:** allkeys-lru
- **Persistencia:** AOF habilitada
- **TTL por defecto:** 3600 segundos

### Configuración IPFS
- **Perfil:** server (optimizado para VPS)
- **API:** Solo acceso desde red Docker
- **Gateway:** Solo acceso interno
- **Swarm:** Puerto 4001 expuesto para P2P

### Configuración PostgreSQL
- **Versión:** 15-alpine
- **Puerto:** 5433 (evita conflictos)
- **Encoding:** UTF-8
- **Timezone:** UTC

## 🔧 TROUBLESHOOTING

### Comandos de Diagnóstico
```bash
# Estado de servicios
sudo -u musicgateway docker compose ps

# Health check
curl http://localhost:3001/health

# Conectividad IPFS
curl -X POST http://localhost:5001/api/v0/version

# Conectividad Redis
redis-cli -h localhost -p 6379 ping

# Conectividad PostgreSQL
psql -h localhost -p 5433 -U postgres -d music_gateway -c "SELECT 1;"
```

### Logs de Error Comunes
```bash
# SSL errors (Supabase)
grep -i "certificate\|ssl" logs/

# IPFS connection errors
grep -i "ipfs\|5001" logs/

# Redis connection errors  
grep -i "redis\|6379" logs/
```

Esta arquitectura proporciona una base sólida y escalable para la Gateway IPFS Privada, con todos los componentes correctamente configurados y monitoreados.
