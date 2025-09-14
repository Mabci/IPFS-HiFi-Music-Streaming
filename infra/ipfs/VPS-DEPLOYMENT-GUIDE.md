# Guía de Deployment - IPFS Gateway Privada en VPS

## Resumen
Esta guía te ayudará a desplegar la IPFS Gateway privada en un VPS. La gateway solo servirá contenido autorizado desde tu base de datos principal, sin fallbacks a gateways públicos.

## Características de la Gateway Privada

### ✅ Implementado
- **Validación de CIDs**: Solo sirve contenido autorizado desde tu BD
- **Sin Fallbacks Públicos**: Cero dependencia de gateways externos
- **Cache Inteligente**: Redis para contenido frecuente
- **Métricas Completas**: Prometheus + métricas de seguridad
- **Sincronización Automática**: Endpoint para sincronizar pins con BD principal
- **Logs de Seguridad**: Registro de intentos de acceso no autorizados

### 🔒 Seguridad
- Rate limiting por IP
- Headers de seguridad (Helmet)
- Validación estricta de CIDs
- Logs de accesos no autorizados
- Sin exposición de contenido externo

## Requisitos del VPS

### Especificaciones Mínimas
- **RAM**: 2GB (recomendado 4GB)
- **Storage**: 50GB SSD
- **CPU**: 2 vCPUs
- **Bandwidth**: 1TB/mes
- **OS**: Ubuntu 20.04+ / Debian 11+

### Proveedores Recomendados
| Proveedor | Precio/mes | Specs | Región |
|-----------|------------|-------|---------|
| **DigitalOcean** | $20 | 2GB RAM, 50GB SSD | Multiple |
| **Linode** | $20 | 2GB RAM, 50GB SSD | Multiple |
| **Vultr** | $18 | 2GB RAM, 50GB SSD | Multiple |
| **Hetzner** | $15 | 4GB RAM, 40GB SSD | Europa |

## Instalación Paso a Paso

### 1. Preparar el VPS

```bash
# Conectar al VPS
ssh root@your-vps-ip

# Actualizar sistema
apt update && apt upgrade -y

# Instalar dependencias
apt install -y docker.io docker-compose git curl ufw

# Configurar firewall
ufw allow ssh
ufw allow 3001/tcp  # Gateway port
ufw allow 4001/tcp  # IPFS swarm
ufw --force enable

# Crear usuario para la aplicación
useradd -m -s /bin/bash musicgateway
usermod -aG docker musicgateway
```

### 2. Clonar y Configurar

```bash
# Cambiar a usuario de aplicación
su - musicgateway

# Crear directorio de trabajo
mkdir -p /home/musicgateway/ipfs-gateway
cd /home/musicgateway/ipfs-gateway

# Copiar archivos desde tu repo local
# (Usar scp o git clone según tu preferencia)
```

### 3. Configuración de Variables de Entorno

```bash
# Copiar y editar configuración
cp gateway-proxy/env.example gateway-proxy/.env

# Editar configuración
nano gateway-proxy/.env
```

**Configuración requerida en `.env`:**
```env
# Server Configuration
PORT=3001
NODE_ENV=production

# IPFS Configuration
IPFS_API_URL=http://ipfs-node:5001
IPFS_GATEWAY_URL=http://ipfs-node:8080

# Cache Configuration
REDIS_URL=redis://redis:6379
CACHE_TTL=3600
MAX_CACHE_SIZE=1GB

# Database Configuration
DATABASE_URL=postgresql://postgres:secure_password@postgres:5432/music_gateway

# CRÍTICO: Conexión a tu BD principal
MAIN_DATABASE_URL=postgresql://tu_usuario:tu_password@tu-backend-host:5432/tu_bd_principal

# Logging
LOG_LEVEL=info
```

### 4. Configurar Acceso a BD Principal

**Opción A: BD Principal en Render/Railway**
```env
MAIN_DATABASE_URL=postgresql://usuario:password@host.railway.app:5432/railway
```

**Opción B: BD Principal en el mismo VPS**
```env
MAIN_DATABASE_URL=postgresql://usuario:password@localhost:5432/music_platform
```

**Opción C: Túnel SSH (más seguro)**
```bash
# En el VPS, crear túnel SSH a tu backend
ssh -L 5433:localhost:5432 usuario@tu-backend-host -N &

# En .env usar:
MAIN_DATABASE_URL=postgresql://usuario:password@localhost:5433/tu_bd
```

### 5. Inicializar Base de Datos Gateway

```bash
# Crear directorio de inicialización si no existe
mkdir -p init

# Crear script de inicialización
cat > init/init.sql << 'EOF'
-- Tabla para tracking de pins
CREATE TABLE IF NOT EXISTS pins (
    id SERIAL PRIMARY KEY,
    cid VARCHAR(255) UNIQUE NOT NULL,
    pinned_at TIMESTAMP DEFAULT NOW(),
    access_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_pins_cid ON pins(cid);
CREATE INDEX IF NOT EXISTS idx_pins_access_count ON pins(access_count DESC);

-- Tabla para métricas de acceso
CREATE TABLE IF NOT EXISTS access_logs (
    id SERIAL PRIMARY KEY,
    cid VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    status_code INTEGER,
    response_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_logs_created_at ON access_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_cid ON access_logs(cid);
EOF
```

