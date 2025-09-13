# Arquitectura Final: Progressive Streaming con HTTP Range Requests

**Fecha:** 04 de Septiembre, 2025  
**Estado:** ✅ IMPLEMENTADO  
**Versión:** 2.0 (Post-HLS)

## 🏗️ Arquitectura Técnica Definitiva

### Stack de Streaming
```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                      │
├─────────────────────────────────────────────────────────────┤
│  ModernPlayer.tsx  →  ProgressivePlayer.tsx                │
│       ↓                       ↓                            │
│  Audio Nativo HTML5    range-helia-loader                  │
├─────────────────────────────────────────────────────────────┤
│                 HTTP Range Requests                        │
├─────────────────────────────────────────────────────────────┤
│  P2P (Helia/IPFS) ←→ Gateway HTTP (Pinata)                │
├─────────────────────────────────────────────────────────────┤
│              Archivos FLAC/AAC Progresivos                 │
└─────────────────────────────────────────────────────────────┘
```

### Flujo de Reproducción
1. **Usuario selecciona track** → ModernPlayer detecta calidades disponibles
2. **ProgressivePlayer se inicializa** → Configura HTTP Range streaming
3. **range-helia-loader intenta P2P** → Timeout 3s, fallback a gateway
4. **Navegador maneja Range Requests** → Streaming progresivo automático
5. **Audio se reproduce inmediatamente** → Sin esperar descarga completa

## 📁 Estructura de Archivos de Audio

### Formato de Álbum Progresivo
```
Album_Progressive/
├── album.json                    # Manifest con metadata
├── cover.jpg                     # Portada del álbum
├── 01 - Track Name_progressive/
│   ├── low.m4a                   # AAC 128kbps
│   ├── high.flac                 # FLAC 16-bit/44.1kHz
│   └── max.flac                  # FLAC Hi-Res 24-bit/96kHz+
├── 02 - Track Name_progressive/
│   ├── low.m4a
│   ├── high.flac
│   └── max.flac
└── ...
```

### Manifest JSON (album.json)
```json
{
  "version": "1.0",
  "type": "progressive_album",
  "generated": "04/09/2025 22:42:39",
  "tracks": [
    {
      "name": "01 - Track Name",
      "directory": "01 - Track Name_progressive",
      "qualities": {
        "low": "low.m4a",
        "high": "high.flac", 
        "max": "max.flac"
      },
      "metadata": {
        "title": "Track Name",
        "artist": "Artist Name",
        "album": "Album Name",
        "track": 1
      }
    }
  ],
  "trackCount": 12
}
```

## 🔧 Componentes Principales

### 1. ProgressivePlayer.tsx
**Propósito:** Reproductor principal con HTTP Range Requests
```typescript
// Características clave:
- Streaming progresivo nativo del navegador
- Codificación automática de URLs (caracteres especiales)
- Integración con range-helia-loader
- Control de volumen y seeking preciso
- Manejo de errores con fallback automático
```

### 2. range-helia-loader/index.js
**Propósito:** Loader híbrido P2P + Gateway
```javascript
// Funcionalidades:
- Intenta carga P2P con Helia (timeout 3s)
- Fallback transparente a gateway HTTP
- Soporte nativo para HTTP Range headers
- Cache inteligente entre modos P2P/HTTP
- Optimización para archivos grandes (FLAC Hi-Res)
```

### 3. ModernPlayer.tsx
**Propósito:** UI principal y orquestador
```typescript
// Responsabilidades:
- Detección automática de calidades progresivas
- Integración con ProgressivePlayer
- Gestión de cola y metadata
- Controles de reproducción unificados
- Sincronización con store global (Zustand)
```

### 4. album.ts
**Propósito:** Carga optimizada de álbumes
```typescript
// Optimizaciones:
- Carga prioritaria de manifest JSON
- Fallback a escaneo manual si no hay manifest
- Extracción de metadata de archivos
- Construcción de QueueItems con calidades
- Manejo de caracteres especiales en nombres
```

