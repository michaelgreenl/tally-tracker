# Project Context Overview

> Static overview of the project for agent consumption. **Last Updated:** 2026-03-09

---

## Tech Stack

**Client (`app/client`)**

- **Language:** TypeScript ~5.9 (strict via `vue-tsc`)
- **Framework:** Vue 3 (`<script setup>` Composition API) + Ionic 8
- **Native Bridge:** Capacitor 8 (iOS, Android)
- **State Management:** Pinia 3
- **Router:** Vue Router 4 via `@ionic/vue-router`
- **HTTP Client:** Custom `apiFetch` wrapper over `fetch` (`src/api.ts`)
- **Real-time:** socket.io-client 4
- **Local Storage:** Capacitor Preferences (cross-platform key-value store)
- **Styling:** SCSS with Stylelint; global variables/utils auto-injected via Vite
- **Animation:** GSAP 3
- **Build Tool:** Vite 7 + `@vitejs/plugin-vue` + `@vitejs/plugin-legacy`
- **Type Check:** `vue-tsc`
- **Unit Tests:** Vitest 4 (jsdom environment)
- **E2E Tests:** Cypress 13

**Server (`app/server`)**

- **Language:** TypeScript ^5.9 (strict, `NodeNext` module resolution)
- **Runtime:** Node.js (ESM, `"type": "module"`)
- **Framework:** Express 5
- **Real-time:** socket.io 4
- **Auth:** JWT (`jsonwebtoken`), HttpOnly cookies (web) + Bearer headers (native)
- **Validation:** Zod 4
- **Rate Limiting:** `express-rate-limit`, `express-slow-down`
- **Security:** `helmet`, `cors`, `cookie-parser`
- **Build:** `tsup` (outputs `dist/server.js`)
- **Dev Server:** `tsx watch`
- **Unit/Integration Tests:** Vitest 4 (node environment) + Supertest

**Shared Packages**

- **`@packages/core`** — Prisma client, generated types, shared Zod schemas, request/response types
- **`@packages/utils`** — HTTP status code constants

**Data Layer**

- **ORM:** Prisma 7 (schema lives in `packages/core/prisma/schema/`)
- **Database:** PostgreSQL (`pg` adapter)
- **Prisma client:** shared between server and client (client uses a local SQLite-flavored Prisma for offline use; server uses PostgreSQL via `@prisma/adapter-pg`)

**Tooling**

- **Package Manager:** Bun (workspace root + per-app)
- **Monorepo:** Bun workspaces (`app/*`, `packages/*`)
- **Linting:** ESLint (per-app configs)
- **Formatting:** Prettier 3 (root config, `printWidth: 120`, single quotes, 4-space indent)
- **Commit Linting:** commitlint with conventional commits (extended type set includes `config`, `wip`)
- **Git Hooks:** Husky — `pre-commit` runs type-check + unit tests + optional E2E; `commit-msg` runs commitlint

**Deployment**

- **Platform:** Render
- **DB init:** `prisma db push && prisma db seed` (via `packages/core render:start`)

---

## Directory Structure