### 6. Deployment

```bash
# Construir y levantar servicios
docker-compose up -d

# Verificar que todos los servicios estén corriendo
docker-compose ps

# Ver logs
docker-compose logs -f gateway-proxy
```

### 7. Verificación del Deployment

```bash
# Test de salud
curl http://localhost:3001/health

# Test de métricas
curl http://localhost:3001/metrics

# Test de acceso (debería fallar con CID no autorizado)
curl http://localhost:3001/ipfs/QmTestCIDNoAutorizado
```

### 8. Sincronización Inicial

```bash
# Sincronizar pins desde BD principal
curl -X POST http://localhost:3001/admin/sync-pins

# Verificar pins activos
curl http://localhost:3001/metrics | grep ipfs_active_pins
```

## Configuración de Dominio (Opcional)

### Con Cloudflare
1. Apuntar dominio A record a IP del VPS
2. Configurar proxy en Cloudflare
3. SSL automático

### Con Nginx (en el VPS)
```bash
# Instalar nginx
apt install nginx

# Configurar proxy
cat > /etc/nginx/sites-available/ipfs-gateway << 'EOF'
server {
    listen 80;
    server_name tu-dominio.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Activar sitio
ln -s /etc/nginx/sites-available/ipfs-gateway /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# SSL con Let's Encrypt
apt install certbot python3-certbot-nginx
certbot --nginx -d tu-dominio.com
```

## Monitoreo y Mantenimiento

### Logs Importantes
```bash
# Logs de la gateway
docker-compose logs -f gateway-proxy

# Logs de IPFS
docker-compose logs -f ipfs-node

# Logs del sistema
journalctl -u docker -f
```

### Métricas Clave
- `ipfs_requests_total`: Requests totales por fuente
- `unauthorized_requests_total`: Intentos de acceso no autorizados
- `cache_hits_total`: Eficiencia del cache
- `ipfs_active_pins_total`: Contenido pinneado

### Backup y Restauración
```bash
# Backup de datos IPFS
docker-compose exec ipfs-node ipfs repo gc
tar -czf ipfs-backup-$(date +%Y%m%d).tar.gz data/ipfs

# Backup de BD gateway
docker-compose exec postgres pg_dump -U postgres music_gateway > gateway-backup-$(date +%Y%m%d).sql
```

## Integración con Frontend

### Actualizar URLs en Frontend
```typescript
// En tu frontend, actualizar las URLs
const GATEWAY_URL = process.env.NODE_ENV === 'production' 
  ? 'https://tu-gateway.com' 
  : 'http://localhost:3001'

// Ejemplo de uso
const audioUrl = `${GATEWAY_URL}/ipfs/${track.ipfs_hash}`
```

### Variables de Entorno Frontend
```env
# En tu .env del frontend
NEXT_PUBLIC_IPFS_GATEWAY=https://tu-gateway.com
```

## Troubleshooting

### Problemas Comunes

**1. Gateway no responde**
```bash
# Verificar servicios
docker-compose ps
docker-compose logs gateway-proxy

# Verificar puertos
netstat -tlnp | grep 3001
```

**2. CIDs no autorizados**
```bash
# Verificar conexión a BD principal
docker-compose exec gateway-proxy node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.MAIN_DATABASE_URL });
pool.query('SELECT 1').then(() => console.log('BD OK')).catch(console.error);
"
```

**3. IPFS node no sincroniza**
```bash
# Verificar peers
docker-compose exec ipfs-node ipfs swarm peers

# Verificar configuración
docker-compose exec ipfs-node ipfs config show
```

## Costos Estimados

### VPS Básico ($20/mes)
- Servidor: $20
- Dominio: $12/año
- **Total**: ~$21/mes

### Con CDN ($25/mes)
- Servidor: $20
- Cloudflare Pro: $20/mes
- **Total**: ~$40/mes (mejor rendimiento global)

## Próximos Pasos

1. **Testing**: Verificar que solo sirve contenido autorizado
2. **Monitoreo**: Configurar alertas para métricas críticas
3. **Backup**: Automatizar backups diarios
4. **Escalabilidad**: Considerar load balancer para múltiples instancias

## Soporte

Para problemas específicos:
1. Revisar logs: `docker-compose logs -f`
2. Verificar métricas: `curl /metrics`
3. Comprobar conectividad BD: Endpoint `/health`

---

**¡Gateway Privada Lista!** 🚀

Tu IPFS Gateway ahora solo sirve contenido autorizado desde tu plataforma, sin dependencias externas y con control total sobre el contenido servido.
