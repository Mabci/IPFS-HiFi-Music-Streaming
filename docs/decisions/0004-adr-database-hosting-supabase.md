# 0004 - Alojamiento de base de datos: Supabase (PostgreSQL gestionado)

- Estado: Aprobado
- Fecha: 2025-08-21
- Decisores: Equipo Backend

## Contexto
Se requiere PostgreSQL como base del proyecto (usuarios OAuth, catálogo, playlists/likes y covers). El entorno local con Docker no está disponible por falta de virtualización/WSL2 en la máquina de desarrollo. Se evaluaron alternativas para disponer rápidamente de una base estable para desarrollo y preview.

## Decisión
- Usar **Supabase (PostgreSQL gestionado)** para desarrollo/preview.
- Configurar Prisma con:
  - `DATABASE_URL` hacia el pooler (PgBouncer) en puerto 6543, con `pgbouncer=true&connection_limit=1&sslmode=require` para el runtime.
  - `directUrl` y `shadowDatabaseUrl` a la conexión directa (5432) con `sslmode=require` para migraciones y shadow DB.
- Mantener `.env` fuera de control de versiones; ignorar archivos de ejemplo con credenciales en docs.

## Consecuencias
- + Disponibilidad inmediata sin virtualización local.
- + Conexión consistente entre entornos con SSL.
- − Latencia de red frente a DB local.
- − Límites de conexiones: se mitigan usando PgBouncer (pooler) y `connection_limit=1` en Prisma Client.
- Seguridad: rotación de contraseña si se expone y evitar publicar credenciales en el repositorio.

## Implementación
- `backend/prisma/schema.prisma` incluye `directUrl` y `shadowDatabaseUrl`.
- `.env` del backend define `DATABASE_URL`, `DIRECT_URL` y `SHADOW_DATABASE_URL` según el panel de Supabase (ORMs → Prisma).
- Migraciones con `npx prisma migrate dev` se ejecutan contra la URL directa (5432).
- Healthcheck `GET /api/health` verifica la conexión ejecutando `SELECT 1`.

## Alternativas consideradas
- Docker local (PostgreSQL en contenedor): bloqueado por virtualización deshabilitada.
- PostgreSQL nativo en Windows: viable, pero mayor fricción de instalación y mantenimiento.
- Otros DBaaS (Neon, Railway, RDS): válidos; Supabase ofrece experiencia directa y guía específica para Prisma.

## Plan de adopción
1. Ajustar `schema.prisma` con `directUrl` y `shadowDatabaseUrl` (completado).
2. Configurar `.env` con variables del panel de Supabase, incluyendo `sslmode=require` (completado).
3. Ejecutar migraciones iniciales (completado).
4. Añadir `.gitignore` para evitar filtrar archivos con credenciales (completado).
5. Rotar credenciales si fueron compartidas y actualizar `.env` (pendiente si aplica).

## Referencias
- Update: `docs/updates/2025-08-21-backend-prisma-supabase.md`
- Prisma + Supabase (Pooler/Direct): panel Supabase → ORMs → Prisma.
