# Backend

## Objetivo
Proveer APIs para catálogo, usuarios, playlists y orquestación de contenidos en IPFS (pinning, resolución de CIDs). Estrategia de entrega: descarga progresiva (HTTP Range) como única vía.

## Stack propuesto (fase 3)
- Node.js + TypeScript
- Framework: NestJS (o Express en MVP)
- DB: PostgreSQL (o SQLite en desarrollo)
- REST (JSON) inicialmente; evaluar GraphQL a futuro

## Servicios previstos
- Catálogo (pistas, álbumes, artistas)
- Usuarios y sesiones básicas
- Playlists
- Ingesta/transcodificación (worker/cola, fase 2-3) a formatos AAC/FLAC cuando aplique
- Integración IPFS (kubo RPC / js-ipfs / pinning service)

## Endpoints (borrador)
- `GET /tracks`, `GET /tracks/{id}`
- `GET /albums`, `GET /artists`
- `GET /playlists`, `POST /playlists`
- `POST /upload` (fase 2-3)
