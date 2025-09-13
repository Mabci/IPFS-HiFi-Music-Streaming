# 0003 - Proveedor de portadas: MusicBrainz + Cover Art Archive (primario) e iTunes (fallback)

- Estado: Aprobado
- Fecha: 2025-08-20
- Decisores: Equipo Frontend (Plataforma música IPFS)

## Contexto
Necesitamos mostrar imágenes de carátula (cover art) para las pistas reproducidas desde IPFS. Los archivos pueden o no incluir portada embebida en los metadatos. Queremos una solución:
- Sin claves de API.
- Con buen alcance de base de datos.
- Con CORS habilitado desde navegador.
- Compatible con nuestra estrategia de entrega (HTTP Range y P2P Helia) y codecs (AAC/FLAC).

## Decisión
- Usar como proveedor primario de portadas: **MusicBrainz + Cover Art Archive (CAA)**.
  - Si el archivo contiene un MBID (release o release-group), ir directo a CAA.
  - Si no hay MBID, buscar en MusicBrainz por `artist + album` (release) y, como alternativa, por `artist + title` (recording→release).
- Como fallback, usar **iTunes Search API** (sin clave) para obtener una portada razonable.

## Consecuencias
- CORS: MusicBrainz/CAA/iTunes permiten solicitudes desde el navegador.
- Precisión elevada al usar MBID directo; en búsquedas, tomamos el primer resultado (mejorable con filtros y UI de desambiguación).
- Recomendado: en producción, proxy backend para añadir `User-Agent` a MusicBrainz, cachear respuestas y respetar rate limits.

## Implementación
- `frontend/lib/metadata.ts` expone `TrackMetadata` con `mbReleaseId` (detecta variantes camelCase y snake_case) y extrae portada embebida si existe.
- `frontend/lib/cover.ts`:
  - `coverFromMB(mbid)`: intenta CAA por `release` luego por `release-group`.
  - `findCover({ artist, album, title })`: primero MusicBrainz (release/recording), luego iTunes.
  - Normalización a HTTPS con `ensureHttps()` para evitar mixed content en navegador.
  - Mejora de tamaño en iTunes con `upgradeArtworkUrl()` (p. ej. 512x512).
- `frontend/components/Player.tsx`:
  - Orden: portada embebida → `coverFromMB(mbReleaseId)` → `findCover()`.
  - Limpieza de `blob:` URLs para evitar fugas de memoria.

## Alternativas consideradas
- Solo iTunes: simple, sin clave, pero menor cobertura en ciertos catálogos/regiones.
- Last.fm / Spotify / Discogs / Deezer: requieren clave o auth y/o tienen restricciones de CORS/licencias.

## Trabajo futuro
- Añadir backend proxy opcional con cache y User-Agent para MusicBrainz/CAA.
- Mejorar desambiguación (filtrar por país, año, estado "official").
- Cachear portadas en estado local (Zustand/localStorage) o pinnear a IPFS y usar su CID.