```
tally-tracker/
├── app/
│   ├── client/                    # Vue 3 + Ionic SPA (web + native via Capacitor)
│   │   ├── src/
│   │   │   ├── __tests__/         # Unit tests colocated at src root (api.spec.ts)
│   │   │   ├── api.ts             # Cross-platform fetch client (auth injection, refresh, error norm)
│   │   │   ├── App.vue            # Root component; mounts SyncManager
│   │   │   ├── components/
│   │   │   │   ├── base/          # BaseButton.vue, BaseNavLink.vue
│   │   │   │   ├── counter/       # Counter.vue, CounterForm.vue
│   │   │   │   └── inputs/
│   │   │   ├── composables/       # useBreakpoints, useGsap, useNetwork, useSync, animations/
│   │   │   ├── router/            # index.ts — route definitions + auth guard + socket room join
│   │   │   ├── services/
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── counter.service.ts  # Queues mutations into SyncManager
│   │   │   │   ├── storage.service.ts  # Capacitor Preferences abstraction
│   │   │   │   └── sync/
│   │   │   │       ├── __tests__/ # manager.spec.ts, queue.spec.ts
│   │   │   │       ├── manager.ts # SyncManager singleton — processes offline queue
│   │   │   │       ├── queue.ts   # SyncQueueService — persists commands to Preferences
│   │   │   │       └── types.d.ts # MutationCommand, SyncState types
│   │   │   ├── socket/            # counter.socket.ts — inbound counter-update listener
│   │   │   ├── stores/            # authStore.ts, counterStore.ts (Pinia)
│   │   │   ├── types/             # index.ts — StoreResponse type alias
│   │   │   ├── utils/             # errors.ts (ApiError), result.ts (ok/fail), safeUUID.ts
│   │   │   └── views/             # HomeView, LoginView, RegisterView, JoinView
│   │   ├── tests/
│   │   │   └── e2e/
│   │   │       ├── fixtures/      # counter.fixture.ts, user.fixture.ts
│   │   │       ├── specs/         # auth.cy.ts, counters.cy.ts, sharing.cy.ts
│   │   │       └── support/       # commands.ts, e2e.ts, status-codes.ts
│   │   ├── cypress.config.ts
│   │   └── vite.config.ts         # Vitest config embedded; path alias @/ → src/; Vite proxy
│   │
│   └── server/                    # Express 5 API server
│       └── src/
│           ├── api/
│           │   ├── controllers/   # counter.controller.ts, user.controller.ts, health.controller.ts
│           │   ├── routes/        # counter.routes.ts, user.routes.ts, health.routes.ts, index.ts
│           │   └── schemas/       # counter.schema.ts, user.schema.ts (Zod validation)
│           ├── config/            # cookie, cors, express, helmet, limiters, index.ts
│           ├── db/
│           │   ├── cron.ts        # Daily cleanup: idempotency keys + expired tokens
│           │   ├── prisma.ts      # Singleton Prisma client
│           │   └── repositories/  # counter, idempotency, token, user repositories
│           ├── middleware/
│           │   ├── __tests__/     # auth.middleware.spec.ts, idempotency.middleware.spec.ts
│           │   ├── auth.middleware.ts      # Dual-path JWT (cookie + Bearer)
│           │   ├── errorHandler.middleware.ts
│           │   ├── idempotency.middleware.ts
│           │   └── validate.middleware.ts
│           ├── socket/            # Socket.io init; user-room join/leave
│           ├── tests/integration/
│           │   ├── fixtures/      # counter.fixture.ts, user.fixture.ts
│           │   └── specs/         # auth.spec.ts, counters.spec.ts, sharing.spec.ts
│           ├── util/
│           │   ├── __tests__/     # jwt.util.spec.ts
│           │   └── jwt.util.ts
│           ├── app.ts
│           └── server.ts          # Entry point: HTTP server, Socket.io, cron job
│
├── packages/
│   ├── core/                      # Shared Prisma client + generated types + Zod schemas
│   │   ├── prisma/
│   │   │   ├── schema/            # config.prisma, counter.prisma, user.prisma, token.prisma, logging.prisma
│   │   │   └── seeds/
│   │   └── src/
│   │       ├── index.ts           # Re-exports PrismaClient, PrismaTypes, all types
│   │       └── types/
│   │           ├── generated/     # Zod schemas auto-generated by zod-prisma-types
│   │           ├── index.ts       # HexColorSchema + re-exports
│   │           ├── models.d.ts    # ClientUser, ClientCounter (stripped Prisma models)
│   │           ├── requests.d.ts  # All request interfaces + Express augmentation
│   │           └── responses.d.ts # ApiResponse<T>, AuthResponse, CounterResponse
│   │
│   └── utils/                     # HTTP status code named constants
│       └── src/constants/
│           └── status-codes.ts
│
├── docs/
│   ├── agents/                    # Agent rules, context, workflow metadata
│   └── diagrams/                  # Architecture, lifecycle, sequence diagrams (Markdown)
│
├── .husky/                        # pre-commit (typecheck + unit + e2e), commit-msg (commitlint)
├── commitlint.config.ts
├── .prettierrc.js
└── package.json                   # Bun workspace root; cross-app scripts
```

---

## Key Modules & Services

### `app/client/src/api.ts` — Cross-Platform HTTP Client

The single fetch abstraction for all API calls. On native (Capacitor), reads JWT from `Preferences` and attaches as a `Bearer` header. On web, relies on the browser sending the `HttpOnly` cookie automatically. Handles 10-second timeouts, normalizes all errors to `ApiError`, and implements transparent token refresh on 401 with deduplication (concurrent 401s share one refresh attempt). A 204 response always returns `{}`.

### `app/client/src/services/sync/` — Offline Sync Engine

`SyncQueueService` (`queue.ts`) persists `MutationCommand` objects to Capacitor Preferences. `SyncManager` (`manager.ts`) is a singleton that listens for network restoration via `@capacitor/network` and drains the queue in FIFO order. Each command carries its own UUID as the `X-Idempotency-Key` header. Error strategy: 2xx removes the command; 401 stops processing and triggers logout (keeping commands); other 4xx removes the command (treat as fatal); 5xx/network failure stops and retains for retry.

