# 🚀 Quick Start - IPFS Gateway Privada

## Instalación Automática en 3 Pasos

### 1️⃣ Ejecutar Script de Instalación

```bash
# Conectar a tu VPS como root
ssh root@tu-vps-ip

# Descargar y ejecutar script de instalación
curl -sSL https://raw.githubusercontent.com/tu-usuario/tu-repo/main/infra/ipfs/install-vps.sh | bash

# O si tienes los archivos localmente:
wget https://tu-servidor.com/install-vps.sh
chmod +x install-vps.sh
sudo ./install-vps.sh
```

**¿Qué hace este script?**
- ✅ Instala Docker y dependencias
- ✅ Configura firewall y seguridad
- ✅ Crea usuario de servicio
- ✅ Configura servicios systemd
- ✅ Inicia la gateway privada

### 2️⃣ Configurar Variables de Entorno

```bash
# Ejecutar script de configuración
sudo ./configure-env.sh
```

**Te pedirá:**
- 🔗 URL de tu base de datos principal (Render/Railway)
- 🌐 Dominio opcional para la gateway
- 🔒 Configuración SSL automática

### 3️⃣ ¡Listo! Verificar Funcionamiento

```bash
# Verificar estado
./monitor.sh status

# Ver logs
./monitor.sh logs gateway

# Sincronizar pins
./monitor.sh sync
```

---

## 📁 Scripts Incluidos

### `install-vps.sh` - Instalación Completa
```bash
sudo ./install-vps.sh
```
- Instala todo automáticamente
- Configura firewall y seguridad
- Crea servicios systemd
- Genera contraseñas seguras

### `configure-env.sh` - Configuración Post-Instalación
```bash
sudo ./configure-env.sh
```
- Configura conexión a BD principal
- Opcional: dominio y SSL
- Prueba conectividad
- Reinicia servicios

### `monitor.sh` - Monitoreo y Gestión
```bash
./monitor.sh status          # Estado general
./monitor.sh logs gateway    # Ver logs
./monitor.sh metrics         # Métricas
./monitor.sh sync            # Sincronizar pins
./monitor.sh backup          # Crear backup
./monitor.sh restart all     # Reiniciar servicios
```

---

## 🔧 Comandos Útiles Post-Instalación

### Verificar Estado
```bash
# Estado de servicios
systemctl status ipfs-music-gateway

# Estado de contenedores
cd /opt/ipfs-music-gateway/infra/ipfs && docker compose ps

# Health check
curl http://localhost:3001/health
```

### Ver Logs
```bash
# Logs de gateway
./monitor.sh logs gateway

# Logs de IPFS
./monitor.sh logs ipfs

# Todos los logs
./monitor.sh logs all
```

### Gestión de Contenido
```bash
# Sincronizar pins desde BD
curl -X POST http://localhost:3001/admin/sync-pins

# Pin manual de CID
curl -X POST http://localhost:3001/admin/pin/QmTuCID...

# Ver métricas
curl http://localhost:3001/metrics
```

---

## 🌐 URLs de Acceso

Después de la instalación, tu gateway estará disponible en:

```
Gateway:  http://TU-IP-VPS:3001
Health:   http://TU-IP-VPS:3001/health
Metrics:  http://TU-IP-VPS:3001/metrics
Admin:    http://TU-IP-VPS:3001/admin/sync-pins
```

---

## 🔒 Configuración de Seguridad

### Firewall Automático
- ✅ Puerto 22 (SSH)
- ✅ Puerto 3001 (Gateway)
- ✅ Puerto 4001 (IPFS P2P)
- ✅ Puertos 80/443 (HTTP/HTTPS)

### Validación de CIDs
- ✅ Solo sirve contenido de tu BD
- ✅ Bloquea CIDs no autorizados (403)
- ✅ Logs de intentos sospechosos
- ✅ Rate limiting por IP

---

## 📊 Monitoreo

### Métricas Clave
```bash
# Ver todas las métricas
./monitor.sh metrics

# Métricas específicas
curl http://localhost:3001/metrics | grep unauthorized_requests
curl http://localhost:3001/metrics | grep ipfs_active_pins
curl http://localhost:3001/metrics | grep cache_hits
```

### Logs Importantes
```bash
# Errores de gateway
./monitor.sh logs gateway | grep ERROR

# Accesos no autorizados
./monitor.sh logs gateway | grep "BLOCKED"

# Estado de IPFS
./monitor.sh ipfs
```

---

## 🔄 Integración con Frontend

### Actualizar URLs en tu Frontend
```typescript
// En tu archivo de configuración
const IPFS_GATEWAY = process.env.NODE_ENV === 'production' 
  ? 'https://tu-gateway.com'  // Tu dominio
  : 'http://localhost:3001'   // Desarrollo local

// Usar en componentes
const audioUrl = `${IPFS_GATEWAY}/ipfs/${track.ipfs_hash}`
```

### Variables de Entorno Frontend
```env
# .env.production
NEXT_PUBLIC_IPFS_GATEWAY=https://tu-gateway.com

# .env.local
NEXT_PUBLIC_IPFS_GATEWAY=http://localhost:3001
```

---

## 🚨 Troubleshooting

### Gateway no responde
```bash
# Verificar servicios
./monitor.sh status

# Reiniciar servicios
./monitor.sh restart all

# Ver logs de errores
./monitor.sh logs gateway | tail -50
```

### CIDs no autorizados
```bash
# Verificar conexión a BD principal
./monitor.sh logs gateway | grep "Main PostgreSQL"

# Probar sincronización
./monitor.sh sync
```

### IPFS no conecta
```bash
# Estado del nodo
./monitor.sh ipfs

# Reiniciar solo IPFS
./monitor.sh restart ipfs
```

---

## 💾 Backup y Restauración

### Crear Backup
```bash
# Backup completo
./monitor.sh backup

# Backup manual
cd /opt/ipfs-music-gateway/infra/ipfs
tar -czf backup-$(date +%Y%m%d).tar.gz data/
```

### Restaurar Backup
```bash
# Detener servicios
docker compose down

# Restaurar datos
tar -xzf backup-YYYYMMDD.tar.gz

# Reiniciar servicios
docker compose up -d
```

---

## 📞 Soporte

### Archivos de Configuración
- Variables: `/opt/ipfs-music-gateway/infra/ipfs/gateway-proxy/.env`
- Docker: `/opt/ipfs-music-gateway/infra/ipfs/docker-compose.yml`
- Logs: `./monitor.sh logs all`

### Comandos de Diagnóstico
```bash
# Estado completo
./monitor.sh status

# Conectividad de red
curl -I http://localhost:3001/health

# Uso de recursos
docker stats --no-stream
```

---

**¡Tu IPFS Gateway Privada está lista!** 🎉

Solo sirve contenido autorizado desde tu plataforma, sin dependencias externas y con control total sobre el contenido.
