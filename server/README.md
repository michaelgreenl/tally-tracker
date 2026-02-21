# Tally Tracker (API)

**[Client Repository](https://github.com/michaelgreenl/tally-tracker-client)** 

> **Current Status:** 🚧 WIP

The backend infrastructure for Tally Tracker, designed to handle eventually consistent data synchronization and real-time event broadcasting. Deployed on Render with a PostgreSQL database.

## 🏗️ Architecture & Key Features

### 🛡️ Security & Idempotency
*   **Idempotency Repository:** Implements a dedicated layer to track unique request keys, ensuring that offline clients retrying operations (like `INCREMENT`) do not result in double-counting when connection is spotty.
*   **Role-Based Access Control:** Granular permission logic allows Owners to delete counters, while Shared Users can only increment/edit based on an `ACCEPTED` share status.

### ⚡ Real-Time Infrastructure
*   **Event Broadcasting:** Wraps the Express server with **Socket.io** to emit `counter-update` events specifically to rooms keyed by User IDs.
*   **Smart Notifications:** Uses repository-level helpers (`getParticipants`) to ensure updates are only broadcast to relevant users, minimizing bandwidth.

### 💾 Data Layer
*   **Prisma ORM:** Manages complex Many-to-Many relationships via a `CounterShare` join table.
*   **Robust Querying:** Repository pattern isolates database logic from controllers, ensuring consistent `WHERE` clauses for security (e.g., ensuring a user can't access a counter they effectively "left").

## 🛠️ Tech Stack
*   **Runtime:** Node.js, Express
*   **Database:** PostgreSQL, Prisma ORM
*   **Real-time:** Socket.io
*   **Language:** TypeScript
*   **Validation:** Zod (Shared schemas with client)