### `app/client/src/stores/` — Pinia Stores

- **`authStore`** — manages `user`, `isAuthenticated`, `isPremium`. Orchestrates cold-start auth (loads cached user, checks token existence, then validates with server). Guest mode is supported — `user` is `null` and operations are local-only.
- **`counterStore`** — manages `counters[]`. On `init()`, loads from local Preferences immediately, then fetches remote in the background and merges. All mutations update local state first (optimistic), then enqueue a command via `CounterService`.

### `app/client/src/services/counter.service.ts` — Counter Mutation Layer

Bridges the Pinia store and the sync engine. For reads, calls `apiFetch` directly. For writes (create, update, increment, delete), builds a `MutationCommand` and adds it to the queue via `SyncQueueService`, then immediately calls `SyncManager.processQueue()` to attempt real-time sync.

### `app/server/src/api/` — Express REST API

Three route groups: `/users`, `/counters`, `/health`. All counter routes are protected by the `jwt` middleware and the `idempotency` middleware. Schemas in `api/schemas/` are Zod objects validated by `validate.middleware.ts`. Controllers call repository functions directly; there is no service layer on the server.

### `app/server/src/db/repositories/` — Repository Pattern

Each file exports named functions (no classes). They call Prisma directly. `counter.repository.ts` handles all counter + share operations including RBAC checks (`getByIdOrShare` ensures only owner or ACCEPTED share can modify). `getParticipants` returns all user IDs that should receive socket broadcasts. `idempotency.repository.ts` tracks processed command keys. `token.repository.ts` manages refresh tokens. A daily cron job (`db/cron.ts`) cleans up expired records.

### `app/server/src/socket/index.ts` — Socket.io Rooms

Each authenticated client joins a room keyed by their own `userId`. When a counter mutation is broadcast, the server queries `getParticipants(counterId)` and emits `counter-update` to each participant's room individually. This avoids counter-scoped room management and prevents unauthorized listeners.

### `packages/core` — Shared Type & Client Package

Exports `PrismaClient`, all Prisma types, Zod-generated schemas (via `zod-prisma-types`), and hand-authored types (`ClientUser`, `ClientCounter`, `ApiResponse<T>`, all request/response interfaces). Consumed by both `app/client` and `app/server`. The Prisma schema is split across multiple `.prisma` files in `prisma/schema/`.

### `packages/utils` — Shared Constants

Only exports HTTP status code named constants (`OK`, `CREATED`, `UNAUTHORIZED`, etc.). Used by both apps and tests to avoid magic numbers.

---

## Established Patterns

### Naming Conventions

- **Files:** `camelCase.ts` for utilities/services/composables; `PascalCase.vue` for components; `kebab-case` not observed — the codebase uses camelCase for `.ts` files
- **Stores:** `useXxxStore` (Pinia setup stores with `defineStore`)
- **Composables:** `useXxx.ts`
- **Services:** `xxx.service.ts` (object literal with async methods, not classes)
- **Repositories (server):** `xxx.repository.ts` (named function exports, no classes)
- **Controllers (server):** `xxx.controller.ts`
- **Middleware (server):** `xxx.middleware.ts`
- **Schemas (server):** `xxx.schema.ts`
- **Types/interfaces:** PascalCase; `d.ts` files use `export type`/`export interface`
- **Test files:** `xxx.spec.ts` (all test types — unit, integration, and util specs)
- **E2E files:** `xxx.cy.ts`

### File Organization

- Server tests are colocated with source using `__tests__/` subdirectories adjacent to the file under test
- Client unit tests use `__tests__/` adjacent to source OR at `src/__tests__/` for top-level modules
- Client E2E tests live in `app/client/tests/e2e/` (separate from `src/`)
- Server integration tests live in `app/server/src/tests/integration/specs/`
- Fixtures are shared between Cypress e2e and Vitest unit tests (e.g., `counter.fixture.ts` in `tests/e2e/fixtures/` is imported by unit tests in `src/services/sync/__tests__/`)

### Import / Path Aliases

- **Client:** `@/` maps to `app/client/src/` (configured in `vite.config.ts` and `tsconfig.app.json`)
- **Shared packages:** imported as `@packages/core` and `@packages/utils` (Bun workspace resolution)
- **Server:** no path aliases; uses relative imports with `.js` extensions (required by `NodeNext` module resolution)

