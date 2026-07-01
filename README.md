# Tally Tracker
> A cross-platform offline-first application utilizing a custom synchronization queue for network resilience, featuring real-time shared counters and native deep linking integration.

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=fff)](https://www.typescriptlang.org/docs/)
[![Ionic](https://img.shields.io/badge/Ionic-3880FF?style=for-the-badge&logo=ionic&logoColor=fff)](https://ionicframework.com/docs)
[![Vue.js](https://img.shields.io/badge/Vue.js-35495E?style=for-the-badge&logo=vuedotjs&logoColor=4FC08D)](https://vuejs.org/) 
[![Node](https://img.shields.io/badge/Node-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/) 
[![Socket.io](https://img.shields.io/badge/Socket.io-black?style=for-the-badge&logo=socket.io&badgeColor=010101)](https://socket.io/) 
[![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)](https://www.prisma.io/) 
## Links
- **🎥 [Demo Video](https://michaelgreenl.net/#projects?slug=tally&autoplay=true)**
- **💼 [Portfolio Link](https://michaelgreenl.net/#projects?slug=tally&autoplay=false)** 

## Overview

Tally Tracker is a Vue/Ionic counter app with guest counters, authenticated counters, shared counters, and an Express API. Guest counters are stored on-device with Capacitor Preferences; authenticated counters sync to PostgreSQL through Prisma.

The client writes counter changes to Pinia state first, persists local state, and queues authenticated mutations for replay when the network returns. Shared counter increments use Socket.io to push `counter-update` events to the owner and accepted sharers.

The API supports email/password registration, login, logout, auth checks, refresh token rotation, personal counters, shared counters, invite-code joins, and share removal. `BASIC` users cannot create shared counters and can join one shared counter; `PREMIUM` users can create and join shared counters. The upgrade screen is informational only; billing is not implemented.

## Architecture & Key Features

### Client Side

#### Offline Counter State

- **Local persistence:** Guest and authenticated counter lists are saved with Capacitor Preferences.
- **Optimistic updates:** Create, edit, increment/decrement, and delete operations update Pinia state before network confirmation.
- **Persistent sync queue:** Authenticated mutations are stored in `app_sync_queue` as `CREATE`, `UPDATE`, `SET_COUNT`, `INCREMENT`, `DELETE`, and `REMOVE` commands.
- **Network replay:** `SyncManager` processes queued commands in FIFO order when Capacitor Network reports connectivity.
- **Retry handling:** Network failures, 5xx responses, and expired sessions keep commands queued; non-401 4xx responses are removed to unblock later commands.

#### Cross-Platform Auth

- **Web auth:** Browser requests use HttpOnly `access_token` and `refresh_token` cookies.
- **Native auth:** iOS and Android requests read tokens from Capacitor Preferences and attach Bearer headers.
- **Refresh flow:** `apiFetch` deduplicates concurrent refresh attempts and retries the original request after a successful refresh.
- **Deep links:** Capacitor `appUrlOpen` events route join links to `/join?code=...`.

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
- **Duplicate protection:** Counter routes accept `X-Idempotency-Key`; duplicate keys return `204` before the mutation runs again.
- **Cleanup jobs:** Server startup begins cleanup for expired refresh tokens and old idempotency logs.

## Tech Stack

**Client:**

- **Framework:** Vue 3, Ionic 8, Vite
- **State Management:** Pinia
- **Language:** TypeScript
- **Native Bridge:** Capacitor for iOS and Android
- **Realtime:** Socket.io client
- **Testing:** Vitest, Vue Test Utils, Cypress

**Server:**

- **Runtime:** Node.js, Express 5
- **Database:** PostgreSQL, Prisma ORM
- **Realtime:** Socket.io
- **Language:** TypeScript
- **Validation:** Zod
- **Testing:** Vitest, Supertest

**Workspace:**

- **Package Manager:** Bun workspaces
- **Shared Packages:** `@tally/core`, `@tally/utils`

## Running Locally

Install dependencies:

```bash
bun install
```

Start the API and client in separate terminals:

```bash
bun run dev:server
bun run dev:client
```

The API defaults to port `3000`. The Vite client runs on port `8100` and proxies `/users`, `/counters`, and `/health` to `VITE_API_URL` or `http://localhost:3000`.

Build both workspaces:

```bash
bun run build
```

Run checks:

```bash
bun run typecheck
bun run lint
bun run format:check
bun run test:unit
```

Cypress e2e tests use `http://localhost:8100`:

```bash
bun run test:e2e
```
