# Run Spec: Run 1: Codify guest counter cap policy

## Assigned Workflow

`coding`

## Task

Add the guest-only three-counter policy to the client counter store so over-limit guest creates fail before any local mutation or persistence.

## Current State

- `app/client/src/stores/counterStore.ts` keeps all counters in one `counters` array, and `createCounter()` always builds a new counter, pushes it into local state, and persists it immediately.
- Guest/local persistence flows through `CounterService.persist(counters.value)` into `LocalStorageService.saveCounters(...)`, so any store mutation is written to Preferences right away.
- The store has no centralized helper or constant for counting eligible guest counters; `SHARED` counters are only treated specially for invite-code generation and increment behavior.
- `app/client/src/components/counter/CounterForm.vue` awaits `createCounter()` but ignores the returned `StoreResponse` and emits `done` unconditionally, so this run must stay store-only and leave blocked-create UX handling to Run 2.
- Client unit coverage currently targets API and sync services; there is no counter-store spec covering guest create limits or shared-counter exclusion.

## Goal (Run Outcome)

Guest sessions can create up to three eligible counters, and any further eligible guest create attempt returns a normal failed `StoreResponse` before new counter construction, local array mutation, local persistence, or remote sync scheduling. The eligibility rule, cap threshold, and `eligibleCount` derived state are centralized in one store module and exported for UI enforcement in later runs. Authenticated create behavior remains unchanged.

## Scope

- `app/client/src/stores/counterStore.ts`, including the guest-cap threshold, the eligible-counter rule, the exported `eligibleCount` computed (so later UI work can gate the `Add counter` entry point without duplicating the filter logic), and the minimal exported constants needed to identify the guest-limit failure.
- One focused client unit spec at `app/client/src/stores/__tests__/counterStore.spec.ts`.
- Test-only mocks or fixture reuse needed to cover guest and authenticated create flows without involving views, routing, or live Capacitor storage.

## Out of Scope

- `app/client/src/components/counter/CounterForm.vue`, `app/client/src/views/HomeView.vue`, modal components, routes, and navigation.
- Hiding or disabling the `Add counter` entry point.
- Server-side enforcement, billing or upgrade behavior, account tier changes, or guest-to-account consolidation changes.
- Refactoring unrelated storage/service layers or introducing a new persistence path for counter creation.

## Contracts

- The cap applies only while `authStore.isAuthenticated` is `false`.
- An eligible counter is any entry currently visible in `counterStore.counters` whose `type !== 'SHARED'`.
- Shared counters never consume the guest cap, even when they are present in the same guest session state.
- The threshold is three eligible counters. Guest eligible creates succeed at eligible counts `0`, `1`, and `2`, and fail at eligible counts `3+`.
- The blocked path must return `fail(...)` via the existing `StoreResponse` contract, not throw.
- The guest-limit path must use a deterministic failure message/constant so later UI work can identify it from the `StoreResponse` if the store guard is ever reached as defense-in-depth.
- `eligibleCount` is exported from the store so UI layers can gate the `Add counter` entry point without re-implementing the eligibility filter.
- A blocked guest create must not change `counterStore.counters`, call `saveState()` / `CounterService.persist()`, or schedule remote work.
- Authenticated `createCounter()` behavior remains unchanged.

## Implementation Plan

1. In `app/client/src/stores/counterStore.ts`, add a single guest-cap constant (`3`), a helper or predicate for the eligible-counter rule (`type !== 'SHARED'`), and a deterministic guest-limit failure message constant near the top of the module. Keep this logic in the store module instead of introducing a new shared abstraction.
2. Derive the current eligible guest count from `counters.value` using that helper. Keep the derivation next to `createCounter()` so later runs reuse the same rule instead of duplicating filter logic.
3. Add an early guard at the top of `createCounter()` that only triggers when the session is guest, the requested `type` is eligible, and the current eligible count is already at or above the cap. Return the failed `StoreResponse` before constructing the new `ClientCounter`, pushing to `counters.value`, calling `saveState()`, or invoking `CounterService.create()`.
4. Leave the rest of `createCounter()` unchanged for successful guest creates, guest shared creates, and authenticated creates so this run only changes the cap-enforcement path.
5. Add `app/client/src/stores/__tests__/counterStore.spec.ts` using Vitest plus a real Pinia instance for the counter store.
6. In that spec, mock `@/services/counter.service` and `@/stores/authStore` with a simple mutable auth stub exposing `isAuthenticated` and `user` so tests can switch between guest and authenticated modes without pulling in router or auth side effects.
7. Cover three successful guest personal creates, then a blocked fourth guest personal create that leaves `counters` and `CounterService.persist` unchanged.
8. Cover shared counters being ignored by the cap calculation, and cover authenticated create behavior still appending, persisting, and queueing remote sync.

## Verification Commands

- `bun run format:check`
- `bun --filter=client run lint`
- `bun --filter=client run typecheck`
- `bun --filter=client run test:unit`

## Smoke Verification

- Mode: `headless`
- Method: `bun --filter=client run test:unit -- src/stores/__tests__/counterStore.spec.ts`
- Manual instructions, if needed: `N/A`

## Completion Gate

- TDD implementation is complete within scope.
- `counterStore.createCounter()` enforces the guest cap before local mutation or persistence using the centralized eligible-counter rule.
- The guest-limit path returns the standard failed `StoreResponse`, and later UI work can identify it from the deterministic limit message/constant.
- Code review is clear or all findings have been resolved.
- Verification commands pass.
- Smoke verification passes, or HITL confirms manual smoke instructions were completed.
- No out-of-scope UI, modal, routing, or backend changes were introduced.
- Run is ready to become one commit on the initiative branch.
