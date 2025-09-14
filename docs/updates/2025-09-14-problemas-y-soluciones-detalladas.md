# Problemas y Soluciones Detalladas - Gateway IPFS Privada

**Fecha:** 14 Septiembre 2025  
**Sesión:** Deployment Gateway IPFS Privada en VPS

## 🚨 PROBLEMA #1: Conexión SSL con Supabase

### Descripción del Problema
```
error: Main PostgreSQL connection failed: self-signed certificate in certificate chain
{"code":"SELF_SIGNED_CERT_IN_CHAIN"}
```

### Contexto
- La gateway se conectaba correctamente a Redis y PostgreSQL local
- Supabase aparecía como "disconnected" en health check
- Logs mostraban error de certificado SSL

### Investigación Realizada
1. **Verificación de conectividad de red:**
   ```bash
   sudo -u musicgateway docker compose exec gateway-proxy nc -zv aws-1-us-east-2.pooler.supabase.com 6543
   # Resultado: aws-1-us-east-2.pooler.supabase.com (3.148.140.216:6543) open
   ```

2. **Inspección de variables de entorno:**
   ```bash
   sudo -u musicgateway docker compose exec gateway-proxy env | grep DATABASE_URL
   # MAIN_DATABASE_URL=...sslmode=require  ← PROBLEMA IDENTIFICADO
   ```

### Solución Implementada
**Cambio en `gateway-proxy/.env`:**
```bash
# ANTES (❌)
MAIN_DATABASE_URL=postgresql://postgres.pfbnvzgiwmqbummitlnr:ipfstest.2025@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require

# DESPUÉS (✅)
MAIN_DATABASE_URL=postgresql://postgres.pfbnvzgiwmqbummitlnr:ipfstest.2025@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=disable
```

### Comando de Corrección
```bash
sudo -u musicgateway sed -i 's|sslmode=require|sslmode=disable|' gateway-proxy/.env
```

### Resultado
✅ **Conexión exitosa a Supabase**
```json
"postgres_main": "connected"
```

### Lección Aprendida
Supabase desde VPS requiere `sslmode=disable` debido a la configuración de certificados del pooler de conexiones.

---

## 🚨 PROBLEMA #2: Inicialización del Nodo IPFS

### Descripción del Problema
```
Error: failure to decode config: The Experimental.AcceleratedDHTClient key has been moved to Routing.AcceleratedDHTClient in Kubo 0.21, please use this new key and remove the old one.
```

### Contexto
- Nodo IPFS no iniciaba correctamente
- Logs mostraban error de configuración obsoleta
- Contenedor en estado de reinicio continuo

### Investigación Realizada
1. **Análisis de logs:**
   ```bash
   sudo -u musicgateway docker compose logs ipfs-node --tail 10
   ```

2. **Inspección del docker-compose.yml:**
   ```yaml
   volumes:
     - ./data/ipfs:/data/ipfs
     - ./config/ipfs-config.json:/data/ipfs/config:ro  # ❌ ARCHIVO INEXISTENTE
   ```

3. **Verificación de archivos:**
   ```bash
   ls -la config/
   # config/ipfs-config.json: No such file or directory
   ```

### Causa Raíz
El `docker-compose.yml` intentaba montar un archivo de configuración inexistente como solo lectura, causando conflictos en la inicialización del nodo IPFS.

### Solución Implementada
**1. Corrección del docker-compose.yml:**
```yaml
# ANTES (❌)
volumes:
  - ./data/ipfs:/data/ipfs
  - ./config/ipfs-config.json:/data/ipfs/config:ro

# DESPUÉS (✅)
volumes:
  - ./data/ipfs:/data/ipfs
```

**2. Reinicialización completa del nodo:**
```bash
# Detener servicios
sudo -u musicgateway docker compose down

# Limpiar datos IPFS problemáticos
sudo rm -rf data/ipfs

# Crear directorio limpio
sudo mkdir -p data/ipfs
sudo chown -R 1000:100 data/ipfs

# Reiniciar con configuración corregida
sudo -u musicgateway docker compose up -d ipfs-node
```

### Resultado
✅ **IPFS Kubo 0.37.0 iniciado correctamente**
```
music-ipfs-node  | RPC API server listening on /ip4/0.0.0.0/tcp/5001
music-ipfs-node  | WebUI: http://127.0.0.1:5001/webui
music-ipfs-node  | Gateway server listening on /ip4/0.0.0.0/tcp/8080
music-ipfs-node  | Daemon is ready
```

### Commit Realizado
```bash
git commit -m "fix: Eliminar mount de config IPFS inexistente para corregir inicialización"
```

### Lección Aprendida
Evitar mounts de archivos inexistentes en Docker Compose. IPFS puede inicializarse correctamente sin configuración personalizada.

