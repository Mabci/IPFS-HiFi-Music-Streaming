# Plan de Deployment en Vercel con Dominio nyauwu.com - 13 Septiembre 2025

## Resumen del Plan

Con el dominio **nyauwu.com** disponible, configuraremos un deployment completo en Vercel para tener la plataforma funcionando en producción. Esto permitirá desarrollo iterativo con previews automáticos y deployment continuo.

## Arquitectura de Deployment

### Frontend (Next.js)
- **Plataforma**: Vercel
- **Dominio**: nyauwu.com
- **Framework**: Next.js 15.5.0 con App Router
- **Build**: Automático desde Git push

### Backend (Express + Prisma)
- **Opción 1**: Vercel Serverless Functions (recomendado para MVP)
- **Opción 2**: Railway/Render para backend persistente (futuro)
- **Base de datos**: Supabase PostgreSQL (ya configurado)
- **Cola de trabajos**: Redis Cloud (ya funcionando)

### Infraestructura Existente
- **VPS Transcodificación**: 216.238.92.78 (mantener)
- **Redis Cloud**: Conexión estable (mantener)
- **IPFS Gateway**: Por implementar en VPS

## Configuración Realizada

### 1. Archivos de Configuración Vercel ✅

#### `vercel.json`
```json
{
  "version": 2,
  "builds": [
    {
      "src": "frontend/package.json",
      "use": "@vercel/next"
    },
    {
      "src": "backend/package.json", 
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "backend/src/index.ts"
    },
    {
      "src": "/(.*)",
      "dest": "frontend/$1"
    }
  ]
}
```

#### `.vercelignore`
- Excluye archivos innecesarios para deployment
- Reduce tamaño del bundle
- Protege archivos sensibles

### 2. Next.js Configurado ✅

#### `frontend/next.config.mjs`
```javascript
// Configuración para Vercel deployment
env: {
  BACKEND_URL: process.env.BACKEND_URL || 'https://nyauwu.com',
  NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || 'https://nyauwu.com',
},

// Reescritura de rutas API para el backend
async rewrites() {
  return [
    {
      source: '/api/:path*',
      destination: `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/:path*`,
    },
  ];
}
```

### 3. Variables de Entorno de Producción ✅

#### `backend/ENV.production.sample`
```env
NODE_ENV=production
DATABASE_URL="postgresql://postgres.xxx:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
REDIS_HOST=redis-15560.c15.us-east-1-4.ec2.redns.redis-cloud.com
FRONTEND_URL=https://nyauwu.com
BACKEND_URL=https://nyauwu.com
```

## Pasos para Deployment

### 1. Preparación del Repositorio
```bash
# Inicializar Git si no existe
git init
git add .
git commit -m "Initial commit - Ready for Vercel deployment"

# Crear repositorio en GitHub
# Subir código
git remote add origin https://github.com/tu-usuario/plataforma-musica-ipfs
git push -u origin main
```

### 2. Configuración en Vercel
1. **Conectar repositorio**: Importar desde GitHub
2. **Configurar dominio**: nyauwu.com → Proyecto Vercel
3. **Variables de entorno**: Configurar desde ENV.production.sample
4. **Deploy automático**: Activar desde main branch

### 3. Configuración DNS
```
# Registros DNS para nyauwu.com
A     @     76.76.19.61        # Vercel IP
CNAME www   nyauwu.com         # Redirect www
```

### 4. Variables de Entorno Críticas
```env
# En Vercel Dashboard
DATABASE_URL=postgresql://...
REDIS_HOST=redis-15560.c15.us-east-1-4.ec2.redns.redis-cloud.com
REDIS_PORT=15560
REDIS_PASSWORD=R2cfPS6wOD02ykIIvyyO9LSaYf5OhWun
FRONTEND_URL=https://nyauwu.com
BACKEND_URL=https://nyauwu.com
```

## Componentes Pendientes por Prioridad

### 🔴 Prioridad Alta (Bloqueadores)

#### 1. IPFS Gateway Privada
**Estado**: No iniciado
**Ubicación**: VPS 216.238.92.78 puerto 8080
**Función**: Servir contenido IPFS solo de CIDs registrados

