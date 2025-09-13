# Análisis de features y alcance (Spotify/TIDAL vs IPFS)

## Objetivo
Construir una plataforma de streaming de música (solo audio) sobre IPFS para Web, Desktop y Android, priorizando una gran UX y latencia baja de reproducción.

## Plataformas objetivo
- Web (SPA/PWA): Chrome, Edge, Firefox, Safari
- Desktop (Windows, Linux, macOS): empaquetado con Electron o Tauri reutilizando el frontend web
- Android: app nativa o multiplataforma (p. ej., React Native/Flutter)
- iOS: fuera de alcance inmediato; considerar compatibilidad futura (codecs y APIs)

## Estrategia multiplataforma (resumen)
 - Núcleo compartido de lógica (modelos, estado, reproductor) y UI reusable
 - Web/Desktop: HTMLAudioElement (descarga progresiva) + opción P2P (Helia) con Blob URL
 - Android: ExoPlayer (descarga progresiva), con caché y descargas con rangos

## Módulos y features
- Reproducción
  - Player web (play/pause, seek, next/prev, shuffle, repeat, volumen)
  - Cola de reproducción y mini-player persistente
  - Gapless playback (objetivo), normalización de volumen (posterior)
  - Calidad: soporte AAC y FLAC (lossless)
  - Etiqueta de calidad en UI: códec, kHz, kbps y bits (cuando aplique)
- Biblioteca del usuario
  - Favoritos, playlists, álbumes y artistas seguidos
  - Historial de reproducción y "Recientes"
- Descubrimiento y búsqueda
  - Búsqueda por pista/álbum/artista (MVP básico)
  - Recomendaciones y radios (posterior)
- Contenido y metadata
  - Ingesta de pistas con metadata (ID3/Vorbis) y carátulas
  - Integración futura con MusicBrainz u otras fuentes
  - Extracción en frontend con `music-metadata` (HTTP Range y Blob P2P)
  - Caché de metadata versionada `mm:v2:track` y enriquecimiento asíncrono en el Player
- Social y compartición
  - Compartir enlaces públicos `ipfs://` o vía gateway (MVP)
  - Perfiles públicos y colaboraciones en playlists (posterior)
- P2P en navegador (Helia)
  - Toggle opt-in para compartir y reproducir desde Helia (Blob URL)
  - Métricas: bloques servidos/recibidos, peers conectados
  - Límites de ancho de banda y privacidad
- Offline y caché
  - Cache en navegador (IndexedDB + Service Worker)
  - Pinning local/remote para disponibilidad
- Administración
  - Pipeline de ingesta, validación de metadata, normalización
  - Herramientas de moderación (posterior)
- Observabilidad y métricas
  - Métricas de latencia de start-play, buffering, completion
  - Telemetría anónima (opt-in)

### Álbum por CID (UnixFS)
 - Soporte de directorio: listar entradas con `unixfs.ls()` desde `frontend/lib/helia.ts` (utilidad propuesta `listAlbumTracks(cid)`).
 - Filtrado de audio: extensiones objetivo `.m4a`/`.aac` (AAC) y `.flac` (lossless).
 - Orden de pistas: número en filename (ej. `01 - ...`, `1.`); si no existe, alfabético. Corregir con `track` extraído de metadata cuando esté disponible.
 - Rutas de archivos en gateway: nueva utilidad `buildGatewayPath(cid, path)` en `frontend/lib/ipfs.ts` para `https://gateway/ipfs/<albumCID>/<path>`.
 - Metadata por pista: `extractFromHttp(url)` (HTTP Range) para rapidez; en P2P, limitar a la pista actual con `fetchFileToBlob`.
 - Concurrencia: 3–5 lecturas de metadata en paralelo para no saturar el gateway.
 - Portada de álbum: portada embebida de la primera pista disponible → `mbReleaseId` (CAA) → `findCover({ artist, album })` (MusicBrainz→CAA, fallback iTunes). Cachear a nivel álbum.
 - ADR relacionado: `docs/decisions/0003-adr-covers-provider.md` (MB/CAA primario, iTunes fallback).
  - Cache de metadata versionada a nivel pista: clave `mm:v2:track:<url>`

### Estado global (Zustand)
 - `playerStore` (persist): `queue`, `currentIndex`, `isPlaying`, `repeat ('off'|'one'|'all')`, `shuffle`, `volume`, `p2pEnabled`, `isExpanded`.
 - Acciones: `loadAlbum`, `loadQueue`, `playAt`, `next`, `prev`, `togglePlay`, `setVolume`, `toggleExpanded`, `toggleShuffle`, `cycleRepeat`.
 - `coversStore` (persist + TTL) y `metadataStore` (persist + TTL) para cachear portadas/metadata.
 - `libraryStore` (persist): likes de pistas (por archivo) y álbumes (por CID).

### Reproductor y UX
 - Migrar `frontend/components/Player.tsx` a estado global; extraer un controlador de `<audio>` que emita eventos (play/pause/ended/seek/volume).
 - Vista de reproductor expandida al hacer click en la carátula: portada grande y cola con reordenar, eliminar y like.
 - Media Session API: metadata y acciones del sistema con portada.