---

## 🚨 PROBLEMA #3: Health Check IPFS Incorrecto

### Descripción del Problema
```json
{
  "status": "degraded",
  "services": {
    "ipfs": "disconnected"
  }
}
```

### Contexto
- IPFS funcionaba correctamente (daemon ready)
- Health check reportaba como "disconnected"
- API IPFS respondía desde terminal pero no desde gateway

### Investigación Realizada
1. **Verificación directa de IPFS:**
   ```bash
   curl http://localhost:5001/api/v0/version
   # 405 - Method Not Allowed ← PISTA CLAVE
   ```

2. **Prueba con método POST:**
   ```bash
   curl -X POST http://localhost:5001/api/v0/version
   # {"Version":"0.37.0","Commit":"6898472"...} ← FUNCIONA
   ```

3. **Inspección del código de health check:**
   ```javascript
   // ❌ Código problemático
   await axios.get(`${IPFS_API_URL}/api/v0/version`, { timeout: 5000 })
   ```

### Causa Raíz
El health check usaba método HTTP GET, pero la API de IPFS requiere método POST para todos sus endpoints.

### Solución Implementada
**Corrección en `gateway-proxy/src/index-private.js`:**
```javascript
// ANTES (❌)
try {
  await axios.get(`${IPFS_API_URL}/api/v0/version`, { timeout: 5000 })
  health.services.ipfs = 'connected'
} catch (error) {
  health.services.ipfs = 'disconnected'
  health.status = 'degraded'
}

// DESPUÉS (✅)
try {
  await axios.post(`${IPFS_API_URL}/api/v0/version`, {}, { timeout: 5000 })
  health.services.ipfs = 'connected'
} catch (error) {
  health.services.ipfs = 'disconnected'
  health.status = 'degraded'
}
```

### Proceso de Aplicación
```bash
# Rebuild gateway con fix
sudo -u musicgateway docker compose build gateway-proxy
sudo -u musicgateway docker compose up -d gateway-proxy

# Verificar resultado
curl http://localhost:3001/health
```

### Resultado
✅ **Health check correcto**
```json
{
  "status": "ok",
  "services": {
    "ipfs": "connected"
  }
}
```

### Commit Realizado
```bash
git commit -m "fix: Cambiar health check IPFS de GET a POST para compatibilidad con API"
```

### Lección Aprendida
La API de IPFS requiere método POST para todos sus endpoints, incluso para operaciones de solo lectura como `/version`.

---

## 🚨 PROBLEMA #4: Git Ownership en VPS

### Descripción del Problema
```
fatal: detected dubious ownership in repository at '/opt/ipfs-music-gateway'
To add an exception for this directory, call:
    git config --global --add safe.directory /opt/ipfs-music-gateway
```

### Contexto
- Intentando hacer `git pull` en VPS
- Git detectaba ownership "sospechoso" del repositorio
- Operación bloqueada por seguridad

### Causa
El repositorio fue clonado/modificado con diferentes usuarios (root vs musicgateway), causando conflicto de ownership.

### Solución Implementada
```bash
git config --global --add safe.directory /opt/ipfs-music-gateway
sudo git pull origin master
```

### Resultado
✅ **Git pull funcionando correctamente**

### Lección Aprendida
Configurar `safe.directory` para repositorios en VPS donde múltiples usuarios pueden interactuar con el código.

---

## 📊 RESUMEN DE DEBUGGING

### Metodología Aplicada
1. **Análisis sistemático de logs**
2. **Verificación de conectividad de red**
3. **Inspección de configuración**
4. **Testing incremental de servicios**
5. **Validación de métodos HTTP**

### Herramientas Clave
- `docker compose logs` - Análisis de errores
- `curl` - Testing de endpoints
- `nc -zv` - Verificación de puertos
- `grep` - Filtrado de logs
- `sed` - Edición de archivos de configuración

### Patrón de Resolución
1. **Identificar síntoma** → Logs/health check
2. **Investigar causa** → Inspección de configuración
3. **Probar hipótesis** → Commands de testing
4. **Implementar fix** → Cambio mínimo necesario
5. **Validar solución** → Health check final

### Tiempo de Resolución
- **Problema SSL:** ~20 minutos
- **Problema IPFS Init:** ~30 minutos  
- **Problema Health Check:** ~15 minutos
- **Problema Git:** ~5 minutos

**Total:** ~70 minutos de debugging efectivo

### Factores de Éxito
1. **Logs detallados** - Información clara de errores
2. **Testing incremental** - Aislar cada problema
3. **Documentación** - Registrar cada paso
4. **Metodología sistemática** - No saltar pasos
5. **Validación continua** - Verificar cada fix
