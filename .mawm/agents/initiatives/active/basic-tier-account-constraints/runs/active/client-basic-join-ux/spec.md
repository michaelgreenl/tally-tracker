# Run Spec

## Assigned Workflow

`coding`

## Task

Reflect the BASIC one-joined-shared-counter rule in client state and join feedback while preserving server authority.

## Current State

- `app/client/src/stores/counterStore.ts` tracks `counters`, guest-cap state, and `joinCounter(inviteCode)`, but the join path always calls `CounterService.join(inviteCode)` and never performs a BASIC-tier preflight from local counter state.
- `app/client/src/stores/counterStore.ts` persists whatever is currently in `counters.value` through `saveState()`. On a fresh invite-link visit with an empty in-memory store, a successful join would overwrite cached counters unless the join flow hydrates the local baseline first.
- `app/client/src/router/index.ts` can hydrate auth on navigation via `initializeAuth()`, but `app/client/src/views/HomeView.vue` is still the only place that calls `counterStore.init()`. Direct `/join?code=...` entry can therefore have authenticated BASIC user data loaded while `counterStore.counters` is still empty.
- `app/client/src/stores/authStore.ts` already exposes `user`, `isAuthenticated`, and `isPremium`, so the counter store can derive BASIC-vs-PREMIUM behavior from existing client state.
- `app/client/src/services/counter.service.ts` already exposes `getAllLocal()` and synchronous `join(inviteCode)` helpers, and `joinCounter()` already turns thrown join errors into the existing `{ success, message? }` store contract.
- `app/client/src/views/JoinView.vue` simply calls `counterStore.joinCounter(inviteCode)`, alerts success or `result.message`, and routes home; it has no separate tier logic and depends on the store to return user-facing failures.
- `app/client/src/api.ts` throws `ApiError` for non-OK responses but currently calls `authStore.logout(false)` before throwing, so ordinary join denials like `403` and `404` do not behave like in-session action failures.
- `app/client/src/stores/__tests__/counterStore.spec.ts` only covers guest-cap and create-counter behavior. There is no unit coverage for join preflight, direct-link cache hydration, server-denial passthrough, or successful join merge behavior.
- `app/client/src/__tests__/api.spec.ts` covers generic success/error throwing but does not verify the logout side effect on non-401 responses.

## Goal

The join flow gives BASIC users an immediate local denial only when cached client state already proves they hold a joined shared counter, preserves existing cached counters on direct invite-link visits, and otherwise defers to the server while surfacing server denial messages without logging the user out.

## Scope

- Update `app/client/src/stores/counterStore.ts`.
- Update `app/client/src/api.ts` only as needed so non-auth join denials stay in-session.
- Update `app/client/src/stores/__tests__/counterStore.spec.ts`.
- Update `app/client/src/__tests__/api.spec.ts` to cover any `api.ts` behavior change made in this run.

## Out Of Scope

- Server enforcement logic, server tests, or any change to the BASIC tier rule itself.
- Shared-counter creation UX in `app/client/src/components/counter/CounterForm.vue`.
- Auth-store or router redesigns beyond the minimal support needed for the join flow.
- JWT payload changes, new join-count endpoints, or remote preflight fetches.
- Premium upgrade flows, pricing UI, or upsell messaging.
- Cypress or other E2E test additions.

## Contracts

- Client preflight applies only when `authStore.user?.tier === 'BASIC'` and `authStore.user?.id` is available; PREMIUM and unauthenticated users always fall through to the existing server join request.
- A counter counts as a joined shared counter only when `counter.type === 'SHARED'` and `counter.userId !== authStore.user?.id`; owned shared counters and personal counters do not consume the BASIC join slot.
- The join guard may inspect persisted local counters through the existing local cache when `counters.value` is not yet hydrated, but it must not make an extra remote fetch or introduce a new count endpoint.
- If the flow loads persisted counters for the guard decision, it must use that same list as the in-memory baseline before any later `saveState()` call so a successful direct-link join does not truncate other cached counters.
- When inspected local state shows at least one joined shared counter, `joinCounter(inviteCode)` returns `fail('Basic accounts can only join one shared counter.')` without calling `CounterService.join(inviteCode)` and without leaving `loading` stuck `true`.
- Empty or stale local state is not authoritative. If the client cannot prove the cap locally, it must call the server and let server enforcement accept or deny the join.
- Successful joins still add the returned counter at most once, persist the merged counter list, and preserve the existing success path when the joined counter is already present locally.
- Server error messages remain user-displayable through the existing `{ success, message? }` store contract. Non-401 join failures must not trigger client logout; true auth failures continue to use the existing logout behavior.
- `JoinView.vue` remains a thin view that displays the store result and does not reimplement tier or counter-limit logic.

## Implementation Plan

1. Update `app/client/src/stores/counterStore.ts` to add a small helper that identifies joined shared counters from existing local counter data using `authStore.user?.id`, plus a guard message that exactly matches the server's BASIC join-limit denial text.
2. Refactor `joinCounter(inviteCode)` so it establishes a working local counter list before any join request: use `counters.value` when already hydrated, otherwise read the persisted cache through `CounterService.getAllLocal()`. When persisted counters are loaded this way, hydrate `counters.value` from that list before any success-path merge or `saveState()` call.
3. Apply the BASIC preflight only against that working local list. If the guard proves the user already has a joined shared counter, return the shared server message immediately and skip `CounterService.join(inviteCode)`; otherwise keep the existing synchronous server join path, duplicate suppression, and result contract.
4. Update `app/client/src/api.ts` so only post-refresh `401 UNAUTHORIZED` responses trigger `authStore.logout(false)`. Preserve the existing `ApiError` throwing behavior for all non-OK responses so join callers can surface `403` and `404` messages without session teardown.
5. Expand `app/client/src/stores/__tests__/counterStore.spec.ts` with join-focused coverage for: BASIC denial from hydrated in-memory counters; BASIC denial from persisted local counters when the store starts empty; owned shared counters not counting toward the cap; PREMIUM fallthrough; unauthenticated fallthrough; empty local state falling through to the server; successful join merge without duplicating an existing counter; and successful direct-link join preserving previously cached counters.
6. Expand `app/client/src/__tests__/api.spec.ts` to assert that non-401 responses still throw `ApiError` without calling logout, while a failed-refresh `401` still triggers logout.

## Verification Commands

- `bun --filter=client run test:unit src/stores/__tests__/counterStore.spec.ts`
- `bun --filter=client run test:unit src/__tests__/api.spec.ts`
- `bun --filter=client run test:unit`
- `bun --filter=client run typecheck`
- `bun --filter=client run lint`
- `bun --filter=client run format:check`

## Smoke Verification

- Mode: `headless`
- `bun --filter=client run test:unit`
- `bun --filter=client run typecheck`
- `bun --filter=client run lint`
- `bun --filter=client run format:check`

## Completion Gate

- An authenticated BASIC user with a locally known joined shared counter receives `Basic accounts can only join one shared counter.` without sending a join request.
- A direct `/join?code=...` visit that starts with an empty in-memory counter store but existing cached counters does not overwrite the cached counter list on success.
- PREMIUM users, unauthenticated users, and BASIC users with zero locally known joined shared counters still call the server.
- Server `403` and `404` join denials remain visible through `result.message` and do not log the user out; failed-auth `401` responses still do.
- Joined shared-counter detection ignores personal counters and owned shared counters.
- Existing shared-create toggle behavior and server-side BASIC enforcement remain unchanged.
- All commands in `Verification Commands` pass during the implementation run.
