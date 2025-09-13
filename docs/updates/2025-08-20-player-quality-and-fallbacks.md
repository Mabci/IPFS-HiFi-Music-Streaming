# Update: Calidad de audio en mini reproductor y normalización HTTPS de portadas

Fecha: 2025-08-20
Autor: Plataforma de música IPFS (frontend)

## Resumen
Se añadió visualización de calidad del audio en el mini reproductor (formato/códec, kHz y kbps, con bits opcional). También se versionó la caché de metadata para refrescar los nuevos campos y se normalizaron a HTTPS las URLs de portadas de CAA/iTunes para evitar mixed content.

## Cambios principales
- Player (`frontend/components/Player.tsx`):
  - Badge compacto con “FORMATO • kHz • kbps [• bits-bit]”, por ejemplo: `FLAC • 44.1 kHz • 1020 kbps • 24-bit`.
  - Enriquecimiento de `preMeta`: si la pista ya traía metadata parcial, se re-extraen campos de calidad sin sobrescribir lo ya presente.
  - Mantiene orden de portada: embebida → CAA (por MBID) → búsqueda MusicBrainz → iTunes.
- Metadata (`frontend/lib/metadata.ts`):
  - `TrackMetadata` ahora incluye: `sampleRateHz`, `bitrateKbps`, `bitsPerSample`, `codec`, `lossless`.
  - Extracción desde `meta.format` con `music-metadata` en `extractFromBlob()`.
  - `extractFromHttp()` sigue usando lectura parcial (Range o streaming parcial) y delega a `extractFromBlob()`.
- Álbum y caché (`frontend/lib/album.ts`):
  - Versionado de claves de caché de metadata: `mm:track:` → `mm:v2:track:` para invalidar entradas anteriores sin los nuevos campos.
  - Concurrencia controlada para no saturar el gateway.
- Portadas (`frontend/lib/cover.ts`):
  - URLs de CAA e iTunes normalizadas a HTTPS para evitar mixed content.

## Notas de UI
- El cambio visible es el nuevo badge de calidad en el mini reproductor. No hay otros ajustes de UI en esta actualización.

## Archivos modificados
- `frontend/components/Player.tsx`
- `frontend/lib/metadata.ts`
- `frontend/lib/album.ts`
- `frontend/lib/cover.ts`

## Consideraciones
- Si una cola fue creada antes del cambio, re-cargar el álbum/CID para forzar regeneración de metadata con la nueva clave `mm:v2:track:`.
- Algunos gateways pueden requerir leer más bytes para derivar bitrate/códec; ajustar `byteCount` en `extractFromHttp()` si fuera necesario.
