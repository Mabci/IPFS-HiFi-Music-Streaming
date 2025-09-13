# Formato de Transcodificación y Manejo de Manifests

**Fecha:** 04 de Septiembre, 2025  
**Estado:** ✅ IMPLEMENTADO  
**Versión:** 2.0 (Progressive Streaming)

## 🎵 Nuevo Formato de Archivos de Audio

### Estructura de Directorio Progresivo
```
Album_Progressive/
├── album.json                           # ← NUEVO: Manifest centralizado
├── cover.jpg                            # Portada del álbum
├── 01 - Track Name_progressive/         # ← Directorio por track
│   ├── low.m4a                         # AAC 128kbps (compatibilidad)
│   ├── high.flac                       # FLAC 16-bit/44.1kHz (lossless)
│   └── max.flac                        # FLAC Hi-Res (24-bit/96kHz+)
├── 02 - Another Track_progressive/
│   ├── low.m4a
│   ├── high.flac
│   └── max.flac
└── ...
```

### Convención de Nombres
- **Directorio principal:** `{AlbumName}_Progressive`
- **Directorios de tracks:** `{TrackNumber} - {TrackName}_progressive`
- **Archivos de calidad:** `low.m4a`, `high.flac`, `max.flac`
- **Manifest:** `album.json` (siempre en la raíz)
- **Cover:** `cover.jpg` (detecta automáticamente `cover.jpg`, `folder.jpg`, `front.jpg`)

## 📋 Especificación del Manifest JSON

### Estructura Completa
```json
{
  "version": "1.0",
  "type": "progressive_album",
  "generated": "04/09/2025 22:50:53",
  "album": {
    "name": "Album Name",
    "artist": "Artist Name",
    "year": 2025,
    "genre": "Electronic"
  },
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
        "track": 1,
        "duration": "3:45",
        "codec": "FLAC",
        "sampleRate": "44100 Hz",
        "bitDepth": "16-bit"
      },
      "fileInfo": {
        "lowSize": "3.2 MB",
        "highSize": "28.5 MB", 
        "maxSize": "85.7 MB"
      }
    }
  ],
  "trackCount": 12,
  "totalSize": "1.2 GB",
  "generatedBy": "transcode_album_to_progressive.bat v2.0"
}
```

### Campos del Manifest

#### Metadata Global
- `version`: Versión del formato de manifest
- `type`: Siempre `"progressive_album"`
- `generated`: Timestamp de generación
- `album`: Información general del álbum
- `trackCount`: Número total de tracks
- `totalSize`: Tamaño total estimado
- `generatedBy`: Script/herramienta que generó el manifest

#### Por Track
- `name`: Nombre del directorio del track
- `directory`: Ruta relativa al directorio del track
- `qualities`: Mapeo de calidades a archivos
- `metadata`: Información extraída con ffprobe
- `fileInfo`: Tamaños de archivos por calidad

## 🔧 Pipeline de Transcodificación

### Script Principal: `transcode_album_to_progressive.bat`

#### Proceso Automatizado
```batch
1. ESCANEO INICIAL
   - Detecta archivos de audio en carpeta fuente
   - Identifica formato y calidad original
   - Busca cover art (cover.jpg, folder.jpg, front.jpg)

2. EXTRACCIÓN DE METADATA
   - ffprobe extrae: título, artista, álbum, track, duración
   - Detecta: codec, sample rate, bit depth, bitrate
   - Guarda metadata en variables temporales

3. TRANSCODIFICACIÓN POR CALIDAD
   LOW (AAC M4A):
   ffmpeg -i "input" -c:a aac -b:a 128k -f mp4 "low.m4a"
   
   HIGH (FLAC Estándar):
   ffmpeg -i "input" -c:a flac -sample_fmt s16 -ar 44100 "high.flac"
   
   MAX (FLAC Hi-Res):
   ffmpeg -i "input" -c:a flac "max.flac"  # Preserva calidad original

4. GENERACIÓN DE MANIFEST
   - Construye album.json con toda la metadata
   - Incluye información de archivos y tamaños
   - Valida estructura JSON antes de guardar
```

### Comandos de Transcodificación

#### Calidad LOW (AAC 128kbps)
```batch
ffmpeg -i "%input_file%" -c:a aac -b:a 128k -f mp4 -y "low.m4a"
```
- **Propósito:** Compatibilidad universal, conexiones lentas
- **Formato:** AAC en contenedor MP4
- **Bitrate:** 128 kbps constante
- **Tamaño:** ~1MB por minuto

#### Calidad HIGH (FLAC Lossless)
```batch
ffmpeg -i "%input_file%" -c:a flac -sample_fmt s16 -ar 44100 -y "high.flac"
```
- **Propósito:** Calidad CD lossless estándar
- **Formato:** FLAC puro
- **Resolución:** 16-bit/44.1kHz
- **Tamaño:** ~25-30MB por track

#### Calidad MAX (FLAC Hi-Res)
```batch
ffmpeg -i "%input_file%" -c:a flac -y "max.flac"
```
- **Propósito:** Preserva calidad original completa
- **Formato:** FLAC puro sin conversión
- **Resolución:** Variable (hasta 24-bit/192kHz)
- **Tamaño:** 50-100MB+ por track

## 📊 Extracción de Metadata

### Comando ffprobe
```batch
ffprobe -v quiet -print_format json -show_format -show_streams "%input_file%"
```

