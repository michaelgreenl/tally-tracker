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

The iOS app includes interactive Home Screen widgets and read-only Lock Screen counters.

## Architecture & Key Features

The [diagrams](docs/diagrams) show the data model, the client and server layers, and the main sync, auth, and sharing flows.

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

Requirements: Bun 1.3, Node.js 22.12 or later, and Docker.

Install dependencies and copy the environment templates:

```bash
bun install
cp packages/app/server/.env.example packages/app/server/.env.development
cp packages/app/client/.env.example packages/app/client/.env
```

Start PostgreSQL, generate the Prisma client, and apply the migrations:

```bash
bun run dev:db
bun --filter=@tally/core run generate:client
POSTGRES_URL=postgresql://template_user:template_pass@localhost:5432/template_db bun --filter=@tally/core run migrate:deploy
```

Start the API and the client in separate terminals:

```bash
bun run dev:server
bun run dev:client
```

The API uses port `3000`. Open the web app at `http://localhost:8081`. Without `RESEND_API_KEY`, the API writes email verification and password reset codes to its log.

Stop the database with `bun run dev:db:stop`.

## Checks

```bash
bun run typecheck
bun run lint
bun run format:check
bun run test:unit
bun run test:component
bun run build
```

The test lanes are:

- `test:unit`: client and server tests that isolate their subject.
- `test:component`: server HTTP route tests with mocked application collaborators.
- `test:integration`: real Express routes, repositories, transactions, and PostgreSQL. See [PostgreSQL integration tests](packages/app/server/tests/integration/README.md) for the test database setup.
- `test:e2e`: Cypress flows in Chrome through the running client and server. Start the API and the client first.
