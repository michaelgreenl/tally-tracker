# Run Spec

## Assigned Workflow

`coding`

## Task

Add server-authoritative BASIC-tier enforcement for shared counter creation and joined shared-counter limits, with server-side test coverage.

## Current State

- `app/server/src/api/controllers/counter.controller.ts` `post` creates counters directly through `counterRepository.post(...)` and does not check the authenticated user's persisted tier before allowing `type: 'SHARED'`.
- `app/server/src/api/controllers/counter.controller.ts` `join` validates `inviteCode`, rejects owner self-join, preserves same-counter idempotency for already accepted shares, and then creates or updates `CounterShare` rows without any BASIC-tier limit check.
- `app/server/src/db/repositories/counter.repository.ts` exposes `join`, `createShare`, and `updateShare`, but it has no helper that counts a user's accepted joined shares.
- `app/server/src/db/repositories/user.repository.ts` can already read `tier` through `getUserById`, but there is no narrow persisted-tier helper dedicated to server enforcement in counter flows.
- `app/server/src/api/controllers/user.controller.ts` signs access tokens with `id`, `email`, and `phone` only, so production controllers cannot rely on `req.user.tier` even though some mocked tests currently provide it.
- `app/server/src/api/schemas/counter.schema.ts` already keeps the existing `422` validation that requires an invite code for `type: 'SHARED'`.
- `app/server/src/tests/integration/specs/counters.test.ts` and `app/server/src/tests/integration/specs/sharing.test.ts` cover current create/join behavior, but they do not cover BASIC-tier `403` denials, persisted-tier lookup, or accepted-share counting.

## Goal

The server enforces the initiative rules without relying on client checks or JWT tier claims: BASIC users can still create unlimited personal counters, BASIC users cannot create shared counters, BASIC users cannot accept a second distinct shared counter, and PREMIUM users keep the current shared-counter create/join behavior.

## Scope

- Update `app/server/src/api/controllers/counter.controller.ts`.
- Add the minimal repository helpers needed in `app/server/src/db/repositories/user.repository.ts` and `app/server/src/db/repositories/counter.repository.ts`.
- Update `app/server/src/tests/integration/specs/counters.test.ts`.
- Update `app/server/src/tests/integration/specs/sharing.test.ts`.
- Make only the fixture or mock changes needed to support those server tests.

## Out Of Scope

- Client-side join UX, client state guards, or any client file changes.
- Guest/local counter caps and any unauthenticated counter limits.
- JWT payload changes, auth middleware changes, or any attempt to make `req.user.tier` authoritative.
- Prisma schema changes or manual edits to generated Prisma or Zod files.
- Upgrade flows, pricing UI, or premium upsell messaging.
- Transactional or schema-level hardening for simultaneous join races.

## Contracts

- Add `userRepository.getUserTierById(userId)` and make `counter.controller.ts` use that persisted lookup for every BASIC-tier decision in this run.
- `POST /counters` only performs the tier lookup when `req.body.type === 'SHARED'`; personal counter creation remains uncapped and does not add a new personal-limit code path.
- If `getUserTierById(userId)` returns `null` during a tier-gated create or join request, return `404 NOT_FOUND` with `User not found` and stop the operation.
- BASIC shared-counter creation is denied with `403 FORBIDDEN` and the message `Basic accounts cannot create shared counters.`.
- Add `counterRepository.countAcceptedJoinedSharesByUserId(userId)` implemented as a `counterShare.count` over `{ userId, status: 'ACCEPTED' }`.
- BASIC joined-share usage counts only `CounterShare` rows with `status: 'ACCEPTED'`; `PENDING` and `REJECTED` rows do not consume the slot.
- `POST /counters/join` keeps its existing decision order: invalid invite `404`, owner self-join `409`, same accepted share idempotent `200`, then persisted-tier lookup, then BASIC accepted-share counting, then share create or share update for allowed joins.
- Joining the same already accepted shared counter remains idempotent and must not fail because the user already has one accepted share.
- Re-accepting a previously rejected share is allowed only when the BASIC user has zero other accepted joined shares.
- BASIC second joined-share denials return `403 FORBIDDEN` with the message `Basic accounts can only join one shared counter.`.
- PREMIUM users remain allowed to create shared counters and join shared counters without the BASIC cap.
- Existing `422` validation for missing shared invite codes and existing `404` and `409` join semantics remain unchanged.

