# Basic Tier Account Constraints - Initiative Spec Sheet

## Source of Truth Rules

- When initiative direction changes, update every affected active doc in the same pass.
- Any run specs created under `runs/active/` must match the run summaries in this spec.
- Remove or rewrite superseded text instead of appending contradictory follow-up notes.

## Target State

Authenticated BASIC users keep unlimited personal counter creation while tier-specific sharing limits are enforced authoritatively by the server and reflected in client join UX.

- BASIC users can create any number of `PERSONAL` counters.
- BASIC users cannot create `SHARED` counters through `POST /counters`, even if a client bypasses the existing disabled sharing toggle.
- BASIC users can have at most one currently accepted joined shared counter where they are a participant rather than the owner.
- PREMIUM users keep the existing ability to create shared counters and join shared counters without this BASIC limit.
- Guest/local counter caps are unchanged and out of scope for this initiative.

## Initiative-wide Contracts

- `UserTier.BASIC` is the free-authenticated/basic tier for this initiative; `UserTier.PREMIUM` remains unrestricted by these BASIC sharing limits.
- Server enforcement is authoritative. Client checks may improve UX, but they must not be the only enforcement path.
- Tier decisions for server enforcement must use the current persisted user tier, not a JWT-only tier value. Current access tokens are signed without `tier`, and tests that mock `req.user.tier` do not represent production auth state.
- BASIC shared-join usage counts only `CounterShare` records for the authenticated user with `status: ACCEPTED`. `REJECTED` and `PENDING` shares do not consume the one joined-shared-counter slot.
- Joining the same already-accepted shared counter remains idempotent and returns the existing success path instead of failing because the BASIC user already has one accepted share.
- Re-accepting a previously rejected share is allowed only when the BASIC user has zero other accepted joined shared counters.
- Owner self-join remains a `409 CONFLICT`; invalid invite codes remain `404 NOT_FOUND`; validation errors remain `422 UNPROCESSABLE_ENTITY`.
- BASIC tier-limit denials use `403 FORBIDDEN` with a user-facing response message that the client can surface directly.
- Existing shared-counter validation requiring an invite code for `type: SHARED` remains unchanged.
- Do not change Prisma generated files by hand. If Prisma schema generation becomes necessary, use the existing package scripts during the implementation run.

## Branch and PR Plan

- Target repo: `/Users/michaelgreen/Documents/Projects/cross-platform/tally-tracker`
- Base branch: `main`
- Initiative branch: `initiative/basic-tier-account-constraints`
- Branch creation rule: create the initiative branch from `main` only when implementation is ready to begin.
- Run commit rule: each clean completed run becomes one commit.
- PR rule: open a PR from the initiative branch to `main` after all runs and initiative gates are complete.

## Execution Plan

### Run 1: Server-authoritative BASIC sharing limits (`coding`)

- [ ] complete
- Run spec path: `.mawm/agents/initiatives/active/basic-tier-account-constraints/runs/active/server-basic-sharing-limits/spec.md` (created by the assigned workflow when this run starts)
- Task: Add server-side enforcement and tests for BASIC tier shared-counter creation and joined-shared-counter limits.
- Current state: `app/server/src/api/controllers/counter.controller.ts` creates counters without checking the authenticated user's persisted tier. `app/server/src/api/schemas/counter.schema.ts` already requires an invite code for `type: SHARED`. `app/server/src/db/repositories/counter.repository.ts` can fetch shared counters by invite code and create/update `CounterShare` rows, but it has no helper to count accepted joined shares for a user. `app/server/src/db/repositories/user.repository.ts` can fetch users with `tier`, but `jwt.sign` in `app/server/src/api/controllers/user.controller.ts` signs access tokens without tier, so production controllers cannot rely on `req.user.tier`.
- Outcome: BASIC users receive `403 FORBIDDEN` when creating a shared counter or when attempting to accept a second joined shared counter; BASIC users can still create personal counters; PREMIUM users keep existing shared creation and join behavior.
- Scope: Update server controller/repository logic and server tests only. Likely touched areas are `counter.controller.ts`, `counter.repository.ts`, `user.repository.ts` if a narrower tier lookup is useful, `app/server/src/tests/integration/specs/counters.test.ts`, `app/server/src/tests/integration/specs/sharing.test.ts`, and related fixtures/mocks. Do not change client behavior in this run.
- Contracts: Persisted tier lookup happens before tier-limit decisions; accepted-share count is checked after invalid invite, owner self-join, and already-accepted same-share idempotency checks; create/update of share rows is unchanged for allowed joins; BASIC personal counter creation does not query or enforce any personal counter cap; PREMIUM tests cover that existing shared behaviors remain allowed.
- Smoke verification: `headless` - run server-focused verification after implementation, including `bun --filter=server run test`, `bun --filter=server run typecheck`, `bun --filter=server run lint`, and `bun --filter=server run format:check`.

### Run 2: Client BASIC shared-join UX guard (`coding`)

- [ ] complete
- Run spec path: `.mawm/agents/initiatives/active/basic-tier-account-constraints/runs/active/client-basic-join-ux/spec.md` (created by the assigned workflow when this run starts)
- Task: Reflect the BASIC one-joined-shared-counter rule in client state and join feedback while preserving server authority.
- Current state: `app/client/src/components/counter/CounterForm.vue` already disables shared-counter creation for non-premium users using `authStore.isPremium`. `app/client/src/stores/counterStore.ts` has guest personal-counter cap logic and a `joinCounter(inviteCode)` path, but no BASIC joined-shared-counter count or preflight guard. `app/client/src/views/JoinView.vue` surfaces `joinCounter` failures through an alert and then routes home.
- Outcome: When local client state proves a BASIC authenticated user already has one joined shared counter, the join flow returns a clear failure before making an unnecessary join request; otherwise it still calls the server and surfaces server denial messages. Existing shared-create client UI remains unchanged.
- Scope: Update client store/view behavior and client unit tests only. Likely touched areas are `app/client/src/stores/authStore.ts` only if a reusable BASIC-tier computed value is needed, `app/client/src/stores/counterStore.ts`, `app/client/src/stores/__tests__/counterStore.spec.ts`, and possibly `app/client/src/views/JoinView.vue` if the alert message needs clearer mapping. Do not add premium purchase or upgrade flows in this run.
- Contracts: Client-side joined-shared count treats counters with `type === 'SHARED'` and `counter.userId !== authStore.user?.id` as joined counters; owned shared counters do not consume the BASIC join slot; unauthenticated users and PREMIUM users are not blocked by the BASIC join guard; stale or missing local state must fall through to the server rather than claiming success; server error messages remain displayable to the user.
- Smoke verification: `headless` - run client-focused verification after implementation, including `bun --filter=client run test:unit`, `bun --filter=client run typecheck`, `bun --filter=client run lint`, and `bun --filter=client run format:check`.

## Initiative Verification Gates

- Every run is complete, verified, reviewed, smoke-tested, and committed.
- Server tests prove BASIC shared creation is forbidden, BASIC personal creation remains allowed, BASIC second joined shared counter is forbidden, already-joined same shared counter remains idempotent, rejected shares do not count unless re-accepted, and PREMIUM shared behavior remains allowed.
- Client tests prove BASIC join preflight only blocks known second joined shared counters and does not block PREMIUM users, unauthenticated users, or BASIC users with zero joined shared counters.
- Root verification passes after the final run: `bun run test:unit`, `bun run typecheck`, `bun run lint`, and `bun run format:check`.
- Initiative-wide contracts still match the current codebase after the final run.
- PR from `initiative/basic-tier-account-constraints` to `main` is opened with the initiative summary and verification evidence.
