# Counter Limit for Non-Premium Accounts — Requirements Understanding (v2)

## 1. Initiative Summary

Enforce a maximum of 5 counters for non-premium accounts (`isPremium === false`), on both the client and the server. When a non-premium user attempts to create a 6th counter, a modal is displayed in place of the counter creation form, with a CTA that navigates to a boilerplate `UpgradeView`.

---

## 2. Functional Requirements

### Limit Enforcement

- Any account where `isPremium === false` is subject to a maximum of **5 counters**.
- Premium accounts (`isPremium === true`) are **not** subject to this limit.
- The limit applies to **authenticated, non-premium users** — it is no longer a guest/unauthenticated concern.

### Client-Side Enforcement

- In `HomeView`, when the user clicks the **"Add Counter"** button:
    - If the user is non-premium **and** already has **5 or more counters**, display the upgrade modal **instead of** the `CounterForm`.
    - If the user is non-premium and has **fewer than 5 counters**, proceed normally (show `CounterForm`).
    - If the user is premium, proceed normally regardless of counter count.
- The "Add Counter" button retains its **current visual appearance** — no badge, lock icon, or disabled state.

### Server-Side Enforcement

- The counter creation endpoint must enforce the same 5-counter limit as a server-side guard ("never trust the client").
- Before inserting a new counter, the server checks the authenticated user's current counter count.
- If the user is non-premium and already has **5 or more counters**, the server returns an appropriate error response (e.g., `403 Forbidden` or `422 Unprocessable Entity`) and does **not** create the counter.
- This check lives in `counter.controller.ts` — no new service layer is introduced.

### Schema / Prisma

- The `isPremium` field (or equivalent) must exist on the `User` model in the Prisma schema.
- Because the project is in active development with no live users, **migrations can be reset and reinitialized** — a single migration covering all current schema state is acceptable. No concern for destructive retroactive changes.

### Upgrade Modal

- The modal is triggered from `HomeView` when the counter limit is hit.
- Uses the **`ion-modal`** Ionic component.
- Modal content is **boilerplate** — copy, layout, and pricing details are not finalized. A placeholder UI is sufficient.
- The modal includes a **CTA button** that navigates the user to `/upgrade` (`UpgradeView.vue`).
- The modal can be dismissed (closed) without navigating away.

### UpgradeView

- A new **`UpgradeView.vue`** route/page is created as a placeholder.
- No real upgrade or payment logic is implemented at this stage.
- The view serves as a destination for the modal CTA so the navigation hook is in place for future implementation.

---

## 3. Non-Functional Requirements

### Performance

- The client-side check is a simple reactive comparison against the already-loaded `counters` array in `counterStore` — no additional network request is made before showing the modal.
- The server-side check should be a lightweight query (e.g., `COUNT` of counters for the user) and should not block the happy path for premium users.

### UX

- The modal appears **immediately** when the limit-breaching "Add Counter" action is taken — the `CounterForm` is never rendered in this case.
- The experience for users under the limit is **unchanged**.
- The "Add Counter" button appearance is **unchanged** — no preemptive visual indicator of the limit.

### Accessibility

- The `ion-modal` should follow Ionic's built-in accessibility conventions (focus trapping, ARIA roles).
- The CTA and dismiss controls must be keyboard-navigable.

---

## 4. Scope Boundaries

### In Scope

- Client-side limit check in `HomeView` before showing `CounterForm`
- `ion-modal` upgrade prompt (boilerplate content)
- New `UpgradeView.vue` page (boilerplate, no real upgrade logic)
- New `/upgrade` route wired into the router
- Server-side limit check in `counter.controller.ts`
- `isPremium` field on the `User` Prisma model (schema + migration reset/reinit if needed)
- `isPremium` exposed via `authStore` (already present per project context — confirm presence)

### Out of Scope

- Actual premium upgrade / payment flow
- Pricing UI, plan comparison, or feature gating beyond counter count
- Any limit enforcement for **premium** users
- Visual changes to the "Add Counter" button
- Changes to `SyncQueueService` or idempotency middleware behavior
- Any retroactive data migration for existing counters exceeding the limit (no live users)
- Push notifications or other alerts about approaching the limit

---

## 5. Confirmed Assumptions

| # | Assumption | Source |
| --- | --- | --- |
| A1 | "Guest" means `isPremium === false`, regardless of authentication state. The limit applies to all authenticated non-premium users. | User correction |
| A2 | Premium users (`isPremium === true`) have no counter limit enforced. | User correction |
| A3 | The project has no live users; migrations can be reset and rerun as a single cumulative migration. | User clarification |
| A4 | `isPremium` is (or will be) a field on the `User` model and is accessible in `authStore`. | Project context + user correction |
| A5 | The modal is triggered in `HomeView` on "Add Counter" click — the `CounterForm` is never shown when the limit is reached. | User clarification |
| A6 | The modal uses `ion-modal`. | User answer (Q4) |
| A7 | The modal CTA navigates to a new `UpgradeView.vue` at `/upgrade`. | User answer (Q3) |
| A8 | The "Add Counter" button has no visual change (no lock, badge, or disabled state). | User answer (Q5) |
| A9 | The server-side check is a simple guard in `counter.controller.ts` — no new service layer. | Project context (no server service layer) + user confirmation |
| A10 | The server should return a non-2xx error (e.g., `403` or `422`) when a non-premium user exceeds the limit via a direct API call. | User clarification (server enforcement requirement) |
