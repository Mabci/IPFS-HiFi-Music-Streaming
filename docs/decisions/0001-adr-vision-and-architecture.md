# ADR-0001: Visión y arquitectura inicial (Reemplazado por ADR-0002)

- Estado: Reemplazado por ADR-0002
- Fecha: 2025-08-19

## Contexto
Se desea construir una plataforma de música que use IPFS como capa de almacenamiento y distribución, priorizando UX. El enfoque será frontend-first para validar rápido la experiencia y la viabilidad técnica de reproducción sobre IPFS.

## Decisión (original, ahora reemplazada)
- Monorepo con `frontend/` y `backend/`.
- Estrategia de reproducción: descarga progresiva vía Gateway.
- Uso inicial de gateways (públicos/privados) con CORS correcto; a futuro, nodo Kubo propio + IPFS Cluster para pinning/replicación.
- Documentación viva en `docs/` y registro de decisiones en `docs/decisions/`.

## Reemplazo
Este ADR fue reemplazado por `ADR-0002: Estrategia audio-only y multiplataforma`, que define:
- MVP: descarga progresiva (audio-only) vía HTTP Range desde gateway IPFS.
- Enfoque multiplataforma: Web, Desktop y Android.

## Consecuencias (del ADR original)
- N/A (este ADR fue reemplazado; ver ADR-0002).
- La disponibilidad dependía inicialmente de gateways y pinning externos; se planifica infraestructura propia.

## Alternativas consideradas
- Ver ADR-0002 para el análisis actualizado de alternativas.
