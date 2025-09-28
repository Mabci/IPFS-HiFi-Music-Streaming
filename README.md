# Plataforma de Música sobre IPFS

Una plataforma tipo Spotify/TIDAL construida para aprovechar IPFS al máximo. Este repositorio sigue un enfoque frontend-first para iterar rápido en UX y luego consolidar la capa de backend e infraestructura.

## Estructura del repositorio
- `docs/`: documentación funcional y técnica
  - `features-scope.md`: análisis de features y alcance por fases
  - `decisions/`: ADRs (Architecture Decision Records)
- `frontend/`: aplicación web (UI/UX, reproductor, búsqueda, biblioteca)
- `backend/`: servicios de catálogo, playlists, usuarios y orquestación IPFS
- `infra/ipfs/`: configuración de nodos, gateways y pinning
- `product/`: visión de producto, métricas, roadmap
- `research/`: experimentos de codecs (AAC/FLAC), descarga progresiva y performance

## Hoja de ruta (resumen)
- Fase 1: Frontend Web MVP (player + biblioteca básica + reproducción progresiva vía IPFS Gateway)
- Fase 2: Multiplataforma + IPFS (Desktop wrapper, Android MVP, subida/pinning, resolución de CIDs)
- Fase 3: Backend ligero (catálogo, playlists, auth básica)
- Fase 4: Features avanzadas (descubrimiento, social, offline, observabilidad)

## Cómo empezar
1) Lee `docs/features-scope.md` para el alcance y fases.
2) Revisa `docs/decisions/` para entender las decisiones arquitectónicas.
3) Trabajaremos primero `frontend/`. El backend e infraestructura vendrán en fases siguientes.

## ✅ Estado Actual - PLATAFORMA FUNCIONAL
🎉 **Sistema completamente operativo con infraestructura propia**

### 🏗️ Arquitectura Desplegada:
- **Frontend**: Next.js en Vercel ([nyauwu.com](https://nyauwu.com))
- **Backend**: Express.js en Render
- **Base de Datos**: PostgreSQL + Prisma ORM  
- **IPFS**: VPS Vultr con gateway privado
- **Costo Total**: ~$20/mes para infraestructura completa

### 🎵 Características Hi-Fi Implementadas:
- ✅ **Sistema de calidades múltiples**: AAC 320kbps / FLAC 16bit/44.1kHz / FLAC 24bit/192kHz
- ✅ **Switching de calidad inteligente**: Durante reproducción se aplica en próxima canción
- ✅ **Streaming progresivo IPFS**: Descarga solo chunks necesarios
- ✅ **Covers independientes**: Cada álbum tiene su cover por CID separado
- ✅ **Notificaciones elegantes**: UI/UX pulido para cambios de estado
- ✅ **Bucle con calidad pendiente**: Aplica nuevas calidades incluso en repeat

### 🔧 URLs Activas:
- **App Principal**: https://nyauwu.com
- **Subida de Artistas**: https://artist.nyauwu.com
- **API Backend**: https://ipfs-hifi-music-streaming.onrender.com
- **IPFS Gateway**: https://216.238.81.58:8080/ipfs

## Actualizaciones recientes
- **2025-09-28**: Sistema de calidades múltiples completamente funcional con switching inteligente
- **2025-09-28**: Covers independientes por CID - no embebidos en metadatos
- **2025-09-28**: Arquitectura simplificada - eliminado sistema dual complejo
- 2025-08-20: `docs/updates/2025-08-20-player-quality-and-fallbacks.md` — Badge de calidad (códec, kHz, kbps, bits) en el mini reproductor, caché `mm:v2:track` y normalización HTTPS en portadas.
- 2025-08-20: `docs/updates/2025-08-20-player-metadata-covers.md` — Reproductor custom, extracción de metadata y portadas (MusicBrainz/CAA como primario, iTunes como fallback).

## Convenciones
- Monorepo con `frontend/` y `backend/`.
- Idioma principal de documentación: Español.
- Versionado SemVer cuando existan releases.
