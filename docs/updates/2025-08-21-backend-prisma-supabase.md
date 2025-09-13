# Update: Backend con Prisma + Supabase (migraciones y healthcheck)

Fecha: 2025-08-21
Autor: Plataforma de música IPFS (backend)

## Resumen
- Se configuró PostgreSQL gestionado en Supabase como base de datos de desarrollo/preview.
- Prisma quedó integrado con conexión pooler para runtime y conexión directa para migraciones.
- Se ejecutó la migración inicial y el backend responde OK en `GET /api/health`.
- Se añadió logging de error en el healthcheck para facilitar diagnóstico.
- Se saneó `.gitignore` para evitar filtrar secretos guardados en docs.

## Cambios principales
- `backend/prisma/schema.prisma`
  - En `datasource db` se agregaron `directUrl` y `shadowDatabaseUrl` para soportar Supabase (pooler + directa).
- `backend/src/index.ts`
  - Healthcheck ahora registra el error en consola y devuelve `message` en el JSON cuando hay fallo de DB.
- `.gitignore`
  - Ignorado `Dependencies Docs/prisma-main/.db.env` para evitar exponer credenciales.
- `Dependencies Docs/prisma-main/.db.env`
  - Documento depurado para contener solo variables relevantes de Supabase + Prisma con placeholders.

## Detalles técnicos
- Base de datos: PostgreSQL en Supabase.
- Prisma:
  - `DATABASE_URL` (pooler, puerto 6543) con `pgbouncer=true&connection_limit=1&sslmode=require` para la app.
  - `DIRECT_URL` y `SHADOW_DATABASE_URL` (conexión directa, puerto 5432) con `sslmode=require` para migraciones y shadow.
- Salud del backend: `GET /api/health` ejecuta `SELECT 1` vía Prisma.

## Variables de entorno (ejemplo)
```env
# App/runtime (Pooler)
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@YOUR_HOST.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require"

# Migraciones (Directa)
DIRECT_URL="postgresql://postgres:YOUR_PASSWORD@YOUR_HOST.supabase.com:5432/postgres?sslmode=require"

# Shadow DB (Directa)
SHADOW_DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@YOUR_HOST.supabase.com:5432/postgres?sslmode=require"

PORT=4000
```

## Cómo probar
1) En `backend/`, aplicar migraciones (si fuera necesario):
```powershell
npx prisma migrate dev --name init
```
2) Iniciar backend:
```powershell
npm run dev
```
3) Probar healthcheck:
```powershell
curl.exe http://localhost:4000/api/health
# esperado: {"ok":true,"db":"ok"}
```

## Archivos modificados/creados
- `backend/prisma/schema.prisma`
- `backend/src/index.ts`
- `.gitignore`
- `Dependencies Docs/prisma-main/.db.env`

## Consideraciones de seguridad
- Rotar la contraseña de la DB en Supabase si se compartió previamente.
- Mantener `.env` fuera del control de versiones (ya ignorado).

## Próximos pasos sugeridos
- Implementar OAuth (Google) y endpoints CRUD (`playlists`, `likes`, catálogo global).
- Añadir Prisma Studio a scripts de `backend/package.json` y abrir para validar datos.
- Integrar frontend con el backend para auth y biblioteca.

## Decisiones relacionadas
- Ver ADR `docs/decisions/0004-adr-database-hosting-supabase.md`.