```bash
# Comandos de instalación en VPS
curl -sSL https://dist.ipfs.io/go-ipfs/v0.17.0/go-ipfs_v0.17.0_linux-amd64.tar.gz | tar -xz
sudo mv go-ipfs/ipfs /usr/local/bin/
ipfs init
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["*"]'
ipfs daemon --enable-gateway
```

#### 2. UI de Upload (4 Páginas)
**Estado**: No iniciado
**Estructura**:
```
frontend/app/upload/
├── page.tsx              # Página 1: Upload archivos
├── tracks/page.tsx       # Página 2: Orden tracks  
├── metadata/page.tsx     # Página 3: Metadatos álbum
└── preview/page.tsx      # Página 4: Preview final
```

### 🟡 Prioridad Media

#### 3. Sistema de Búsqueda
**Estado**: No iniciado
**Implementación**: ILIKE simple por artista/álbum/canción

```sql
SELECT * FROM "Album" a
JOIN "ArtistProfile" ap ON a.artistProfileId = ap.id  
WHERE 
  a.title ILIKE '%query%' OR 
  ap.artistName ILIKE '%query%'
```

#### 4. Google OAuth para Producción
**Estado**: Configuración pendiente
**Dominio autorizado**: https://nyauwu.com
**Callback URL**: https://nyauwu.com/api/auth/google/callback

## Flujo de Desarrollo Propuesto

### 1. Desarrollo Local
```bash
# Frontend
cd frontend && npm run dev

# Backend  
cd backend && npm run dev

# Testing completo local
```

### 2. Preview Deployments
- **Push a feature branch** → Preview automático en Vercel
- **URL temporal**: https://plataforma-musica-git-feature.vercel.app
- **Testing en preview** antes de merge

### 3. Production Deployment
- **Merge a main** → Deploy automático a nyauwu.com
- **Rollback disponible** desde Vercel dashboard
- **Monitoreo** con Vercel Analytics

## Ventajas del Setup con Vercel

### ✅ Beneficios Inmediatos
1. **Deploy automático**: Git push → Live en segundos
2. **Preview branches**: Testing seguro de features
3. **Dominio personalizado**: nyauwu.com profesional
4. **SSL automático**: HTTPS incluido
5. **CDN global**: Velocidad optimizada
6. **Rollback fácil**: Un click para revertir

### ✅ Escalabilidad
1. **Serverless functions**: Auto-scaling del backend
2. **Edge caching**: Contenido estático optimizado
3. **Analytics incluidos**: Métricas de uso
4. **Limits generosos**: 100GB bandwidth gratis

## Limitaciones y Consideraciones

### ⚠️ Limitaciones Vercel
1. **Serverless timeout**: 10s en plan gratuito (30s Pro)
2. **File uploads**: Limitado para archivos grandes
3. **Persistent connections**: WebSockets limitados

### 🔧 Soluciones
1. **Uploads grandes**: Usar VPS para procesamiento
2. **WebSockets**: Implementar en VPS si necesario
3. **Timeouts**: Procesos largos en VPS worker

## Próximos Pasos Inmediatos

### 1. Setup Inicial (30 min)
- [ ] Crear repositorio GitHub
- [ ] Conectar Vercel
- [ ] Configurar dominio nyauwu.com
- [ ] Deploy inicial

### 2. IPFS Gateway (2-3 horas)
- [ ] Instalar IPFS en VPS
- [ ] Configurar gateway HTTP
- [ ] Conectar con base de datos
- [ ] Testing de acceso

### 3. UI de Upload Básica (4-6 horas)
- [ ] Página 1: Upload de archivos
- [ ] Integración con backend existente
- [ ] Testing end-to-end
- [ ] Deploy a producción

## Métricas de Éxito

### Técnicas
- **Deploy time**: < 2 minutos
- **Build success**: 100%
- **Uptime**: 99.9%+
- **Load time**: < 3s

### UX
- **Dominio profesional**: nyauwu.com funcionando
- **Upload funcional**: Flujo completo operativo
- **Feedback tiempo real**: WebSockets funcionando

## Conclusión

Con Vercel y nyauwu.com tendremos:
1. **Plataforma en producción** funcionando
2. **Desarrollo iterativo** con previews
3. **Infraestructura escalable** y profesional
4. **Base sólida** para features futuras

El sistema backend ya está listo, solo necesitamos completar la gateway IPFS y la UI de upload para tener un MVP completamente funcional en producción.
