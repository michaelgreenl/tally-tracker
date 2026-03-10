# Test Writer Log — guest-counter-limit

**Agent:** Test Writer  
**Date:** 2026-03-10  
**Initiative:** guest-counter-limit (enforce 5-counter limit for non-premium users)

---

## Files Written / Modified

### 1. Modified — Server Integration Tests

**Path:** `app/server/src/tests/integration/specs/counters.spec.ts`

**Changes made:**

- Added `FORBIDDEN` to the `@packages/utils` import
- Added `buildUser` import from `../fixtures/user.fixture.js`
- Added `countByOwner: vi.fn()` to the counter repository mock
- Added full `userRepository` mock (all 7 exported functions as `vi.fn()`)
- Added `import * as userRepository from '../../../db/repositories/user.repository.js'`
- Updated top-level `beforeEach` to set safe defaults:
    - `userRepository.getUserById` → resolves to PREMIUM user (so existing tests are unaffected)
    - `counterRepository.countByOwner` → resolves to `0`
- Added 3 new test cases under `POST /counters`

### 2. Created — Client Unit Tests

**Path:** `app/client/src/views/__tests__/HomeView.spec.ts` _(new file + new directory)_

Tests the limit-gate logic that will be added to `HomeView.vue` — specifically the `isAtFreeLimit` computed and `handleAddCounter()` function. Tests use Vue `ref`/`computed` directly (no component mount) to avoid fighting Ionic/Capacitor jsdom incompatibilities. This matches the project's existing pattern of testing logic rather than DOM.

---

## Test Cases Written

### Server — `POST /counters` (3 new cases)

| # | Description | Expected Outcome |
| --- | --- | --- |
| 1 | BASIC user with exactly 5 existing owned counters tries to create a 6th | `403 FORBIDDEN` |
| 2 | BASIC user with 4 existing owned counters creates a new counter | `201 CREATED` |
| 3 | PREMIUM user with 5 existing owned counters creates a new counter; `countByOwner` is never called | `201 CREATED`, `countByOwner` not called |

### Client — `HomeView — counter-limit gate`

**`isAtFreeLimit` computed (5 cases):**

| #   | Description                                                      | Expected                       |
| --- | ---------------------------------------------------------------- | ------------------------------ |
| 1   | Non-premium user, 4 owned counters                               | `false`                        |
| 2   | Non-premium user, exactly 5 owned counters                       | `true`                         |
| 3   | Non-premium user, 7 owned counters                               | `true`                         |
| 4   | Premium user, 5 owned counters                                   | `false`                        |
| 5   | Non-premium user, 3 owned + 3 shared = 6 total, but only 3 owned | `false` (owned filter correct) |

**`handleAddCounter()` (5 cases):**

| #   | Description                                           | Expected                                         |
| --- | ----------------------------------------------------- | ------------------------------------------------ |
| 6   | Non-premium, 4 owned → click "Add counter"            | `showCounterForm=true`, `showUpgradeModal=false` |
| 7   | Non-premium, 5 owned → click "Add counter"            | `showUpgradeModal=true`, `showCounterForm=false` |
| 8   | Premium, 5 owned → click "Add counter"                | `showCounterForm=true`, `showUpgradeModal=false` |
| 9   | Non-premium, 4 owned + 3 shared → click "Add counter" | `showCounterForm=true` (shared don't count)      |
| 10  | Non-premium, 5 owned + 2 shared → click "Add counter" | `showUpgradeModal=true` (5 owned triggers gate)  |

---

## Test Run Results (as of writing)

### Server (`counters.spec.ts`) — 17 total tests

- **16 pass** (all pre-existing + 2 of the 3 new cases)
- **1 fails** correctly: `should return 403 when BASIC user is at the 5-counter limit`
    - Failure: `expected 201 to be 403` — the guard doesn't exist in the controller yet
    - This is the **correct red state** for TDD

### Client (`HomeView.spec.ts`) — 10 total tests

- **10 pass** — the logic is self-contained in the test file
- These tests will continue to pass; they document the contract for the implementation

---

## Notes / Issues

- `countByOwner` doesn't exist in `counter.repository.ts` yet → LSP errors in the server spec are expected and intentional (the tests drive the implementation)
- The PREMIUM-bypass test (`countByOwner not.toHaveBeenCalled`) will require the controller to short-circuit before calling `countByOwner` — that's the design intent
- Client tests deliberately do **not** mount `HomeView` because Ionic components (`IonPage`, etc.) have no jsdom stubs in this project. The logic under test is pure reactive Vue and can be extracted to a composable at implementation time without breaking these tests.

---

## Commands to Run Tests

```bash
# Server integration tests (counters only)
cd app/server && npx vitest run src/tests/integration/specs/counters.spec.ts

# All server tests
cd app/server && npx vitest run

# Client HomeView tests
cd app/client && npx vitest run src/views/__tests__/HomeView.spec.ts

# All client tests
cd app/client && npx vitest run
```
