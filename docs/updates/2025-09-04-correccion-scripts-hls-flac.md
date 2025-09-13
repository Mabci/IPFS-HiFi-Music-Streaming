# Corrección de Scripts HLS y Soporte FLAC
**Fecha:** 2025-09-04  
**Tipo:** Corrección de bugs y mejoras de transcodificación

## Resumen
Sesión enfocada en corregir problemas críticos con los scripts de transcodificación HLS y implementar soporte completo para FLAC lossless en streaming.

## Problemas Identificados y Solucionados

### 1. Error de Rutas en Scripts de Transcodificación
**Problema:** Scripts fallaban con rutas que contenían espacios debido a uso incorrecto de rutas relativas.

**Solución implementada:**
- Eliminado prefijo `"..\` de comandos ffmpeg y ffprobe
- Uso directo de variable `"%input_file%"` con ruta completa
- Archivos corregidos: `transcode_to_hls.bat`

### 2. Script de Álbum Procesaba Solo 1 Track
**Problema:** Solo se procesaba el primer track de álbumes con múltiples canciones.

**Solución implementada:**
- Separación de loops por tipo de archivo (FLAC, WAV, AIFF)
- Uso de `pushd/popd` para manejo correcto de directorios de trabajo
- Verificación de existencia de archivos con `if exist`
- Archivo corregido: `transcode_album_to_hls.bat`

### 3. Calidad HIGH FLAC Corrupta
**Problema:** FLAC en contenedores MPEG-TS causaba archivos no reproducibles.

**Investigación realizada:**
- Consulta de especificaciones Apple HLS para FLAC
- Análisis de documentación técnica sobre contenedores fMP4
- Evaluación de alternativas de implementación
- Pruebas con `-hls_flags single_file` - sin éxito

**Estado actual:** ❌ **PROBLEMA NO RESUELTO**
- FLAC en HLS/TS sigue sin funcionar correctamente
- Parámetro `-hls_flags single_file` no solucionó el problema
- Calidad HIGH continúa generando archivos no reproducibles

## Cambios Técnicos Implementados

### Scripts Modificados

#### `transcode_to_hls.bat`
```bash
# Antes (problemático)
ffmpeg -i "..\%input_file%" -c:a flac ...

# Después (corregido)
ffmpeg -i "%input_file%" -c:a flac -hls_flags single_file ...
```

#### `transcode_album_to_hls.bat`
```bash
# Antes (solo 1 loop)
for %%f in ("%album_folder%\*.flac" "%album_folder%\*.wav" "%album_folder%\*.aiff") do (...)

# Después (loops separados con pushd/popd)
for %%f in ("%album_folder%\*.flac") do (
    if exist "%%f" (
        pushd "%~dp0"
        call "transcode_to_hls.bat" "%%f" "%output_name%\!track_name!_hls"
        popd
    )
)
```

### Configuración de Calidades

**LOW (AAC 320kbps):** Mantiene compatibilidad universal
- Contenedor: MPEG-TS
- Codec: AAC LC
- Bitrate: 320kbps

**HIGH (FLAC Lossless):** ❌ **NO FUNCIONAL**
- Contenedor: MPEG-TS con `-hls_flags single_file`
- Codec: FLAC
- Compresión: Nivel 8
- Sample rate: 44.1kHz, 16-bit
- **Estado:** Genera archivos pero no se reproducen correctamente

**MAX (FLAC Hi-Res):** ❌ **NO FUNCIONAL**
- Contenedor: MPEG-TS con `-hls_flags single_file`
- Codec: FLAC
- Mantiene resolución original del archivo fuente
- **Estado:** Mismo problema que calidad HIGH

## Estado Actual

### ✅ Completado
- Corrección de errores de rutas en scripts
- Soporte para procesamiento de álbumes completos
- Scripts optimizados para manejo de directorios

### ❌ Problemas Pendientes
- **FLAC en HLS no funciona:** Calidades HIGH y MAX generan archivos no reproducibles
- **Necesita solución alternativa:** FLAC en MPEG-TS no es compatible

### 🔄 Próximos Pasos CRÍTICOS
1. **Investigar alternativas para FLAC:** 
   - Considerar usar AAC de alta calidad en lugar de FLAC
   - Evaluar fMP4 como contenedor obligatorio
   - Probar ALAC (Apple Lossless) como alternativa
2. **Rediseñar calidad HIGH:** Implementar solución que funcione
3. **Testing con calidad LOW únicamente:** Verificar que AAC funciona correctamente
4. **Documentar limitaciones:** Aclarar que FLAC lossless aún no está disponible

## Archivos Modificados
- `scripts/transcode_to_hls.bat`
- `scripts/transcode_album_to_hls.bat`

## Comandos para Continuar
```powershell
# Limpiar directorio anterior
rmdir /s "Shuuketsu no Sadame_HLS"

# Ejecutar transcodificación corregida
.\transcode_album_to_hls.bat "C:\Users\Mabci\Music\Shuuketsu no Sadame"

# Subir a IPFS una vez completado
.\upload_album_to_ipfs.bat "Shuuketsu no Sadame_HLS"
```

## Consideraciones Técnicas

### ❌ Limitaciones Identificadas
- **FLAC en MPEG-TS no funciona:** Archivos se generan pero no se reproducen
- **Especificaciones Apple requieren fMP4:** FLAC debe usar contenedor fMP4, no TS
- **Incompatibilidad fundamental:** Intentos con `-hls_flags single_file` fallan

### Alternativas Viables
1. **AAC de alta calidad:** 768kbps o 1024kbps como "HIGH"
2. **ALAC (Apple Lossless):** Codec lossless nativo de Apple
3. **fMP4 obligatorio:** Implementar contenedores fMP4 para FLAC
4. **Streaming progresivo:** Usar archivos FLAC completos con HTTP Range

### Arquitectura Híbrida P2P+Gateway
- Scripts generan contenido compatible con hlsjs-helia-loader
- Soporte para carga P2P (Helia) con fallback HTTP
- **Solo calidad LOW funcional actualmente**

## Impacto en el Proyecto
**Estado crítico:** Pipeline HLS parcialmente funcional
- ✅ Procesamiento automático de álbumes completos
- ❌ Calidad lossless NO disponible actualmente
- ✅ Compatibilidad con infraestructura IPFS existente
- ⚠️ Requiere rediseño de calidades HIGH/MAX
