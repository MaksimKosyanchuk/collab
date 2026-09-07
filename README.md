# Collab Docs

Simplified Notion-like workspace: nested pages and blocks, real-time collaborative editing via CRDT (Yjs), comments, public SEO pages, search, and a mock subscription with plan limits.

**Status:** assignment complete per [`docs/assignment-spec.md`](docs/assignment-spec.md).

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js App Router (TypeScript) |
| Backend | NestJS REST API (`:3001`) + separate collab gateway (`:3002`) |
| CRDT | Yjs over `ws://…:3002/collab` (custom WebSocket provider) |
| DB / ORM | PostgreSQL + Prisma |
| Search | Meilisearch (async index via BullMQ; Postgres FTS fallback) |
| Storage | MinIO (S3-compatible), presigned URLs |
| Queues | Redis + BullMQ: `search-sync`, `revalidate`, `notifications`, `billing-webhook` |
| Auth | JWT access + refresh |
| Billing | Mock Stripe Checkout + idempotent webhook via BullMQ |
| Observability | Structured logs + `/metrics` |
| Lint / format | ESLint + Prettier (`useTabs`, `tabWidth: 4`) in `frontend/` and `backend/` |

## Architecture

```
Browser
  ├─ /p/[slug]          → Next Server Components (SSR/ISR)
  ├─ /app/...           → RSC shell + Client editor (Yjs WS)
  └─ Server Actions     → auth, invites, publish, settings
        │
        ├──────────────────┐
        ▼                  ▼
Nest API (:3001)      Collab gateway (:3002)
  REST + ACL            Yjs WS /collab
  Outbox → BullMQ       Redis control plane
  billing-webhook         (flush / kick / reload)
        │                  │
        └──── Redis / PostgreSQL / Meilisearch / MinIO ────┘
```

Dockerfiles: `frontend/Dockerfile`, `backend/Dockerfile` (API), `backend/Dockerfile.collab` (gateway).

### Backend modules

`auth`, `workspaces`, `documents`, `collab` (gateway + persistence + Redis control), `comments`, `search`, `billing`, `notifications`, plus shared `access` used by REST and WS.

### Access model

1. Workspace Owner/Admin → always MANAGE on documents  
2. Explicit `DocumentShare` → overrides workspace role for that page  
3. Else workspace role (Editor / Viewer)  
4. Else public link token (view/edit, optional expiry)  
5. Else 403  

REST and collab WS enforce the same rules — hiding Edit in the UI is not security.

## Next.js: Server vs Client boundary

| Surface | Primitive | Why |
|---|---|---|
| Public `/p/[slug]` | **Server Components + SSR/ISR** (`revalidate: 30` + on-demand tags) | SEO meta, sanitized content, no extra client JS |
| Workspace dashboard | **RSC + Streaming Suspense** | Independent chunks (stats / tree) without blocking the page |
| Private routes | **Edge middleware** | Public vs `/app`; redirect unauthenticated users |
| Forms: invite, rename, publish, share, auth | **Server Actions** | Cookie session + `revalidatePath` / `revalidateTag` |
| Block editor, presence, DnD tree | **Client Components** | Browser APIs, WebSocket, local `Y.Doc` |
| Typing / cursors | **WebSocket + CRDT only** | Server Actions cannot stream concurrent merges |

Rule of thumb: SEO or one-shot authenticated mutation → server. Live collaborative state → client + CRDT channel.

## Strong vs eventual consistency

**Strong** (must be correct immediately): permissions, billing plan, membership, document access. Checked on every REST call and every collab join/update.

**Eventual** (derived views may lag briefly):

- **Search index** — outbox → BullMQ after persist / document mutations; Meilisearch is not the source of truth.
- **Public ISR** — timer + on-demand (`page.revalidate` → Next `/api/revalidate`); editing does not wait for HTML rebuild.
- **Document tree** — `unstable_cache` + tag `workspace-tree:{id}`, invalidated on create/move/delete/rename/flush.

## CRDT persistence

```
clients ──WS──► in-memory Y.Doc (room on collab gateway)
                    │
                    ├─ each update → DocumentCollabUpdate (BYTEA + sha256)
                    │                 unique(documentId, hash) → replay-safe
                    │
                    └─ flush (debounce ~750ms)
                           ├─ compact into DocumentCollabState at 100 updates
                           ├─ version snapshot every 100 updates OR 60s
                           └─ DocumentProjection (sanitized) for SSR / search

cold start: snapshot + remaining updates → Y.Doc
delete while editing: document_deleted, close sockets, drop room
publish: flushProjection via Redis control plane before publication toggle
API ↔ collab: Redis pub/sub (collab:cmd / collab:reply)
```