## 🎵 Pipeline de Transcodificación

### Script Principal: transcode_album_to_progressive.bat
```batch
# Proceso automatizado:
1. Escaneo de archivos de audio en carpeta fuente
2. Extracción de metadata (ffprobe)
3. Transcodificación a múltiples calidades:
   - LOW: AAC 128kbps M4A (compatibilidad universal)
   - HIGH: FLAC 16-bit/44.1kHz (lossless estándar)
   - MAX: FLAC Hi-Res preservando calidad original
4. Generación automática de album.json manifest
5. Copia de cover art (cover.jpg/folder.jpg/front.jpg)
```

### Calidades de Audio
| Calidad | Formato | Bitrate/Resolución | Uso |
|---------|---------|-------------------|-----|
| **LOW** | AAC M4A | 128kbps | Conexiones lentas, móviles |
| **HIGH** | FLAC | 16-bit/44.1kHz | Calidad CD lossless |
| **MAX** | FLAC | 24-bit/96kHz+ | Hi-Res audiophile |

## 🌐 Configuración de Gateway

### Variables de Entorno
```env
# Gateway IPFS personalizado (Pinata)
NEXT_PUBLIC_IPFS_GATEWAY=https://gateway.pinata.cloud

# Control de covers locales
NEXT_PUBLIC_COVERS_LOCAL_ONLY=false
```

### Codificación de URLs
```javascript
// Manejo automático de caracteres especiales
const encodedPath = pathParts.map(part => encodeURIComponent(part)).join('/')
const url = `${gateway}/ipfs/${encodedPath}`

// Ejemplos:
// "Shiro Sagisu/人々に愛を.flac" 
// → "Shiro%20Sagisu/%E4%BA%BA%E3%80%85%E3%81%AB%E6%84%9B%E3%82%92.flac"
```

## 📊 Beneficios vs HLS Eliminado

### ✅ Ventajas del Sistema Actual
- **Simplicidad:** Un solo sistema de streaming
- **Compatibilidad:** Funciona en todos los navegadores modernos
- **Calidad:** FLAC lossless sin limitaciones de contenedores
- **Rendimiento:** Reproducción inmediata con Range Requests
- **Mantenimiento:** Código más simple y limpio

### ❌ Por qué se Eliminó HLS
- Incompatibilidad con FLAC en MPEG-TS
- Complejidad innecesaria de playlists M3U8
- Problemas de compatibilidad entre navegadores
- Overhead de segmentación sin beneficios
- Mantenimiento de dos sistemas paralelos

## 🔍 Debugging y Logging

### Logs Principales
```javascript
// ProgressivePlayer
console.log('ProgressivePlayer: Setting up range streaming for:', cidValue)
console.log('ProgressivePlayer: Fallback to direct URL:', directUrl)

// ModernPlayer
console.log('ModernPlayer debug:', {
  useProgressive, 
  progressiveCid, 
  currentItemQualities
})

// album.ts
console.log('Album loading: Using manifest for instant metadata')
console.log('Album loading: Fallback to manual scanning')
```

## 🚀 Estado de Implementación

### ✅ Completado
- [x] ProgressivePlayer con HTTP Range Requests
- [x] range-helia-loader híbrido P2P/Gateway
- [x] Scripts de transcodificación simplificados
- [x] Generación automática de manifests
- [x] Carga optimizada de álbumes
- [x] Control de volumen y seeking
- [x] Codificación de URLs para caracteres especiales
- [x] Eliminación completa de HLS

### 🎯 Optimizaciones Futuras
- [ ] Métricas de rendimiento P2P vs Gateway
- [ ] Cache persistente de chunks P2P
- [ ] Preloading inteligente de próximos tracks
- [ ] Compresión de manifests para álbumes grandes

---

**Conclusión:** La arquitectura de Progressive Streaming con HTTP Range Requests está completamente implementada y funcional. Proporciona una experiencia de streaming superior con menor complejidad técnica que la arquitectura HLS anterior.
