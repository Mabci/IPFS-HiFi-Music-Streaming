# VPS de Transcodificación - Configuración y Despliegue

Este directorio contiene todos los archivos necesarios para configurar y desplegar el worker de transcodificación de audio en un VPS dedicado.

## 📋 Requisitos del VPS

- **OS**: Ubuntu 22.04 LTS (recomendado)
- **CPU**: Mínimo 2 cores, recomendado 4+ cores
- **RAM**: Mínimo 4GB, recomendado 8GB+
- **Disco**: Mínimo 50GB SSD
- **Ancho de banda**: Conexión estable con buena velocidad de subida

## 🚀 Configuración Inicial

### 1. Preparar el VPS

```bash
# Conectar al VPS
ssh root@your-vps-ip

# Copiar y ejecutar el script de configuración
wget https://raw.githubusercontent.com/your-repo/main/infra/transcoding-vps/setup-vps.sh
chmod +x setup-vps.sh
sudo ./setup-vps.sh
```

### 2. Desplegar el Worker

Desde tu máquina local:

```bash
# Navegar al directorio del proyecto
cd infra/transcoding-vps

# Editar el script de despliegue con tu IP del VPS
nano deploy.sh
# Cambiar: VPS_HOST="your-vps-ip"

# Ejecutar despliegue
chmod +x deploy.sh
./deploy.sh
```

### 3. Configurar Variables de Entorno

```bash
# Conectar al VPS
ssh transcoding-worker@your-vps-ip

# Navegar al directorio del worker
cd /opt/transcoding-worker

# Configurar variables de entorno
cp ENV.sample .env
nano .env
```

Configurar las siguientes variables críticas:

```env
# Redis (mismo que el servidor principal)
REDIS_HOST=your-redis-server.com
REDIS_PASSWORD=your-redis-password

# Base de datos (misma que el servidor principal)
DATABASE_URL="postgresql://postgres:PASSWORD@HOST:5432/postgres?sslmode=require"

# API del backend
BACKEND_API_URL=https://your-backend-api.com
WORKER_API_KEY=your-secure-worker-api-key
BACKEND_API_KEY=your-backend-api-key

# IPFS
IPFS_GATEWAY_URL=https://your-private-gateway.com
```

### 4. Iniciar el Worker

```bash
# Instalar dependencias y compilar
npm run setup

# Iniciar con PM2
npm run pm2:start

# Configurar inicio automático
pm2 startup
pm2 save

# Verificar estado
pm2 status
npm run pm2:logs
```

## 📊 Monitoreo y Mantenimiento

### Configurar Monitoreo Automático

```bash
# Hacer ejecutable el script de monitoreo
chmod +x monitor.sh

# Configurar cron job (cada 5 minutos)
crontab -e
# Agregar: */5 * * * * /opt/transcoding-worker/monitor.sh
```

### Comandos de Monitoreo

```bash
# Ver logs en tiempo real
npm run pm2:logs

# Monitor de recursos
npm run pm2:monit

# Estado del worker
pm2 status

# Verificar salud del sistema
npm run health

# Reiniciar worker
npm run pm2:restart

# Ver logs del sistema
tail -f /var/log/transcoding-worker/combined.log
```

### Métricas Importantes

- **CPU**: Debe mantenerse bajo 80% en promedio
- **Memoria**: Debe mantenerse bajo 85%
- **Disco**: Debe mantenerse bajo 90%
- **Conectividad**: Redis y Backend API deben estar siempre accesibles

## 🔧 Solución de Problemas

### Worker No Inicia

```bash
# Verificar logs de error
pm2 logs transcoding-worker --err

# Verificar configuración
cat .env

# Verificar dependencias
npm run test-ffmpeg
redis-cli -h $REDIS_HOST ping
```

### Alto Uso de Recursos

```bash
# Verificar procesos activos
ps aux | grep ffmpeg

# Limpiar archivos temporales
find /tmp/audio-processing -type f -mtime +1 -delete

# Reiniciar worker
pm2 restart transcoding-worker
```

### Problemas de Conectividad

```bash
# Verificar conectividad Redis
redis-cli -h $REDIS_HOST -p $REDIS_PORT ping

# Verificar conectividad Backend
curl -H "Authorization: Bearer $WORKER_API_KEY" $BACKEND_API_URL/api/worker/health

# Verificar firewall
sudo ufw status
```

## 📁 Estructura de Archivos

```
/opt/transcoding-worker/
├── src/
│   └── workers/
│       └── transcoding-worker.ts    # Código principal del worker
├── dist/                            # Código compilado
├── prisma/
│   └── schema.prisma               # Esquema de base de datos
├── node_modules/                   # Dependencias
├── package.json                    # Configuración del proyecto
├── tsconfig.json                   # Configuración TypeScript
├── ecosystem.config.js             # Configuración PM2
├── monitor.sh                      # Script de monitoreo
├── .env                           # Variables de entorno
└── README.md                      # Esta documentación

/var/log/transcoding-worker/
├── combined.log                   # Logs combinados
├── out.log                       # Logs de salida
├── error.log                     # Logs de error
└── monitor.log                   # Logs de monitoreo

/tmp/audio-processing/            # Archivos temporales de trabajo
```

## 🔒 Seguridad

### Configuración de Firewall

```bash
# Solo permitir SSH y conexiones necesarias
sudo ufw allow ssh
sudo ufw allow from your-backend-server-ip
sudo ufw enable
```

### Actualizaciones de Seguridad

```bash
# Configurar actualizaciones automáticas
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

### Backup de Configuración

```bash
# Crear backup de configuración
tar -czf transcoding-worker-backup-$(date +%Y%m%d).tar.gz \
  /opt/transcoding-worker/.env \
  /opt/transcoding-worker/ecosystem.config.js
```

## 📈 Escalabilidad

### Múltiples Workers

Para mayor capacidad de procesamiento, puedes configurar múltiples instancias:

```javascript
// En ecosystem.config.js
module.exports = {
  apps: [{
    name: 'transcoding-worker',
    script: './dist/workers/transcoding-worker.js',
    instances: 2, // Número de instancias
    exec_mode: 'fork'
  }]
};
```

### Balanceador de Carga

Para múltiples VPS, configura un balanceador de carga Redis o usa múltiples colas.

## 📞 Soporte

Para problemas o preguntas:

1. Revisar logs: `npm run pm2:logs`
2. Verificar monitoreo: `./monitor.sh`
3. Consultar documentación del proyecto principal
4. Contactar al equipo de desarrollo