## Search consistency

1. Edit lands in Y.Doc / Postgres  
2. Outbox `search.index` / `search.delete`  
3. BullMQ worker → Meilisearch  
4. Query API filters hits by caller ACL  

If Meilisearch is down — Postgres text search on projections (still ACL-filtered).

## Billing webhook

`POST /billing/webhook` enqueues a BullMQ job (`jobId` = external event id). The worker applies the plan once; replays return `{ duplicate: true }` (plus unique `BillingEvent.externalId`). HTTP waits for the worker so the mock Checkout UI stays synchronous.

## Run

```bash
cp .env.example .env   # optional
docker compose up --build
```

| URL | Service |
|---|---|
| http://localhost:3000 | Next.js |
| http://localhost:3000/p/[slug] | Public SSR/ISR |
| http://localhost:3001 | Nest REST API |
| http://localhost:3001/api/docs | Swagger UI |
| http://localhost:3001/api/docs-json | OpenAPI JSON |
| http://localhost:3001/api/docs-yaml | OpenAPI YAML |
| [`docs/openapi.yaml`](docs/openapi.yaml) | Static OpenAPI |
| http://localhost:3002/health | Collab gateway health |
| `ws://localhost:3002/collab` | Collab Yjs WebSocket |
| http://localhost:9001 | MinIO (`minio` / `minio12345`) |

Compose starts: Postgres, Redis, MinIO, Meilisearch, **backend**, **collab**, frontend.

### Staging

```bash
cp .env.staging.example .env.staging
docker compose -f docker-compose.yml -f docker-compose.staging.yml --env-file .env.staging up --build
```

Separate host ports and secrets (`APP_ENV=staging`).

### Hybrid (infra in Docker, apps locally)

```bash
docker compose up -d postgres redis minio meilisearch
cd backend && cp .env.example .env && npm i && npx prisma migrate deploy
npm run start:dev          # API :3001
npm run start:collab:dev   # gateway :3002
cd frontend && cp .env.example .env.local && npm i --legacy-peer-deps && npm run dev
```

## Lint / format

In `frontend/` and `backend/`: Prettier + ESLint, indentation = **tabs**, `tabWidth: 4` (see `.prettierrc.json`, `.editorconfig`).

```bash
cd frontend && npm run lint && npm run format:check
cd backend  && npm run lint && npm run format:check

# autofix src:
cd frontend && npm run format && npm run lint:fix
cd backend  && npm run format && npm run lint:fix
```

## Tests

```bash
cd backend  && npm test && npm run test:e2e
cd frontend && npm test && PLAYWRIGHT_SKIP_WEBSERVER=1 npm run test:e2e
```

TZ §5 coverage:

- Unit: ACL/share, CRDT merge/idempotency, billing webhook idempotency, revalidate  
- Nest e2e: Viewer cannot edit via API; two WS clients without lost updates; publish → public payload + revalidate  
- Playwright: Viewer UI; `/p/[slug]` SSR and refresh after edit  
- Optional FE: route-state, errors, `/api/revalidate`

CI (`.github/workflows/ci.yml`): build / lint / unit → compose smoke → e2e.

## Deliverables (TZ §6)

| # | Item | Location |
|---|---|---|
| 1 | Git repository | this repo |
| 2 | README (architecture, SC/CC, CRDT, search, run, skips) | this file |
| 3 | `.env.example` | root + `backend/` + `frontend/` (+ `.env.staging.example`) |
| 4 | Docker FE / BE / collab + compose (MinIO, Redis) | `frontend/Dockerfile`, `backend/Dockerfile`, `backend/Dockerfile.collab`, `docker-compose.yml` |
| 5 | Swagger / OpenAPI | `/api/docs`, `docs/openapi.yaml` |
| 6 | CI | `.github/workflows/ci.yml` |

## What was skipped / would do differently

Out of scope per TZ §8:

- **Real Stripe** — mock Checkout + BullMQ webhook only  
- **Offline-first / PWA** — Live/Reconnecting/Offline indicator + reconnect, not offline-first  
- **Full Notion editor** — 6 block types  
- **Per-block ACL** — document / workspace level only  
- **100% coverage** — key unit + critical e2e only  

## Repo layout

```
frontend/                      Next.js App Router
backend/                       Nest API + collab entry (`collab-main`)
  Dockerfile                   API image
  Dockerfile.collab            Collab gateway image
docker-compose.yml             Full stack
docker-compose.staging.yml     Staging overlay
.env.example / .env.staging.example
docs/                          TZ, handoff, openapi.yaml, graphify
.github/workflows/ci.yml
```
