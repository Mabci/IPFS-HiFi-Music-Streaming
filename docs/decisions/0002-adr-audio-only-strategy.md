# ADR-0002: Estrategia audio-only y multiplataforma

- Estado: Aceptado
- Fecha: 2025-08-19
- Reemplaza: ADR-0001

## Contexto
El proyecto es exclusivamente de audio y debe estar disponible en Web, Desktop y Android (iOS fuera de alcance inmediato). En el MVP se prioriza la simplicidad y compatibilidad amplia, utilizando IPFS para la distribución del contenido.

## Decisión
- Estrategia única: Descarga progresiva (audio-only) vía HTTP Range desde gateway IPFS.
- Multiplataforma:
  - Web/Desktop: HTMLAudioElement (descarga progresiva).
  - Android: ExoPlayer (descarga progresiva), con caché y controles de sistema.
- Infraestructura IPFS: comenzar con gateways (públicos/privados) con CORS adecuado; evolucionar a nodo Kubo propio + IPFS Cluster/pinning service.

## Consecuencias
- Toda la entrega será por archivo completo con rangos.
- El frontend debe optimizar la reproducción progresiva (preload, rangos, manejo de seeks).
- Se requiere gestión de CORS y headers en el gateway para permitir rangos y reproducción embebida.
- Compatibilidad de codecs: priorizar AAC; ofrecer FLAC como opción lossless (impacto en consumo de datos).

## Alternativas consideradas
- P2P/libp2p en navegador: potente, pero agrega complejidad y permisos; se evaluará más adelante.

## Métricas
- Time To First Play (TTFP)
- Rebuffers por hora de escucha
- Éxito de seeks

## Plan de adopción
1. Implementar reproducción progresiva en Web (PWA) y Desktop wrapper.
2. Implementar Android con reproducción progresiva usando gateway.