### API Response Shape

All API responses conform to `ApiResponse<T>` from `@packages/core`:

```ts
{ success: true; message?: string; data?: T }
| { success: false; message: string }
```

Status codes use named constants from `@packages/utils` (never magic numbers).

### Store Return Convention

All Pinia store actions that can fail return `StoreResponse` (alias for `ApiResponse<never>`). Callers check `result.success` rather than catching exceptions. Factory helpers `ok()` and `fail(message)` in `src/utils/result.ts` build these values.

### Error Handling

- **Client:** `ApiError` (custom class in `src/utils/errors.ts`) is the only thrown error type from `apiFetch`. Stores catch these and return `fail(message)`.
- **Server:** `errorHandler.middleware.ts` is the global Express error boundary; returns `{ success: false, message }` JSON. Repositories return `null` on not-found (controllers then respond 404).

### State Management (Client)

- Pinia setup stores (function syntax, not options API)
- Local Capacitor Preferences is the persistent backing store for counters
- UI is driven from `counterStore.counters` ref; no derived server state cache
- Optimistic updates: local state changes immediately, then enqueue async mutation

### Zod Validation (Server)

- Zod schemas in `api/schemas/` validate `{ body, params, query }` shape
- `validate.middleware.ts` applies the schema and responds 422 on failure
- Shared Zod schemas (like `HexColorSchema`, `CounterTypeSchema`) live in `packages/core` and are imported by server schemas

### TypeScript

- Client: `strict` via `@vue/tsconfig/tsconfig.dom.json`; `noEmit: false` + `emitDeclarationOnly: true` for project references
- Server: `strict: true`, `module: NodeNext`, `moduleResolution: NodeNext`; all imports use `.js` extension even for `.ts` source files
- `packages/core` exports source `.ts` files directly (no build step); `main` and `exports` point to `src/index.ts`

### Commit Convention

Conventional commits enforced by commitlint. Extended type set: `build | chore | ci | config | docs | feat | fix | perf | refactor | revert | style | test | wip`

---

## Testing Conventions

### Frameworks In Use

| App                             | Framework  | Environment  |
| ------------------------------- | ---------- | ------------ |
| `app/client` unit               | Vitest 4   | jsdom        |
| `app/server` unit + integration | Vitest 4   | node         |
| `app/client` e2e                | Cypress 13 | real browser |

### Test File Naming

- **All Vitest tests (both apps):** `*.spec.ts`
- **Cypress e2e tests:** `*.cy.ts`
- There are no `*.test.ts` files in the codebase.

### Test Locations

#### Client — Unit Tests (`*.spec.ts`)

- `app/client/src/__tests__/` — top-level source tests (e.g., `api.spec.ts`)
- `app/client/src/services/sync/__tests__/` — sync module tests (`manager.spec.ts`, `queue.spec.ts`)

#### Client — E2E Tests (`*.cy.ts`)

- `app/client/tests/e2e/specs/` — `auth.cy.ts`, `counters.cy.ts`, `sharing.cy.ts`
- Support: `tests/e2e/support/` (custom Cypress commands, status codes)
- Fixtures: `tests/e2e/fixtures/` (`counter.fixture.ts`, `user.fixture.ts`)
- Cypress `baseUrl`: `http://localhost:8100`
- Cypress `specPattern`: `tests/e2e/specs/**/*.cy.{js,jsx,ts,tsx}`

#### Server — Unit Tests (`*.spec.ts`)

- `app/server/src/middleware/__tests__/` — `auth.middleware.spec.ts`, `idempotency.middleware.spec.ts`
- `app/server/src/util/__tests__/` — `jwt.util.spec.ts`

#### Server — Integration Tests (`*.spec.ts`)

- `app/server/src/tests/integration/specs/` — `auth.spec.ts`, `counters.spec.ts`, `sharing.spec.ts`
- Fixtures: `app/server/src/tests/integration/fixtures/`
- Uses Supertest against the real Express `app` instance with mocked repositories and middleware

### Running Tests

```bash
# All unit tests (client + server)
bun run test:unit

# Client unit tests only
bun --filter=client run test:unit

# Server unit + integration tests only
bun --filter=server run test

# All E2E tests (client Cypress)
bun run test:e2e

# All tests
bun run test

# Single spec (client unit)
npx vitest run <path-to-spec>

# Single spec (Cypress)
npx cypress run --spec <path-to-spec>
```

### Pre-commit Hooks

The `pre-commit` hook runs (in order):

