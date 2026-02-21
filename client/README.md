# Tally Tracker (Client)

**[Server Repository](https://github.com/michaelgreenl/tally-tracker-server)** 

> **Current Status:** 🚧  WIP

A cross-platform, offline-first counter application built to handle complex synchronization scenarios and real-time collaboration. This project demonstrates a robust implementation of local-first architecture using Vue 3 and Capacitor.

## 🏗️ Architecture & Key Features

### 🔌 Offline-First Sync Engine
Unlike standard apps that fail without a network, Tally Tracker treats the local database as the single source of truth for the UI.
*   **Optimistic UI:** UI updates immediately using local state logic before network confirmation.
*   **Custom Sync Queue:** Mutation commands (`CREATE`, `UPDATE`, `INCREMENT`) are persisted to a local queue and processed sequentially by a `SyncManager` when the network reconnects.
*   **Conflict Resolution:** Handles server rejections and rollbacks gracefully.

### 🤝 Real-Time Collaboration
*   **Shared State:** Users can share counters via secure "Magic Links."
*   **Live Updates:** Integrates **Socket.io** to broadcast increments to all active participants instantly.
*   **Native Deep Linking:** Uses Custom URL Schemes (`tally://`) to handle app navigation directly from share links on Android/iOS.

### 📱 Cross-Platform Logic
*   **Hybrid Auth Strategy:** Automatically switches between `HttpOnly` Cookies (Web) and Bearer Headers (Native Mobile) based on the runtime environment.
*   **Native Integration:** Built with **Ionic & Capacitor** to access native storage, haptics, and network status listeners.

## 🛠️ Tech Stack
*   **Framework:** Vue 3, Ionic 8, Vite
*   **State Management:** Pinia
*   **Language:** TypeScript
*   **Native Bridge:** Capacitor (iOS & Android)
