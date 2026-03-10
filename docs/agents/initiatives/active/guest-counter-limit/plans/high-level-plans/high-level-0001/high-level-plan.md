# High-Level Plan: Counter Limit for Non-Premium Accounts

## Architecture Decisions

### AD-1: Counter limit constant location

The magic number `5` will be defined as `MAX_FREE_COUNTERS = 5` in `packages/utils/src/constants/` alongside the existing status-code constants. Both client and server import from `@packages/utils`, so a single source of truth is natural.

### AD-2: Server error code for limit exceeded

The server will return **`403 Forbidden`** (using the existing `FORBIDDEN` constant from `@packages/utils`). Rationale: the request is authenticated but the user's tier does not authorize this action. `422` would imply a validation/schema issue, whereas this is a business-rule denial. The response body will follow the existing `{ success: false, message: '...' }` pattern.

### AD-3: JWT payload does NOT contain `tier`

The JWT is signed with `{ id, email, phone }` only (see `user.controller.ts` lines 113, 166). The server-side limit check must therefore **query the database** for the user's tier. This is the correct approach — "never trust the client" means we cannot rely on a JWT claim for authorization gating. The query will be a lightweight `prisma.user.findUnique` + `prisma.counter.count` pair, both indexed.

### AD-4: Client-side modal state management

The upgrade modal's `isOpen` state will be a local `ref<boolean>` in `HomeView.vue` — no Pinia involvement. The "Add Counter" button click handler will branch: if `!authStore.isPremium && counterStore.counters.length >= MAX_FREE_COUNTERS`, set the modal open; otherwise, show the `CounterForm` as today. This keeps the check as a simple reactive comparison with zero network requests.

### AD-5: UpgradeView is a standalone page, not a modal sub-route

`UpgradeView.vue` is registered at `/upgrade` in the router as a normal page. The modal CTA uses `router.push('/upgrade')` after dismissing the modal. No `requiresAuth` meta guard — the page is a boilerplate placeholder accessible to anyone.

---

## Milestone 1 — Shared Constant & Schema Validation

**Description:** Introduce the `MAX_FREE_COUNTERS` constant in the shared utils package so both client and server can import it, and verify the Prisma schema already supports the `tier` field (it does — `UserTier` enum with `PREMIUM`/`BASIC` already exists on the `User` model, and `authStore.isPremium` already computes from `user.tier`).

### Files Touched

- `packages/utils/src/constants/index.ts` — export new constant
- New file: `packages/utils/src/constants/limits.ts` — define `MAX_FREE_COUNTERS`

### Success Criteria

- `import { MAX_FREE_COUNTERS } from '@packages/utils'` resolves to `5` in both `app/client` and `app/server`
- No schema or migration changes needed (confirmed: `tier` field and `UserTier` enum already exist)
- Existing typecheck and tests pass with no regressions

### Risks / Considerations

- The generated Zod schemas in `packages/core` already include `UserTierSchema` — no regeneration needed.
- If `packages/utils` barrel export (`index.ts`) doesn't re-export the new file, the import will fail. Must verify the re-export chain.

---

## Milestone 2 — Server-Side Limit Enforcement

**Description:** Add a guard to the counter creation endpoint (`counter.controller.ts` → `post`) that rejects requests from non-premium users who already have ≥ 5 counters.

### Files Touched

- `app/server/src/api/controllers/counter.controller.ts` — add tier check + counter count query before `counterRepository.post()`
- `app/server/src/db/repositories/counter.repository.ts` — add a `countByUser(userId: string): Promise<number>` function (lightweight `prisma.counter.count`)
- `app/server/src/db/repositories/user.repository.ts` — may need a lightweight `getTierById(userId)` or reuse existing `getUserById` (already returns `tier`)
- `app/server/src/tests/integration/specs/counters.spec.ts` — add test cases for limit enforcement

### Success Criteria

- POST `/counters` returns `403` with `{ success: false, message: '...' }` when a `BASIC` user already has 5+ counters
- POST `/counters` succeeds normally for `PREMIUM` users regardless of count
- POST `/counters` succeeds normally for `BASIC` users with < 5 counters
- Existing counter CRUD integration tests still pass

### Risks / Considerations

- **Race condition:** Two simultaneous requests could both read "4 counters" and both succeed, resulting in 6. Acceptable for now (low-traffic app, no live users). If needed later, a Prisma transaction with a `count` + `create` inside a serializable isolation level would close the gap.
- **`req.user` only has `id`, not `tier`:** The controller must DB-query for the user's tier. This is one extra query on the creation path only — acceptable.
- **Owned counters only:** The count should use `prisma.counter.count({ where: { userId } })` — i.e., counters the user **owns**, not shared counters. Shared counters (via `CounterShare`) do not count against the limit.
- **Import extensions:** Server uses NodeNext resolution — all new imports must use `.js` extensions.

