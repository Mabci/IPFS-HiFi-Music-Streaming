# Update: Página detalle de Playlist e integración con reproductor

Fecha: 2025-09-03
Autor: Plataforma de música IPFS (frontend)

## Resumen
- Se implementó la página de detalle de playlist con navegación desde la biblioteca.
- Se añadió soporte para añadir álbumes completos por CID de directorio UnixFS.
- Se integró la reproducción desde playlists con el estado global del reproductor (Zustand).
- Se completó la funcionalidad CRUD de playlists con interfaz de usuario completa.

## Cambios principales

### 1. Página de detalle de playlist
- `frontend/app/library/playlist/[id]/page.tsx`
  - Nueva ruta dinámica para mostrar detalle de playlist individual.
  - Renderiza componente `PlaylistDetail` pasando `playlistId` desde parámetros de ruta.

### 2. Navegación desde biblioteca
- `frontend/components/PlaylistsPanel.tsx`
  - Añadido botón "Abrir" con `next/link` para navegar a `/library/playlist/[id]`.
  - Importación de `Link` de Next.js para navegación client-side.

### 3. Soporte para álbumes por CID de directorio
- `frontend/components/PlaylistDetail.tsx`
  - Importación de `buildQueueFromAlbumCID()` desde `frontend/lib/album.ts`.
  - Nuevo formulario para añadir álbum completo por CID de directorio UnixFS.
  - Progreso visual durante la adición de múltiples pistas (`done/total`).
  - Manejo de errores y autenticación con `AuthModal`.

### 4. Integración con reproductor Zustand
- `frontend/components/PlaylistDetail.tsx`
  - Importación de `usePlayerStore` y tipos relacionados.
  - Función `playlistToQueue()` para convertir items de playlist a `QueueItem[]`.
  - Botón "Reproducir todo" en cabecera de lista de canciones.
  - Botones individuales de "Reproducir desde aquí" en cada canción.

## Detalles técnicos

### Conversión de playlist a cola de reproducción
```typescript
const playlistToQueue = (playlistItems): QueueItem[] => {
  return playlistItems.map((item) => {
    const trackId = item.trackId
    // Formato "albumCid/path" (álbumes añadidos)
    if (trackId.includes('/')) {
      const [albumCid, ...pathParts] = trackId.split('/')
      const path = pathParts.join('/')
      return {
        id: trackId,
        albumCid,
        path,
        httpUrl: buildGatewayPath(albumCid, path),
      }
    }
    // CID directo de archivo
    return {
      id: trackId,
      fileCid: trackId,
      httpUrl: buildGatewayPath(trackId),
    }
  })
}
```

### Funciones de reproducción
- `onPlayAll()`: Carga playlist completa desde primera canción
- `onPlayFrom(index)`: Carga playlist desde canción específica
- Integración con `loadQueue()` del store Zustand

### Añadir álbum por lotes
- Usa `buildQueueFromAlbumCID()` para expandir directorio UnixFS
- Añade pistas en orden secuencial con `position` fija
- Progreso visual con contador `done/total`
- Manejo de errores de red y autenticación

## Archivos modificados/creados
- `frontend/app/library/playlist/[id]/page.tsx` (nuevo)
- `frontend/components/PlaylistsPanel.tsx` (modificado)
- `frontend/components/PlaylistDetail.tsx` (modificado)

## Funcionalidades completadas
- ✅ Página detalle de Playlist y gestión de items (add/remove/reorder)
- ✅ Soportar añadir álbum por CID de directorio (UnixFS)
- ✅ Integración frontend de Playlists: helper y UI (Biblioteca)
- ✅ Integrar reproducción desde PlaylistDetail: reproducir/añadir a cola

## Cómo probar
1. Iniciar frontend y backend con `NEXT_PUBLIC_BACKEND_URL` configurada
2. Navegar a `/library` y crear una playlist
3. Hacer clic en "Abrir" para acceder al detalle
4. Probar añadir canciones por CID individual
5. Probar añadir álbum completo por CID de directorio
6. Usar botones "Reproducir todo" y "Reproducir desde aquí"
7. Verificar que el reproductor global se actualiza correctamente

## Integración con componentes existentes
- **Estado del reproductor**: `usePlayerStore` (Zustand) con persistencia en localStorage
- **IPFS**: Reutiliza `buildQueueFromAlbumCID()` y `buildGatewayPath()`
- **Autenticación**: Compatible con `AuthModal` y manejo de `not_authenticated`
- **UI**: Consistente con diseño de `PlaylistsPanel` y `LikesPanel`

## Próximos pasos sugeridos
- Implementar modal de autenticación global (provider + `useRequireAuth`)
- Añadir acción "Añadir a playlist" desde Player y listas de álbumes
- Configurar `FRONTEND_URL` en backend/.env para CORS
- Mejorar UX con drag & drop para reordenar y confirmaciones

## Arquitectura de datos
- **Playlist items**: Almacenados como `trackId` (CID directo o `albumCid/path`)
- **Queue items**: Formato estándar del reproductor con `httpUrl`, `albumCid`, `path`
- **Compatibilidad**: Funciona con canciones individuales y álbumes UnixFS
- **Persistencia**: Cola del reproductor se guarda automáticamente en localStorage

## Consideraciones de rendimiento
- Añadir álbum hace N llamadas `POST /items` (una por pista)
- Para álbumes muy grandes, considerar endpoint de bulk add en backend
- Gateway HTTP usado como fallback para listado rápido de directorios
- Concurrencia limitada en extracción de metadata (4 requests paralelos)
