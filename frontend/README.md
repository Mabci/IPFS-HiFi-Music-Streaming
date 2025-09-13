# Frontend

## Objetivo
Implementar la experiencia de usuario: navegación, búsqueda, biblioteca y un reproductor de audio robusto que consuma medios desde IPFS.

## Stack propuesto
- React + Next.js (TypeScript)
- UI: TailwindCSS
- Estado: Zustand o Context (MVP), escalable a Redux si es necesario
- Audio: HTMLAudioElement (descarga progresiva) con soporte AAC/FLAC

## Estructura propuesta
- `app/` o `pages/` (según versión de Next)
- `components/` (Player, Queue, TrackList, SearchBar, etc.)
- `lib/` (utilidades, clientes)
- `public/` (assets estáticos)
- `styles/`

## Reproductor, Metadata y Portadas (implementado)
- Reproductor custom en `components/Player.tsx` con `@radix-ui/react-slider` y iconos `lucide-react` vía `dynamic(..., { ssr:false })` para evitar hydration mismatch.
- Metadata en `lib/metadata.ts`:
  - `extractFromHttp(url)`: descarga parcial (HTTP Range) y parseo con `music-metadata`.
  - `extractFromBlob(blob)`: parseo local para P2P Helia.
  - `TrackMetadata` incluye `mbReleaseId` (detecta variantes camelCase/snake_case) y `coverUrl` si hay portada embebida.
- Calidad de audio en mini-reproductor:
  - Badge compacto con “FORMATO • kHz • kbps [• bits-bit]”, por ejemplo: `FLAC • 44.1 kHz • 1020 kbps • 24-bit`.
  - Campos añadidos en `TrackMetadata`: `codec`, `sampleRateHz`, `bitrateKbps`, `bitsPerSample`, `lossless`.
  - Si la cola trae `meta` previa, el Player enriquece estos campos sin sobrescribir los ya presentes.
- Helia en `lib/helia.ts`: `fetchFileToBlob(cid)` y `fetchFileToBlobUrl(cid)` refactorizado.
- Portadas en `lib/cover.ts`:
  - `coverFromMB(mbid)`: consulta directa a Cover Art Archive (release → release-group).
  - `findCover({ artist, album, title })`: MusicBrainz primero, iTunes como fallback.
- Fallbacks de portadas:
  - Normalización a HTTPS para URLs de CAA e iTunes (evita mixed content en navegador).
- Caché de metadata versionada:
  - Clave `mm:v2:track:<url>` para invalidar entradas antiguas sin campos de calidad.
- Orden de resolución de portada en `Player.tsx`: embebida → CAA por MBID → búsqueda MB → iTunes.
- Documentación:
  - Update: `docs/updates/2025-08-20-player-metadata-covers.md`.
  - Update: `docs/updates/2025-08-20-player-quality-and-fallbacks.md`.
  - ADR: `docs/decisions/0003-adr-covers-provider.md`.

## Próximos pasos (Fase 1)
- Esqueleto de la app y layout
- Player persistente con controles básicos
- Vista de Buscar y Biblioteca con datos mock
- Reproducción de demos desde CIDs vía Gateway
