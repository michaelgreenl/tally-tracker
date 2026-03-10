# High-Level Plan Revisions — high-level-0002

> Reviewer verdict: **REJECT** Two concrete implementation gaps must be addressed before this plan is ready for detailed implementation planning.

---

## Issue 1 — Test infrastructure mock strategy is unspecified (Milestones 2 & 4)

### Problem

The plan instructs implementers to add tests to `counters.spec.ts` but gives no guidance on the three mock-structure changes that the new controller guard makes mandatory. An implementer following only the plan will produce tests that either fail to compile or produce incorrect results.

The context.md (Section 12) explicitly identifies all three gaps:

**Gap A — `user.repository` is not mocked in `counters.spec.ts`**

The current file has no `vi.mock` for `user.repository`. Once the guard calls `userRepository.getUserById()`, any test that hits the `post` handler will attempt a real Prisma call unless a mock is added. The plan must specify:

- A `vi.mock('../../../db/repositories/user.repository', ...)` block must be added to `counters.spec.ts`.
- The mock must export at minimum `{ getUserById: vi.fn() }`.
- In the existing five `POST /counters` tests (which use a `PREMIUM` auth mock), `getUserById` is never called (premium users skip the guard) — but the mock must still be present to prevent import resolution errors.

**Gap B — `countAccessibleByUser` must be added to the existing `counter.repository` mock**

The current `vi.mock` for `counter.repository` enumerates every exported function. When `countAccessibleByUser` is added to the real repository, it must also be added to the mock object:

```ts
vi.mock('../../../db/repositories/counter.repository', () => ({
    // ... existing functions ...
    countAccessibleByUser: vi.fn(),
}));
```

Without this, `import * as counterRepository from '...'` in the controller will resolve `countAccessibleByUser` as `undefined`, and calling it will throw.

**Gap C — Auth mock strategy for BASIC-tier limit tests**

The top-level `vi.mock('../../../middleware/auth.middleware', ...)` in `counters.spec.ts` hardcodes `req.user = { ..., tier: 'PREMIUM' }`. Tests for limit enforcement require a `BASIC`-tier user. The plan must prescribe one of these two approaches:

- **Preferred:** Add a new `describe('POST /counters — limit enforcement', ...)` block that uses `vi.mocked(jwt).mockImplementation(...)` (or equivalent Vitest per-test mock override) to set `tier: 'BASIC'` for the auth middleware mock within that block only.
- **Alternative:** Convert the top-level auth mock to a `vi.fn()` and use `beforeEach` to configure it per-describe-block.

The plan must choose one approach and specify it explicitly so the implementer does not make an undocumented structural decision.

### Sections to Revise

- **Milestone 2 → "Files Touched"**: Add a note that `counters.spec.ts` requires `vi.mock` additions for both `user.repository` and `countAccessibleByUser` in the `counter.repository` mock.
- **Milestone 4 → test scenarios table**: Add a subsection titled "Test Infrastructure Requirements" that specifies all three mock changes (Gaps A, B, C above) with the chosen strategy for the auth mock.

### What the Correct Approach Looks Like

```
Milestone 4 — Test Infrastructure Requirements

Before writing new test cases, the following mock setup changes are required in
`counters.spec.ts`:

1. Add `vi.mock('../../../db/repositories/user.repository', () => ({ getUserById: vi.fn() }))`.
2. Add `countAccessibleByUser: vi.fn()` to the existing `counter.repository` mock.
3. For BASIC-tier limit tests: add a new describe block that overrides the auth
   middleware mock via `vi.mocked(jwt).mockImplementation(...)` to set
   `tier: 'BASIC'`. Use `buildUser({ tier: 'BASIC' })` from `user.fixture.ts`
   as the `getUserById` mock return value in those tests.
```

---

## Issue 2 — `getUserById` null return is unhandled in controller guard pseudocode (Milestone 2)

### Problem

`userRepository.getUserById()` returns `Promise<{ id, email, phone, tier, ... } | null>`. The plan's controller guard logic (Milestone 2 → "Controller Guard Logic") reads:

> 1. Query user tier via `userRepository.getUserById(userId)` (already returns `tier`)
> 2. If `tier !== 'PREMIUM'`: query `counterRepository.countAccessibleByUser(userId)`

This pseudocode destructures or reads `.tier` directly off the result without checking for `null` first. If the user row is not found (e.g., deleted between JWT issuance and request), the guard will throw a `TypeError: Cannot read properties of null (reading 'tier')`, which will bubble as a 500 and obscure the real problem.

This is not a theoretical edge case — the existing `post` handler already guards against `!userId` but does not guard against a missing user record. The new guard introduces the first DB call that can return `null` in this handler.

### Section to Revise

**Milestone 2 → "Controller Guard Logic"**: Update the numbered steps to include a null-check after `getUserById`:

```
1. Query user via `userRepository.getUserById(userId)`.
2. If `user` is null: return 404 with `{ success: false, message: 'User not found' }`.
   (This is a defensive guard — in practice, JWT validation ensures the user exists,
    but the DB is the source of truth.)
3. If `user.tier !== 'PREMIUM'`: query `counterRepository.countAccessibleByUser(userId)`.
4. If count >= MAX_FREE_COUNTERS: return 403 with `{ success: false, message: '...' }`.
5. Otherwise: proceed to `counterRepository.post()`.
```

The integration test suite must also include a test case for this null scenario (mock `getUserById` to return `null`, assert 404 response).

---

## Summary of Required Changes

| # | Section | Change Required |
| --- | --- | --- |
| 1A | Milestone 2 → Files Touched | Note that `counters.spec.ts` requires two new mock entries (`user.repository` and `countAccessibleByUser`) |
| 1B | Milestone 4 → new subsection | Add "Test Infrastructure Requirements" specifying all three mock changes and the chosen BASIC-tier auth mock strategy |
| 2 | Milestone 2 → Controller Guard Logic | Add null-check step after `getUserById` call; specify 404 response for null user |

No architecture decisions, no milestone ordering, no scope changes, and no other sections require revision. The core "all accessible counters" logic (AD-4), the `countAccessibleByUser` OR clause, the client-side `counterStore.counters.length` approach, and all other codebase-alignment facts are correct and confirmed by context.md.
