# Tally Tracker
> A cross-platform offline-first application utilizing a custom synchronization queue for network resilience, featuring real-time shared counters and native deep linking integration.

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=fff)](https://www.typescriptlang.org/docs/)
[![React Native](https://img.shields.io/badge/React%20Native-61dafb?style=for-the-badge&&logo=react&logoColor=black)](https://reactnative.dev)
[![Expo](https://img.shields.io/badge/Expo-111?style=for-the-badge&logo=expo)](https://expo.dev)
[![Node](https://img.shields.io/badge/Node-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/) 
[![Socket.io](https://img.shields.io/badge/Socket.io-black?style=for-the-badge&logo=socket.io&badgeColor=010101)](https://socket.io/) 
[![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)](https://www.prisma.io/) 
## Links
- **💼 [Portfolio Link](https://michaelgreenl.net/#projects?slug=tally&autoplay=false)**
- **🎥 [Demo Video](https://michaelgreenl.net/#projects?slug=tally&autoplay=true)**

## Overview

Tally Tracker is a React Native counter app for Android, iOS, and web. It supports guest, authenticated, and shared counters.

The client writes counter changes to React state first. It saves local state and queues authenticated mutations for later replay.

Shared counter increments use Socket.io. The server sends `counter-update` events to the owner and accepted sharers.

The API supports email/password registration, login, logout, auth checks, refresh token rotation, personal counters, shared counters, invite-code joins, and share removal. `BASIC` users cannot create shared counters and can join one shared counter; `PREMIUM` users can create and join shared counters. The upgrade screen is informational only; billing is not implemented.

## Architecture & Key Features

### Client Side

#### Offline Counter State

- **Local persistence:** AsyncStorage saves guest and authenticated counter lists.
- **Optimistic updates:** Counter actions update React context state before network confirmation.
- **Persistent sync queue:** Authenticated mutations are stored in `app_sync_queue` as `CREATE`, `UPDATE`, `SET_COUNT`, `INCREMENT`, `DELETE`, and `REMOVE` commands.
- **Network replay:** `SyncManager` processes queued commands when Expo Network reports connectivity.
- **Retry handling:** Network failures, 5xx responses, and expired sessions keep commands queued; non-401 4xx responses are removed to unblock later commands.

#### Cross-Platform Auth

- **Web auth:** Browser requests use HttpOnly `access_token` and `refresh_token` cookies.
- **Native auth:** iOS and Android requests read tokens from Expo SecureStore and attach Bearer headers.
- **Refresh flow:** `apiFetch` deduplicates concurrent refresh attempts and retries the original request after a successful refresh.
- **Deep links:** Expo Router maps `tally://join?code=...` to the join screen.

#### Sharing UI

- **Invite links:** Shared counter cards copy `/join?code=...` links to the clipboard.
- **Tier gating:** The counter form disables shared-counter creation unless the authenticated user is `PREMIUM`.
- **Guest limits:** Guest sessions can create up to three personal counters; existing guest counters remain usable after the cap is reached.

### Server Side

#### API and Data Model

- **Routes:** Express mounts `/users`, `/counters`, and `/health` routes.
- **Database:** Prisma targets PostgreSQL and defines `User`, `Counter`, `CounterShare`, `RefreshToken`, and `IdempotencyLog` models.
- **Sharing model:** `CounterShare` stores `PENDING`, `ACCEPTED`, and `REJECTED` states with a unique `(counterId, userId)` constraint.
- **Counter access:** Repository queries return owned counters plus counters shared with the user at `ACCEPTED` status.

#### Auth and Validation

- **Password auth:** User passwords are hashed with bcrypt.
- **Token handling:** Access tokens are issued as cookies for web clients and response fields for native clients.
- **Refresh tokens:** Refresh token records are stored in PostgreSQL and rotated during `/users/refresh`.
- **Request validation:** Zod validates request bodies and route params; `@tally/core` exports shared model, request, and response types.

#### Realtime and Idempotency

- **Socket rooms:** Socket.io clients join rooms keyed by user ID.
- **Broadcasting:** Shared counter increments use Prisma atomic increments, then emit `counter-update` to the owner and accepted sharers.
- **Duplicate protection:** Counter routes accept `X-Idempotency-Key`; completed duplicate requests replay the original mutation status and body without running the mutation again. Reusing a key for a different user/request, or while the original request is still processing, returns `409`.
- **Cleanup jobs:** Server startup begins cleanup for expired refresh tokens and old idempotency logs.

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

Start the database, API, and client in separate terminals:

```bash
bun run dev:db
bun run dev:server
bun run dev:client
```

The API uses port `3000`. Expo uses port `8081` and connects to `EXPO_PUBLIC_API_URL`.

Create the client environment file before you start Expo:

```bash
cp packages/app/client/.env.example packages/app/client/.env
```

The example uses the deployed API. This lets a physical device connect without a local network address.

Install and start the iOS development build:

```bash
bun --filter=@tally/client run ios -- --device
bun run dev:client -- --dev-client
```

Install and start the Android development build:

```bash
bun --filter=@tally/client run android -- --device
bun run dev:client -- --dev-client
```

Open the installed Tally Tracker development build. Scan the Expo QR code if the app does not connect automatically.

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
bun run test:unit
bun run test:component
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
bun run test:integration
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