## Implementation Plan

1. Add `getUserTierById(userId)` to `app/server/src/db/repositories/user.repository.ts` using a Prisma `findUnique` that selects only `id` and `tier`.
2. Add `countAcceptedJoinedSharesByUserId(userId)` to `app/server/src/db/repositories/counter.repository.ts` using `prisma.counterShare.count` and leave the existing `join`, `createShare`, and `updateShare` helpers unchanged.
3. Update `app/server/src/api/controllers/counter.controller.ts` `post` to import `FORBIDDEN` and `userRepository`, look up the persisted tier only for `type: 'SHARED'`, return `404 User not found` when the user record is missing, return `403 Basic accounts cannot create shared counters.` for BASIC users, and otherwise preserve the current success path.
4. Update `app/server/src/api/controllers/counter.controller.ts` `join` to keep the current invalid-invite, owner-self-join, and already-joined checks ahead of any limit logic, then load the persisted tier, then call `countAcceptedJoinedSharesByUserId(userId)` only for BASIC users, and return `403 Basic accounts can only join one shared counter.` before `createShare` or `updateShare` when the BASIC user already has an accepted joined share.
5. Update `app/server/src/tests/integration/specs/counters.test.ts` to mock `user.repository`, keep the existing schema validation coverage, and add cases for BASIC personal create success, BASIC shared create `403` denial, PREMIUM shared create success, and missing persisted user `404` on shared create. Test expectations must be driven by `getUserTierById`, not by treating `req.user.tier` as authoritative.
6. Update `app/server/src/tests/integration/specs/sharing.test.ts` to mock `user.repository` and `countAcceptedJoinedSharesByUserId`, then cover invalid invite `404` without tier lookup, owner self-join `409` without tier lookup, same accepted share idempotent `200` without tier lookup, BASIC first join success with zero accepted shares, BASIC second distinct join `403`, BASIC rejected-share reaccept success when the accepted-share count is zero, BASIC rejected-share reaccept `403` when another accepted share exists, and PREMIUM join success where the same count would block BASIC. Test expectations must prove the controller does not rely on `req.user.tier` for production enforcement.

## Verification Commands

- `bun --filter=server run test src/tests/integration/specs/counters.test.ts`
- `bun --filter=server run test src/tests/integration/specs/sharing.test.ts`
- `bun --filter=server run test`
- `bun --filter=server run typecheck`
- `bun --filter=server run lint`
- `bun --filter=server run format:check`

## Smoke Verification

- Mode: `headless`
- `bun --filter=server run test`
- `bun --filter=server run typecheck`
- `bun --filter=server run lint`
- `bun --filter=server run format:check`

## Completion Gate

- `POST /counters` returns `403 FORBIDDEN` with `Basic accounts cannot create shared counters.` for BASIC shared-create attempts and still allows BASIC personal counter creation.
- `POST /counters/join` returns `403 FORBIDDEN` with `Basic accounts can only join one shared counter.` only when a BASIC user is attempting to accept a second distinct shared counter.
- Invalid invite codes, owner self-join conflicts, already-joined same-counter idempotency, and shared invite-code validation keep their current status codes and success/error shapes.
- PREMIUM shared create and join behavior still succeeds.
- Controller enforcement uses persisted tier lookup and accepted-share counting instead of JWT tier claims.
- No client files, auth token payloads, or Prisma-generated files are changed.
- All commands in `Verification Commands` pass during the implementation run.