1. `bun run type-check` (both apps via `vue-tsc` and `tsc`)
2. `bun run test:unit` (client + server)
3. `bun run test:e2e` (Cypress) — skipped if `SKIP_E2E=1` (use `bun run commit:skip`)

### Test Fixture Pattern

Both apps use `buildXxx(overrides)` factory functions in fixture files. The client's `tests/e2e/fixtures/counter.fixture.ts` is also imported directly by unit tests in `src/services/sync/__tests__/` — there is **one shared fixture file** for the client, not separate sets per test type.

### Mocking Conventions (Server Integration Tests)

- `auth.middleware` is always mocked to inject a fixed `req.user`
- Repository modules are fully mocked with `vi.mock()`
- Socket.io `io` is injected via `app.set('io', ...)`
- Idempotency repository is mocked to return `null` (no-op) by default

---

## Configuration Files of Note

| File | Purpose |
| --- | --- |
| `package.json` (root) | Bun workspace definition; cross-app `test`, `build`, `type-check`, `format` scripts |
| `app/client/vite.config.ts` | Vite build + dev proxy + Vitest config (unit test include pattern: `src/**/*.{test,spec}.{js,ts}`) |
| `app/client/cypress.config.ts` | Cypress e2e config; baseUrl, specPattern, supportFile |
| `app/client/tsconfig.app.json` | TS config for Vue source; excludes `__tests__/`; path alias `@/` |
| `app/server/tsconfig.json` | Server TS config; `NodeNext` modules; strict; no path aliases |
| `app/server/vitest.config.ts` | Vitest node environment; globals enabled |
| `packages/core/prisma/schema/` | Split Prisma schema files (config, user, counter, token, logging) |
| `packages/core/prisma.config.ts` | Prisma config pointing to split schema |
| `.prettierrc.js` | `printWidth: 120`, single quotes, 4-space indent, `trailingComma: 'all'` |
| `commitlint.config.ts` | Conventional commits with extended type list |
| `.husky/pre-commit` | Runs type-check + unit tests + optional E2E on every commit |

---

## Known Constraints & Gotchas

- **`NodeNext` module resolution on server:** All server-side imports of `.ts` files must use `.js` extension (e.g., `import foo from './foo.js'`). This is non-negotiable for the `tsup` build and `tsx` dev runner.
- **Prisma schema is split:** Schema lives in `packages/core/prisma/schema/*.prisma` with a `prisma.config.ts` pointing to the directory. Agents must not assume a single `schema.prisma` file. The client also has a `schema.prisma` at `app/client/schema.prisma` — this appears to be a local/offline Prisma client config; its exact purpose relative to `packages/core` is not fully documented.
- **No server-side service layer:** Controllers call repository functions directly. There is no `services/` directory in `app/server/src/`. Do not introduce one without an explicit requirement.
- **Shared package has no build step:** `@packages/core` and `@packages/utils` export raw `.ts` source. Both apps must be able to resolve TypeScript directly (Vite handles this for client; `tsx`/`tsup` handles it for server).
- **Fixtures are cross-test-type:** `app/client/tests/e2e/fixtures/counter.fixture.ts` exports `buildCommand()` which is used by Vitest unit tests. Do not duplicate or move fixture files without updating all imports.
- **Socket.io rooms are user-scoped, not counter-scoped:** Broadcasts target `userId` rooms. Do not design features that assume counter-scoped rooms.
- **Idempotency is fail-open:** If the idempotency middleware errors, it returns 204 (allowing the request through) rather than blocking. This is intentional.
- **`SKIP_E2E=1` flag:** Use `bun run commit:skip` to commit without running Cypress. E2E requires a running dev server at `localhost:8100`.
- **No CI/CD configuration found:** No `.github/workflows/` or equivalent CI config exists in the repo. All quality gates are enforced locally via Husky.
- **Guest mode is a first-class concern:** The client supports unauthenticated "guest" usage with local-only counters. `userId = 'guest'` is used as a sentinel. Any feature touching counters must account for the guest path.
- **Cross-platform auth divergence:** Web uses `HttpOnly` cookies; native uses Capacitor `Preferences` + `Bearer` headers. Any auth-related change must handle both paths. See `app/client/src/api.ts` and `app/server/src/middleware/auth.middleware.ts`.
- **Deployment via Render:** `render:build` and `render:start` scripts exist in root and server packages. DB is provisioned with `prisma db push` + seed on deploy.
- **`docs/agents/project-context.md` was previously a stub:** Prior to this update, the file contained placeholder text and incorrect test convention documentation (wrong file extensions and wrong paths). This document supersedes it entirely.