---

## Milestone 3 — Upgrade Modal & UpgradeView (Client)

**Description:** Add the `ion-modal` upgrade prompt in `HomeView.vue` and create the boilerplate `UpgradeView.vue` page with its `/upgrade` route.

### Files Touched

- `app/client/src/views/HomeView.vue` — add `ion-modal`, gate "Add Counter" click, import constant
- New file: `app/client/src/views/UpgradeView.vue` — boilerplate placeholder page
- `app/client/src/router/index.ts` — register `/upgrade` route

### Success Criteria

- Non-premium user with 5+ counters: clicking "Add Counter" opens the upgrade modal (not the `CounterForm`)
- Non-premium user with < 5 counters: clicking "Add Counter" opens the `CounterForm` as before
- Premium user: clicking "Add Counter" always opens the `CounterForm`, regardless of count
- Modal can be dismissed without navigation
- Modal CTA navigates to `/upgrade` and renders `UpgradeView`
- The "Add Counter" button appearance is unchanged
- No regressions for existing counter creation, update, or delete flows

### Risks / Considerations

- **`ion-modal` import:** Must be added to the Ionic component imports in `HomeView.vue`. Ionic Vue uses `IonModal`.
- **Counter count source:** `counterStore.counters` includes both owned and shared counters. The client-side check should ideally mirror the server (owned only). However, since the server is the authoritative guard, a simple `counterStore.counters.length` check is acceptable for the client-side UX gate. If precision is needed later, the store can expose an `ownedCounters` computed.
- **Modal dismiss handler:** Must reset modal state (`isOpen = false`) on `@didDismiss` to allow re-opening.

---

## Milestone 4 — Integration Verification & Edge Cases

**Description:** End-to-end verification that client and server agree on enforcement, including edge-case flows like guest-counter consolidation on login.

### Files Touched

- `app/server/src/tests/integration/specs/counters.spec.ts` — edge-case tests (premium user, exactly-at-limit, over-limit)
- `app/client/tests/e2e/` — add or extend Cypress specs for the modal flow (if E2E infra is in use)
- `app/client/tests/e2e/fixtures/user.fixture.ts` — may need a `PREMIUM` fixture variant

### Success Criteria

- Server rejects 6th counter creation for BASIC tier with 403
- Server allows counter creation for PREMIUM tier at any count
- Client modal appears at exactly 5 counters for BASIC users
- Client modal does NOT appear for PREMIUM users at any count
- Guest-to-auth consolidation (`consolidateGuestCounters`) that would push a BASIC user over 5 counters: server rejects the overflow during consolidation sync — the client gracefully handles the server error (counters beyond the limit remain local-only until upgrade)
- No regressions in existing tests

### Risks / Considerations

- **Consolidation overflow:** If a guest has 3 counters and logs into a BASIC account that already has 4, consolidation tries to sync 3 counters server-side. The server will accept counter #5 but reject #6 and #7. The `CounterService.consolidate` call should handle partial failure gracefully — this may need attention in the sync layer but is explicitly out-of-scope per the requirements. Document it as a known edge case.
- **Offline/optimistic creation:** The client's `createCounter` in `counterStore` pushes to the local array immediately, then syncs. If the server rejects with 403, the counter exists locally but not remotely. The sync queue will retry and keep failing. This is an existing pattern issue with the sync engine, not introduced by this feature — note it but don't fix it here.

---

## Dependency Graph

```
Milestone 1 (Shared Constant)
     │
     ├──▶ Milestone 2 (Server-Side Guard)
     │
     └──▶ Milestone 3 (Client Modal + UpgradeView)
                │
                ▼
          Milestone 4 (Integration Verification)
```

Milestones 2 and 3 can be worked **in parallel** after Milestone 1 is complete; they have no cross-dependency. Milestone 4 depends on both 2 and 3 being done.

---

## Summary of Files Changed (all milestones)

| File                                                      | Change Type             |
| --------------------------------------------------------- | ----------------------- |
| `packages/utils/src/constants/limits.ts`                  | **New**                 |
| `packages/utils/src/constants/index.ts`                   | Modified (re-export)    |
| `app/server/src/api/controllers/counter.controller.ts`    | Modified (add guard)    |
| `app/server/src/db/repositories/counter.repository.ts`    | Modified (add count fn) |
| `app/client/src/views/HomeView.vue`                       | Modified (modal + gate) |
| `app/client/src/views/UpgradeView.vue`                    | **New**                 |
| `app/client/src/router/index.ts`                          | Modified (add route)    |
| `app/server/src/tests/integration/specs/counters.spec.ts` | Modified (add tests)    |
| `app/client/tests/e2e/fixtures/user.fixture.ts`           | Modified (if needed)    |
