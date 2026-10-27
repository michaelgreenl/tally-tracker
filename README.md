# Tally
> A cross-platform offline-first application utilizing a custom synchronization queue for network resilience, featuring real-time shared counters and native deep linking integration.

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=fff)](https://www.typescriptlang.org/docs/)
[![React Native](https://img.shields.io/badge/React%20Native-61dafb?style=for-the-badge&&logo=react&logoColor=black)](https://reactnative.dev)
[![Expo](https://img.shields.io/badge/Expo-111?style=for-the-badge&logo=expo)](https://expo.dev)
[![Node](https://img.shields.io/badge/Node-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/) 
[![Socket.io](https://img.shields.io/badge/Socket.io-black?style=for-the-badge&logo=socket.io&badgeColor=010101)](https://socket.io/) 
[![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)](https://www.prisma.io/) 
## Links
- **💼 [Portfolio Link](https://michaelgreenl.net/projects/tally/)**
- **🎥 [Demo Video](https://michaelgreenl.net/projects/tally/)**

## Overview

Tally is a React Native counter app for Android, iOS, and web. It supports guest, authenticated, and shared counters.

The client writes counter changes to React state first. It saves local state and queues authenticated mutations for later replay.

Counter writes use HTTP. The server sends Socket.io `counter-update` events to the owner and accepted participants.

The API supports password, Google, and Apple sign-in, unique usernames, account deletion, personal counters, and shared counters. Basic accounts can join one shared counter. Premium accounts can start sharing and join more counters. Native purchases and restoration use RevenueCat, with server-verified access.

The iOS app includes interactive Home Screen widgets and read-only Lock Screen counters. See the [release checklist](docs/plans/pre-ui-product-roadmap.md) for publication status.

## Architecture & Key Features

### Client Side

#### Offline Counter State

- **Local persistence:** AsyncStorage saves guest and authenticated counter lists.
- **Optimistic updates:** Counter actions update React context state before network confirmation.
- **Persistent sync queue:** Authenticated mutations are stored in `app_sync_queue` as `CREATE`, `UPDATE`, `INCREMENT`, `DELETE`, and `REMOVE` commands.
- **Network replay:** `SyncManager` processes queued commands when Expo Network reports connectivity.
- **Retry handling:** Temporary failures keep commands queued. Rejected commands remain recoverable while unrelated counters continue to synchronize.

#### Cross-Platform Auth

- **Web auth:** Browser requests use HttpOnly `access_token` and `refresh_token` cookies.
- **Native auth:** iOS and Android requests read tokens from Expo SecureStore and attach Bearer headers.
- **Refresh flow:** `apiFetch` deduplicates concurrent refresh attempts and retries the original request after a successful refresh.
- **Deep links:** Expo Router maps `tally://join?code=...` to the join screen.

#### Sharing UI

- **Invite links:** Shared counter cards copy `/join?code=...` links to the clipboard.
- **Tier gating:** Starting sharing requires a verified Premium account. Existing participants can forward the invite without Premium.
- **Participants:** Shared cards open a participant list with usernames, presence, and last actions. Owners can remove participants after confirmation.
- **Guest limits:** Guest sessions can create up to three personal counters; existing guest counters remain usable after the cap is reached.

### Server Side

#### API and Data Model

- **Routes:** Express mounts `/users`, `/counters`, `/billing`, and `/health` routes.
- **Database:** Prisma targets PostgreSQL. Models cover accounts, counters, memberships, sessions, email codes, login limits, and mutation receipts.
- **Sharing model:** `CounterShare` stores `PENDING`, `ACCEPTED`, and `REJECTED` states with a unique `(counterId, userId)` constraint.
- **Counter access:** Repository queries return owned counters plus counters shared with the user at `ACCEPTED` status.

#### Auth and Validation

- **Password auth:** New passwords use scrypt. Existing bcrypt hashes remain readable without accepting truncated passwords.
- **Token handling:** Access tokens are issued as cookies for web clients and response fields for native clients.
- **Refresh tokens:** Refresh token records are stored in PostgreSQL and rotated during `/users/refresh`.
- **Request validation:** Zod validates request bodies and route params; `@tally/core` exports shared model, request, and response types.

#### Realtime and Idempotency

- **Socket rooms:** Socket.io clients join rooms keyed by user ID.
- **Broadcasting:** Shared counter increments use Prisma atomic increments, then emit `counter-update` to the owner and accepted sharers.
- **Duplicate protection:** Counter routes accept `X-Idempotency-Key`; completed duplicate requests replay the original mutation status and body without running the mutation again. Reusing a key for a different user/request, or while the original request is still processing, returns `409`.
- **Cleanup jobs:** Server startup begins cleanup for expired refresh tokens and login-rate limits. Mutation receipts remain until account deletion.

## Tech Stack

**Client:**

- **Framework:** React Native, Expo, Expo Router
- **State Management:** React context
- **Language:** TypeScript
- **Storage:** AsyncStorage and Expo SecureStore
- **Realtime:** Socket.io client
- **Testing:** Vitest and Cypress

**Server:**

- **Runtime:** Node.js, Express 5
- **Database:** PostgreSQL, Prisma ORM
- **Realtime:** Socket.io
- **Language:** TypeScript
- **Validation:** Zod
- **Testing:** Vitest, Supertest

**Workspace:**

- **Package Manager:** Bun workspaces
- **Shared Package:** `@tally/core`

## Running Locally

Install dependencies:

```bash
bun install
```

Copy the environment templates before starting the services:

```bash
cp packages/app/server/.env.example packages/app/server/.env.development
cp packages/app/client/.env.example packages/app/client/.env
```

Set the client's `EXPO_PUBLIC_API_URL` to your local API. The client template targets the deployed API; do not use it for tests.
Use `http://localhost:3000` in a browser or simulator. A physical phone needs the Mac's LAN address.

Start the database, generate Prisma files, and apply migrations:

```bash
bun run dev:db
POSTGRES_URL=postgresql://template_user:template_pass@localhost:5432/template_db bun --filter=@tally/core run generate
POSTGRES_URL=postgresql://template_user:template_pass@localhost:5432/template_db bun --filter=@tally/core run migrate:deploy
```

Start the API and client in separate terminals:

```bash
bun run dev:server
bun run dev:client -- --max-workers 1
```

The API uses port `3000`. Expo uses port `8081` and connects to `EXPO_PUBLIC_API_URL`.

For an existing iOS development build, start Metro and open the installed app:

```bash
bun run dev:client -- --dev-client --max-workers 1
```

Open the installed Tally development build. Scan the Expo QR code if the app does not connect automatically.

Native builds use the resource limits in [AGENTS.md](AGENTS.md). Run one heavy job at a time and stop above 70% total CPU.
For Xcode builds, use `-jobs 1 ONLY_ACTIVE_ARCH=YES SWIFT_USE_PARALLEL_WHOLE_MODULE_OPTIMIZATION=NO`.

Rebuild the native app after a native dependency or Expo config change. JavaScript and environment changes only need an Expo restart.

Sentry stays off when `EXPO_PUBLIC_SENTRY_ENABLED=false` or `EXPO_PUBLIC_SENTRY_DSN` is empty. The local native scripts skip source map uploads. Native release builds use `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` for uploads.

Reset and seed the local database:

```bash
bun run dev:db:reset
```

This command force-resets the local PostgreSQL database. Stop the database with `bun run dev:db:stop`, or delete its local volume with `bun run dev:db:clean`.

Build the client and server:

```bash
bun run build
```

Run checks:

```bash
bun run typecheck
bun run lint
bun run format:check
VITEST_MAX_WORKERS=1 bun run test:unit
VITEST_MAX_WORKERS=1 bun run test:component
```

The test taxonomy is:

- `test:unit`: client and server tests that isolate their subject.
- `test:component`: server HTTP route tests with mocked application collaborators.
- `test:integration`: real Express routes, repositories, transactions, and PostgreSQL.
- `test:e2e`: Cypress flows through the running client and server.

### PostgreSQL integration tests

Use the dedicated test database workflow from the repository root:

```bash
bun run test:db:start
bun --filter=@tally/core run generate:client
bun run test:db:migrate
VITEST_MAX_WORKERS=1 bun run test:integration
bun run test:db:stop
```

Run `test:db:stop` after the tests even when a prior command fails. The test compose file uses the distinct `tally-tracker-test` project and `postgres-test` service. It binds only `127.0.0.1:5433` and stores PostgreSQL data in tmpfs. Set `TALLY_TEST_DB_PORT` on each command if port 5433 is unavailable.

The migration step applies the repository's committed migrations to `tally_tracker_test`; the integration runner then preserves Prisma's `_prisma_migrations` table while clearing only application tables before each test. Before test collection or application imports, the runner refuses to continue unless all of these guardrails hold:

- `NODE_ENV=test`
- `TALLY_TEST_DB_RESET=1`
- `POSTGRES_URL` uses `postgres:` or `postgresql:`, targets `localhost` or `127.0.0.1`, has the exact database path `/tally_tracker_test`, and contains no query parameters or URL fragment. The local scripts use port 5433 by default.

Cypress tests use `http://localhost:8081`:

```bash
bun run test:e2e
```

Cypress checks Metro's API target before running. Both the site and API must use local HTTP addresses.
Start Expo with `EXPO_PUBLIC_API_URL=http://localhost:3000 bun start --max-workers 1` from `packages/app/client`.
Set `CYPRESS_BASE_URL` when using another local Expo port.