### Campos Extraídos
```json
{
  "format": {
    "tags": {
      "title": "Track Name",
      "artist": "Artist Name", 
      "album": "Album Name",
      "track": "1/12",
      "date": "2025",
      "genre": "Electronic"
    },
    "duration": "225.123456",
    "size": "89654321"
  },
  "streams": [
    {
      "codec_name": "flac",
      "sample_rate": "44100",
      "bits_per_sample": 16,
      "bit_rate": "1411200"
    }
  ]
}
```

### Procesamiento en el Script
```batch
:: Extrae título
for /f "tokens=*" %%a in ('ffprobe ... -show_entries format_tags^=title') do set "title=%%a"

:: Extrae artista  
for /f "tokens=*" %%a in ('ffprobe ... -show_entries format_tags^=artist') do set "artist=%%a"

:: Extrae duración
for /f "tokens=*" %%a in ('ffprobe ... -show_entries format^=duration') do set "duration=%%a"
```

## 🚀 Carga Optimizada en Frontend

### Flujo de Carga de Álbum

#### 1. Intento de Manifest (Rápido)
```typescript
// album.ts - Carga prioritaria del manifest
try {
  const manifestUrl = `${gatewayUrl}/ipfs/${albumCid}/album.json`
  const manifest = await fetch(manifestUrl).then(r => r.json())
  
  // Construye QueueItems desde manifest (instantáneo)
  const tracks = manifest.tracks.map(track => ({
    id: `${albumCid}/${track.directory}`,
    title: track.metadata.title,
    artist: track.metadata.artist,
    album: track.metadata.album,
    qualities: {
      low: `${albumCid}/${track.directory}/${track.qualities.low}`,
      high: `${albumCid}/${track.directory}/${track.qualities.high}`,
      max: `${albumCid}/${track.directory}/${track.qualities.max}`
    }
  }))
  
  return tracks
} catch (error) {
  // Fallback a escaneo manual...
}
```

#### 2. Fallback Manual (Lento)
```typescript
// Si no hay manifest, escanea directorios manualmente
const entries = await fs.ls(albumCid)
const progressiveDirs = entries.filter(e => 
  e.type === 'directory' && e.name.endsWith('_progressive')
)

// Extrae metadata de cada archivo individualmente
for (const dir of progressiveDirs) {
  const qualities = await scanQualitiesInDirectory(dir.cid)
  const metadata = await extractMetadataFromFile(qualities.high || qualities.low)
  // ...
}
```

### Beneficios del Manifest
- **Carga instantánea:** 1 request vs 20+ requests
- **Metadata completa:** Sin necesidad de extraer de archivos
- **Información de tamaños:** Para mostrar al usuario
- **Validación:** Estructura garantizada y consistente

## 🔍 Detección de Calidades

### Lógica en album.ts
```typescript
const detectQualities = async (dirCid: string) => {
  const entries = await fs.ls(dirCid)
  const qualities: Record<string, string> = {}
  
  for (const entry of entries) {
    if (entry.name === 'low.m4a') qualities.low = `${dirCid}/${entry.name}`
    if (entry.name === 'high.flac') qualities.high = `${dirCid}/${entry.name}`  
    if (entry.name === 'max.flac') qualities.max = `${dirCid}/${entry.name}`
  }
  
  return qualities
}
```

### Prioridad de Selección
1. **Manifest disponible:** Usa calidades del JSON
2. **Escaneo manual:** Detecta archivos en directorio
3. **Fallback:** Usa archivo único si no hay estructura progresiva

## 📁 Ejemplo Completo de Uso

### 1. Transcodificación
```batch
# Ejecutar script
transcode_album_to_progressive.bat "C:\Music\MyAlbum"

# Resultado:
MyAlbum_Progressive/
├── album.json          # ← Generado automáticamente
├── cover.jpg
├── 01 - Song1_progressive/
│   ├── low.m4a
│   ├── high.flac
│   └── max.flac
└── 02 - Song2_progressive/
    ├── low.m4a
    ├── high.flac
    └── max.flac
```

### 2. Subida a IPFS
```bash
# Subir carpeta completa incluyendo manifest
ipfs add -r "MyAlbum_Progressive/"
# Resultado: QmXXXXXX (CID del álbum)
```

### 3. Carga en Frontend
```typescript
// Cargar álbum por CID
const tracks = await loadAlbumByCid('QmXXXXXX')
// Carga instantánea usando album.json

// Reproducir track
playTrack(tracks[0]) // Usa calidades progresivas automáticamente
```

## 🎯 Ventajas del Nuevo Sistema

### vs HLS Eliminado
- ✅ **Sin segmentación:** Archivos completos, seeking preciso
- ✅ **FLAC nativo:** Sin problemas de contenedores
- ✅ **Menos archivos:** 3 calidades vs 100+ segmentos HLS
- ✅ **Manifest único:** vs múltiples playlists M3U8

### vs Sistema Anterior
- ✅ **Carga 10x más rápida:** Manifest vs escaneo manual
- ✅ **Metadata completa:** Sin extracción en tiempo real
- ✅ **Información de tamaños:** Para UX mejorada
- ✅ **Automatización:** Generación integrada en transcodificación

---

**Conclusión:** El nuevo formato con manifests JSON proporciona una experiencia de carga optimizada manteniendo la flexibilidad de múltiples calidades y la compatibilidad universal del streaming progresivo.
