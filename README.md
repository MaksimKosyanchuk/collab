# Collab Docs

Упрощённый Notion-like workspace: вложенные страницы и блоки, real-time совместное редактирование через CRDT (Yjs), комментарии, публичные SEO-страницы, поиск и mock-подписка с лимитами.

**Статус:** тестовое задание по [`docs/ТЗ_тестове_завдання_5_Fullstack_NextJS_Expert.md`](docs/ТЗ_тестове_завдання_5_Fullstack_NextJS_Expert.md) — выполнено.

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js App Router (TypeScript) |
| Backend | NestJS REST API (`:3001`) + отдельный collab-шлюз (`:3002`) |
| CRDT | Yjs over `ws://…:3002/collab` (свой WebSocket-провайдер) |
| DB / ORM | PostgreSQL + Prisma |
| Search | Meilisearch (async index via BullMQ; Postgres FTS fallback) |
| Storage | MinIO (S3-compatible), presigned URLs |
| Queues | Redis + BullMQ: `search-sync`, `revalidate`, `notifications`, `billing-webhook` |
| Auth | JWT access + refresh |
| Billing | Mock Stripe Checkout + idempotent webhook через BullMQ |
| Observability | Structured logs + `/metrics` |
| Lint / format | ESLint + Prettier (`useTabs`, `tabWidth: 4`) в `frontend/` и `backend/` |

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

Dockerfiles: `frontend/Dockerfile`, `backend/Dockerfile` (API), `backend/Dockerfile.collab` (шлюз).

### Backend modules

`auth`, `workspaces`, `documents`, `collab` (gateway + persistence + Redis control), `comments`, `search`, `billing`, `notifications`, плюс общий `access` для REST и WS.

### Access model

1. Workspace Owner/Admin → всегда MANAGE на документах  
2. Явный `DocumentShare` → перекрывает роль workspace для этой страницы  
3. Иначе роль workspace (Editor / Viewer)  
4. Иначе публичный link-token (view/edit, опциональный expiry)  
5. Иначе 403  

REST и collab WS проверяют права одинаково — скрытие Edit в UI не является защитой.

## Next.js: Server vs Client boundary

| Surface | Primitive | Why |
|---|---|---|
| Public `/p/[slug]` | **Server Components + SSR/ISR** (`revalidate: 30` + on-demand tags) | SEO meta, санитизированный контент, без лишнего client JS |
| Workspace dashboard | **RSC + Streaming Suspense** | Независимые чанки (stats / tree) без блокировки всей страницы |
| Private routes | **Edge middleware** | Публичное vs `/app`; редирект неавторизованных |
| Forms: invite, rename, publish, share, auth | **Server Actions** | Cookie-сессия + `revalidatePath` / `revalidateTag` |
| Block editor, presence, DnD tree | **Client Components** | Browser APIs, WebSocket, локальный `Y.Doc` |
| Typing / cursors | **WebSocket + CRDT only** | Server Actions не стримят concurrent merge |

Принцип: SEO или одноразовая authenticated-мутация → server. Живое совместное состояние → client + CRDT-канал.

## Strong vs eventual consistency

**Strong** (должно быть верно сразу): права, план биллинга, членство, доступ к документу. Проверяется на каждом REST-вызове и на каждом collab join/update.

**Eventual** (производные представления могут отставать):

- **Search index** — outbox → BullMQ после persist / мутаций документа; Meilisearch не source of truth.
- **Public ISR** — таймер + on-demand (`page.revalidate` → Next `/api/revalidate`); редактирование не ждёт HTML rebuild.
- **Дерево документов** — `unstable_cache` + tag `workspace-tree:{id}`, инвалидация при create/move/delete/rename/flush.

## CRDT persistence

```
clients ──WS──► in-memory Y.Doc (room на collab-шлюзе)
                    │
                    ├─ each update → DocumentCollabUpdate (BYTEA + sha256)
                    │                 unique(documentId, hash) → replay-safe
                    │
                    └─ flush (debounce ~750ms)
                           ├─ compact в DocumentCollabState при 100 updates
                           ├─ version snapshot каждые 100 updates ИЛИ 60s
                           └─ DocumentProjection (sanitized) для SSR / search

cold start: snapshot + хвост updates → Y.Doc
delete while editing: document_deleted, закрытие сокетов, drop room
publish: flushProjection через Redis control plane до смены publication
API ↔ collab: Redis pub/sub (collab:cmd / collab:reply)
```

