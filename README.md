# Collab Docs

Notion-like collaborative workspace: nested documents, real-time CRDT editing, public SEO pages, search, and mock subscription limits.

This is a fullstack test project. The canonical specification is `docs/ТЗ_тестове_завдання_5_Fullstack_NextJS_Expert.md`. Working notes and Graphify live under `docs/`.

## Layout

| Path | Role |
|---|---|
| `frontend/` | Next.js (App Router, TypeScript) |
| `backend/` | NestJS API + collab gateway |
| `docker-compose.yml` | Local stack |
| `docs/` | TZ, handoff, Graphify, plans |

## Stack

- Frontend: Next.js App Router — Server Components / SSR / ISR for public pages; Client Components for the editor and presence
- Backend: NestJS + Prisma + PostgreSQL, Redis + BullMQ, Meilisearch, MinIO
- Auth: JWT access + refresh
- Realtime: Yjs over WebSocket `ws://localhost:3001/collab?documentId=&token=`
- Billing: mock Stripe-like webhooks (idempotent)

Join payload (JSON): `{ "type": "join", "documentId", "token" }`. Updates: `{ "type": "update", "update": "<base64 Yjs update>" }`. Presence: `{ "type": "cursor", "blockId", "offset" }`. Viewers receive sync/updates but cannot apply edits.

## Run

```bash
docker compose up -d
cd backend && npm run start:dev

# other terminal
cd frontend && npm run dev
```

- API: http://localhost:3001 · Swagger `/api/docs`
- App: http://localhost:3000 · public pages `/p/[slug]`
- Postgres `5432`, Redis `6379`, MinIO `9000`/`9001`, Meilisearch `7700`

Server Components for lists/public pages; Client Components only where interactivity is required (auth forms today; editor next). CRDT edits go through WebSocket, not Server Actions.