### Próximos pasos (prioridad)
 - Alta: `listAlbumTracks`, `buildGatewayPath`, `playerStore`, `loadAlbum` con metadata concurrente y portada de álbum.
 - Media: caches con TTL (portadas/metadata), likes y “Mi biblioteca”, UI expandida.
 - Baja: Media Session API y documentación de guía rápida para álbumes por CID.

## IPFS: estrategias de entrega (audio-only)
  - Descarga progresiva con HTTP Range vía Gateway (en todo el proyecto)
  - Un único archivo (AAC/FLAC) servido vía gateway con rangos.
  - Ventajas: simple y ampliamente compatible en Web/Desktop/Android.
- P2P en navegador con Helia (opt-in, experimental)
  - Reproducción vía `unixfs.cat` y Blob URL; fallback a gateway
  - Requiere `helia`, `@helia/unixfs`, `multiformats` (uso de `CID.parse`)
- Gateways y nodos
  - Inicio: gateways públicos/privados con CORS configurado; por defecto gateway Pinata configurable vía `NEXT_PUBLIC_IPFS_GATEWAY`.
  - Futuro: nodo propio (Kubo) + IPFS Cluster para pinning/replicación; verificación trustless (helia-verified-fetch) cuando aplique.

## Requisitos no funcionales
- Latencia de inicio de reproducción (target): < 1.5s en red estable
- Reproducción estable en navegadores modernos (Chrome, Edge, Firefox, Safari)
- Multiplataforma: paridad funcional base entre Web, Desktop y Android
- Controles del sistema y background playback
  - Web: Media Session API (notificaciones/lockscreen) con PWA (limitaciones propias del navegador)
  - Desktop: teclas multimedia e integración con OS (Electron/Tauri)
  - Android: notificaciones, lockscreen, AudioFocus
- Accesibilidad (WCAG AA) y responsive
- Consumo eficiente de batería/datos; prefetch y bitrate configurables
- Mínimo 99% de disponibilidad del contenido pineado crítico

## Alcance por fases
- Fase 1 (Frontend Web MVP)
  - UI básica: Home, Buscar, Biblioteca, Player persistente
  - Reproducción progresiva desde IPFS vía Gateway (CIDs de demo)
  - PWA básico (Media Session API, controles)
  - Opción P2P en navegador (Helia) con toggle, reproducción vía Blob URL
  - Playlists locales (mock) y estado en el cliente
- Fase 2 (Multiplataforma + IPFS)
  - Desktop wrapper (Electron o Tauri) reutilizando el frontend web
  - Desktop: Helia (Node) + gateway HTTP local para servir a `<audio>`
  - Android MVP (React Native/Expo o Flutter) con reproducción progresiva vía Gateway
  - Subida de pistas desde UI y pinning (servicio de pinning o nodo propio)
  - Resolución de CIDs, fallback a descarga progresiva
  - Exploración de verificación trustless (helia-verified-fetch) desde gateway/peer
- Fase 3 (Backend ligero)
  - API REST para catálogo, usuarios y playlists
  - DB (Postgres/SQLite) para metadata, sesiones básicas
  - Integración con IPFS (kubo RPC / js-ipfs / pinning service)
- Fase 4 (Features avanzadas)
  - Descubrimiento y recomendaciones
  - Offline (SW + IndexedDB y caché en Desktop/Android), normalización de volumen
  - Observabilidad (dashboards), social (compartir, colaborativo)

## Riesgos y mitigaciones
- Gateways saturados: usar gateway dedicado y pinning replicado
- Compatibilidad de codecs (AAC/FLAC) entre Web, Desktop y Android; iOS fuera de alcance inmediato pero a considerar en decisiones futuras
- Reproducción en background y controles del sistema: diferencias por plataforma; mitigación con Media Session API/ExoPlayer y pruebas continuas
- Políticas de tienda (Android) para descargas/caché: revisar permisos y guidelines
- CORS/limitaciones de gateway: configurar gateway propio con headers adecuados
- DRMed content no compatible: enfocarse en contenido propio o libre/licenciado
- Transcodificación costosa: colas batch y cómputo separado
- P2P en navegador: peering/NAT impredecibles y dependencia de WebRTC/TURN; mitigación con delegated routing/bootstraps y fallback a gateway
- Privacidad/ancho de banda del usuario: opt-in por defecto, límites configurables y métricas transparentes

## Planes de pago (P2P presente en todos)
- Gratuito: Reproducción en AAC de baja calidad 128kbps con anuncios
- Plus: Reproducción en AAC de alta calidad 320kbps sin anuncios ($3.99USD/mes)
- Hi-Fi: Reproducción en FLAC de alta calidad hasta 24bit 192kHz sin anuncios ($7.99USD/mes)
- Planes de la competencia: Tidal, Apple Music $10.99USD/mes (Incluyen Hi-Fi) - Spotify $11.99USD/mes (No cuenta con Hi-Fi) - Amazon Music $11.99USD/mes (Incluye Hi-Fi)