## Search consistency

1. Правка в Y.Doc / Postgres  
2. Outbox `search.index` / `search.delete`  
3. BullMQ worker → Meilisearch  
4. Query API фильтрует hit’ы по ACL вызывающего  

Если Meilisearch недоступен — fallback на Postgres text search по projections (тоже с ACL).

## Billing webhook

`POST /billing/webhook` кладёт job в BullMQ (`jobId` = external event id), воркер применяет план один раз; повторная доставка → `{ duplicate: true }` (плюс unique `BillingEvent.externalId`). HTTP ждёт результат воркера, чтобы mock Checkout на UI оставался синхронным.

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
| [`docs/openapi.yaml`](docs/openapi.yaml) | Статический OpenAPI |
| http://localhost:3002/health | Collab gateway health |
| `ws://localhost:3002/collab` | Collab Yjs WebSocket |
| http://localhost:9001 | MinIO (`minio` / `minio12345`) |

Compose поднимает: Postgres, Redis, MinIO, Meilisearch, **backend**, **collab**, frontend.

### Staging

```bash
cp .env.staging.example .env.staging
docker compose -f docker-compose.yml -f docker-compose.staging.yml --env-file .env.staging up --build
```

Отдельные host-порты и секреты (`APP_ENV=staging`).

### Hybrid (infra в Docker, apps локально)

```bash
docker compose up -d postgres redis minio meilisearch
cd backend && cp .env.example .env && npm i && npx prisma migrate deploy
npm run start:dev          # API :3001
npm run start:collab:dev   # gateway :3002
cd frontend && cp .env.example .env.local && npm i --legacy-peer-deps && npm run dev
```

## Lint / format

В `frontend/` и `backend/`: Prettier + ESLint, отступы — **tabs**, `tabWidth: 4` (см. `.prettierrc.json`, `.editorconfig`).

```bash
cd frontend && npm run lint && npm run format:check
cd backend  && npm run lint && npm run format:check

# автофикс src:
cd frontend && npm run format && npm run lint:fix
cd backend  && npm run format && npm run lint:fix
```

## Tests

```bash
cd backend  && npm test && npm run test:e2e
cd frontend && npm test && PLAYWRIGHT_SKIP_WEBSERVER=1 npm run test:e2e
```

Покрытие по ТЗ §5:

- Unit: ACL/share, CRDT merge/idempotency, billing webhook idempotency, revalidate  
- Nest e2e: Viewer не редактирует через API; два WS-клиента без потери правок; publish → public payload + revalidate  
- Playwright: Viewer UI; `/p/[slug]` SSR и обновление после edit  
- Опционально FE: route-state, errors, `/api/revalidate`

CI (`.github/workflows/ci.yml`): build / lint / unit → compose smoke → e2e.

## Deliverables (ТЗ §6)

| # | Item | Где |
|---|---|---|
| 1 | Git-репозиторий | этот repo |
| 2 | README (архитектура, SC/CC, CRDT, search, run, skips) | этот файл |
| 3 | `.env.example` | root + `backend/` + `frontend/` (+ `.env.staging.example`) |
| 4 | Docker FE / BE / collab + compose (MinIO, Redis) | `frontend/Dockerfile`, `backend/Dockerfile`, `backend/Dockerfile.collab`, `docker-compose.yml` |
| 5 | Swagger / OpenAPI | `/api/docs`, `docs/openapi.yaml` |
| 6 | CI | `.github/workflows/ci.yml` |

## What was skipped / would do differently

Сознательно вне цели ТЗ (§8):

- **Real Stripe** — только mock Checkout + BullMQ webhook  
- **Offline-first / PWA** — индикатор Live/Reconnecting/Offline + reconnect, не offline-first  
- **Полный Notion-редактор** — 6 типов блоков  
- **Per-block ACL** — права на уровне document / workspace  
- **100% coverage** — ключевые unit + critical e2e  

## Repo layout

```
frontend/                      Next.js App Router
backend/                       Nest API + collab entry (`collab-main`)
  Dockerfile                   API image
  Dockerfile.collab            Collab gateway image
docker-compose.yml             Full stack (dev/prod-like)
docker-compose.staging.yml     Staging overlay
.env.example / .env.staging.example
docs/                          TZ, handoff, openapi.yaml, graphify
.github/workflows/ci.yml
```
