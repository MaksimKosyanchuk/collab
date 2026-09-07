# Collab Docs

Notion-like collaborative workspace: nested documents, real-time CRDT editing, public SEO pages, search, and mock subscription limits.

Canonical specification: `docs/ТЗ_тестове_завдання_5_Fullstack_NextJS_Expert.md`. Working notes and Graphify live under `docs/`.

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

## Architecture

| Concern | Where it lives | Why |
|---|---|---|
| Lists, workspace dashboard, public SEO pages | **Server Components** (SSR / streaming Suspense / ISR) | Fast first paint, SEO, no client JS for read-only data |
| Block editor, presence cursors, DnD tree | **Client Components** | Need browser APIs, WebSocket, local Y.Doc state |
| Invite member, workspace rename / settings, auth, publish | **Server Actions** | Authenticated mutations with cookie session + `revalidatePath`; not for live typing |
| Typing, blocks, cursors | **CRDT / WebSocket** (`/collab`) | Concurrent edits merge without last-write-wins; Server Actions cannot stream CRDT updates |

Workspace page streams two independent Suspense boundaries: overview stats (`GET /workspaces/:id`) and the document tree / members / billing panel. Invite and rename go through Server Actions; CRDT never does.

## Strong vs eventual consistency

**Strong** (must be correct immediately): permissions, billing plan, membership, document access. Wrong answers here leak data or break ACL — REST and the collab gateway both check `AccessService` on every request / join / update.

**Eventual**: Meilisearch index (BullMQ after persist), public page ISR cache (revalidate on publish / content change). Search and public HTML can lag a moment; that is acceptable because they are derived views, not the source of truth. Postgres + live Y.Doc remain authoritative.

## CRDT persistence policy

```
editor updates
    │
    ▼
in-memory Y.Doc (room)
    │
    ├─ every update ──► append incremental update (Postgres)
    │
    └─ snapshot every 100 updates OR 60s
           │
           ▼
      snapshot BYTEA in Postgres
           │
           └─ compact @100 updates (fold into snapshot, trim old rows)
                    │
                    ▼
              cold start: load latest snapshot + remaining updates → Y.Doc
```

Idempotent apply uses update hashes. Deleting a document broadcasts `document_deleted` and closes the room.

## Limitations

- **Single Nest process** hosts REST + Collab Gateway (in-process `Map` of rooms). No Redis Pub/Sub across instances. Fine for this assignment; horizontal scale would need sticky sessions or an external Yjs provider + pub/sub.
- **Mock billing** — Checkout + webhook simulation, not real Stripe.
- **Not offline-first** — editor has a light offline indicator; not a PWA with full local-first sync.

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
