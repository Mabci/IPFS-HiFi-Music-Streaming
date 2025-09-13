# hlsjs-helia-loader

Un loader de Helia IPFS para hls.js con soporte híbrido P2P + Gateway.

## Características

- **Migrado a Helia**: Actualizado desde js-ipfs a la nueva API de Helia
- **Modo Híbrido**: Combina P2P y gateway HTTP para máxima confiabilidad
- **Fallback Automático**: Si P2P falla o es lento, usa gateway automáticamente
- **Streaming de Audio**: Optimizado para streaming de música Hi-Fi
- **Compatible**: Funciona con cualquier aplicación HLS.js existente

## Instalación

```bash
npm install hlsjs-helia-loader
```

## Uso Básico

```javascript
import { createHelia } from 'helia'
import { unixfs } from '@helia/unixfs'
import Hls from 'hls.js'
import HlsjsHeliaLoader from 'hlsjs-helia-loader'

// Crear nodo Helia
const helia = await createHelia()
const fs = unixfs(helia)

// Configurar HLS con loader híbrido
Hls.DefaultConfig.loader = HlsjsHeliaLoader

const hls = new Hls()
hls.config.helia = helia
hls.config.fs = fs
hls.config.ipfsHash = 'QmYourHashHere'
hls.config.hybridMode = true
hls.config.gatewayUrl = 'https://ipfs.io/ipfs'
hls.config.p2pTimeout = 3000

hls.loadSource('master.m3u8')
hls.attachMedia(audioElement)
```

## Configuración

### Opciones del Loader

| Opción | Tipo | Default | Descripción |
|--------|------|---------|-------------|
| `helia` | Object | - | Instancia de Helia (requerido) |
| `fs` | Object | - | Instancia UnixFS (opcional, se crea automáticamente) |
| `ipfsHash` | String | - | Hash IPFS del contenido (requerido) |
| `hybridMode` | Boolean | `true` | Habilita modo híbrido P2P + Gateway |
| `gatewayUrl` | String | - | URL del gateway IPFS para fallback |
| `p2pTimeout` | Number | `3000` | Timeout en ms para intentos P2P |
| `debug` | Boolean/Function | `false` | Habilita logs de debug |

### Modos de Operación

#### 1. Modo Híbrido (Recomendado)
```javascript
hls.config.hybridMode = true
hls.config.gatewayUrl = 'https://ipfs.io/ipfs'
```
- Intenta P2P primero con timeout
- Fallback automático a gateway si P2P falla
- Chunks de gateway se comparten automáticamente en P2P

#### 2. Solo P2P
```javascript
hls.config.hybridMode = false
hls.config.gatewayUrl = null
```
- Solo usa red P2P/Helia
- Falla si no hay peers disponibles

#### 3. Solo Gateway
```javascript
hls.config.helia = null
hls.config.gatewayUrl = 'https://ipfs.io/ipfs'
```
- Solo usa gateway HTTP
- No hay distribución P2P

## Estructura IPFS Esperada

```
track_hash/
├── master.m3u8              # Master playlist
├── low/
│   ├── playlist.m3u8        # AAC 320kbps
│   ├── segment_000.aac
│   └── segment_001.aac
├── high/
│   ├── playlist.m3u8        # FLAC 16/44.1
│   ├── segment_000.flac
│   └── segment_001.flac
└── max/
    ├── playlist.m3u8        # FLAC 24/192
    ├── segment_000.flac
    └── segment_001.flac
```

## Ejemplo Completo

Ver `examples/basic_usage.html` para un ejemplo funcional completo.

## Desarrollo

```bash
# Instalar dependencias
npm install

# Build
npm run build

# Desarrollo con watch
npm run dev
```

## Diferencias con hlsjs-ipfs-loader Original

- ✅ **Migrado a Helia**: API moderna y mantenida
- ✅ **Modo Híbrido**: P2P + Gateway automático
- ✅ **Mejor Manejo de Errores**: Fallbacks robustos
- ✅ **ES Modules**: Soporte moderno de JavaScript
- ✅ **TypeScript Ready**: Tipos incluidos
- ✅ **Optimizado para Audio**: Configuración específica para música

## Licencia

MIT
