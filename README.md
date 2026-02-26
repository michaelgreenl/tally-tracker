# Tally Tracker

> **Current Status:** 🚧 WIP

A cross-platform, offline-first counter application built to handle complex synchronization scenarios and real-time collaboration. This project demonstrates a robust implementation of local-first architecture using Vue 3 and Capacitor. The server side infrastructure is designed to handle eventually consistent data synchronization and real-time event broadcasting. Deployed on Render with a PostgreSQL database.

## 🏗️ Architecture & Key Features

### Client Side

#### 🔌 Offline-First Sync Engine

Unlike standard apps that fail without a network, Tally Tracker treats the local database as the single source of truth for the UI.

- **Optimistic UI:** UI updates immediately using local state logic before network confirmation.
- **Custom Sync Queue:** Mutation commands (`CREATE`, `UPDATE`, `INCREMENT`) are persisted to a local queue and processed sequentially by a `SyncManager` when the network reconnects.
- **Conflict Resolution:** Handles server rejections and rollbacks gracefully.

#### 📱 Cross-Platform Logic

- **Hybrid Auth Strategy:** Automatically switches between `HttpOnly` Cookies (Web) and Bearer Headers (Native Mobile) based on the runtime environment.
- **Native Integration:** Built with **Ionic & Capacitor** to access native storage, haptics, and network status listeners.

### Server Side

#### 🛡️ Security & Idempotency

- **Idempotency Repository:** Implements a dedicated layer to track unique request keys, ensuring that offline clients retrying operations (like `INCREMENT`) do not result in double-counting when connection is spotty.
- **Role-Based Access Control:** Granular permission logic allows Owners to delete counters, while Shared Users can only increment/edit based on an `ACCEPTED` share status.

#### ⚡ Real-Time Infrastructure

- **Event Broadcasting:** Wraps the Express server with **Socket.io** to emit `counter-update` events specifically to rooms keyed by User IDs.
- **Smart Notifications:** Uses repository-level helpers (`getParticipants`) to ensure updates are only broadcast to relevant users, minimizing bandwidth.

#### 💾 Data Layer

- **Prisma ORM:** Manages complex Many-to-Many relationships via a `CounterShare` join table.
- **Robust Querying:** Repository pattern isolates database logic from controllers, ensuring consistent `WHERE` clauses for security (e.g., ensuring a user can't access a counter they effectively "left").

## 🛠️ Tech Stack

**Client:**

- **Framework:** Vue 3, Ionic 8, Vite
- **State Management:** Pinia
- **Language:** TypeScript
- **Native Bridge:** Capacitor (iOS & Android)

**Server:**

- **Runtime:** Node.js, Express
- **Database:** PostgreSQL, Prisma ORM
- **Real-time:** Socket.io
- **Language:** TypeScript
- **Validation:** Zod (Shared schemas with client)
