# Update: Reproductor custom, extracción de metadata y portadas (MusicBrainz/CAA + iTunes)

Fecha: 2025-08-20
Autor: Plataforma de música IPFS (frontend)

## Resumen
Se implementó un reproductor custom en `frontend/components/Player.tsx`, extracción de metadata embebida usando `music-metadata` (sin HLS; HTTP Range y P2P Helia), y recuperación de portada con prioridad a MusicBrainz + Cover Art Archive (CAA) y fallback a iTunes. También se resolvieron warnings de hidratación con iconos (`lucide-react`) mediante imports dinámicos sin SSR.

## Cambios principales
- UI del reproductor:
  - Reproductor custom sin `controls` nativos con `@radix-ui/react-slider` para progreso y volumen.
  - Iconos de `lucide-react` con imports dinámicos `{ ssr: false }` para evitar hydration mismatch.
  - Muestra portada, título, artista y álbum.
- Extracción de metadata (`frontend/lib/metadata.ts`):
  - `extractFromHttp(url)`: descarga parcial con `Range` y parseo con `parseBlob`.
  - `extractFromBlob(blob)`: parseo local (P2P) sin descargas adicionales.
  - `TrackMetadata` ahora incluye `mbReleaseId` (detecta variantes camelCase y snake_case: `musicbrainzReleaseId`, `musicbrainzAlbumId`, `musicbrainzReleaseGroupId`, etc.).
- Helia (`frontend/lib/helia.ts`):
  - Nuevo `fetchFileToBlob(cid)` y `fetchFileToBlobUrl(cid)` refactorizado para reutilizar el Blob.
- Portadas (`frontend/lib/cover.ts`):
  - Proveedor primario: MusicBrainz + Cover Art Archive (CAA).
  - Fallback: iTunes Search API.
  - Funciones clave: `coverFromMB(mbid)` (CAA por release y release-group) y `findCover({ artist, album, title })`.
- Integración en `Player.tsx`:
  - Orden de portada: `common.picture` embebida → `coverFromMB(mbReleaseId)` → `findCover()` (MB/CAA → iTunes).
  - Limpieza de recursos: `URL.revokeObjectURL` para blobs locales de audio y portada.

## Detalles técnicos
- HTTP (gateway IPFS): se usa una petición con `Range: bytes=0-...` (1 MB por defecto) para extraer tags rápidamente sin descargar todo el audio.
- P2P (Helia): se obtiene un `Blob` con `unixfs.cat()`, se crea `blob:` para el `<audio>` y se parsea metadata localmente.
- CORS: MusicBrainz, CAA e iTunes permiten CORS desde navegador.
- User-Agent (MusicBrainz): recomendable enrutar por backend para agregar header UA, cache y rate limiting en producción.

## Archivos modificados/creados
- `frontend/components/Player.tsx`: reproductor custom, integración metadata y portadas.
- `frontend/lib/metadata.ts`: `extractFromHttp`, `extractFromBlob`, `TrackMetadata.mbReleaseId`.
- `frontend/lib/helia.ts`: `fetchFileToBlob`, refactor `fetchFileToBlobUrl`.
- `frontend/lib/cover.ts`: `coverFromMB`, `findCover`, búsquedas MB y fallback iTunes.
- `frontend/components/Topbar.tsx` y `frontend/components/SidebarNav.tsx`: iconos de `lucide-react` via `dynamic(..., { ssr:false })`.

## Qué falta / próximos pasos
- Estado global (Zustand): cola, pista actual, repeat/shuffle, volumen global, toggle P2P.
- Media Session API: controles del sistema, lockscreen con portada.
- Cache de portadas (Zustand/localStorage) y de metadata.
- Mejorar precisión MB: filtros por país/año/"official" y uso de MBIDs cuando estén disponibles (ya soportado si vienen en tags).
- Páginas mock: `/search`, `/library`, `/playlist/[id]` con datos dummy.
- Accesibilidad: roles ARIA, focus visible, atajos de teclado.
- Backend proxy opcional para MusicBrainz/CAA con User-Agent y cache.

## Decisiones relacionadas
- Ver ADR `docs/decisions/0003-adr-covers-provider.md`.
