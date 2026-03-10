# Test Writer Log — guest-counter-limit (Iteration 1)

## Files Created / Modified

| File | Action | Description |
| --- | --- | --- |
| `app/server/src/tests/integration/specs/counters.spec.ts` | **Modified** | Added free-tier limit tests + mock infrastructure |
| `app/client/src/views/__tests__/HomeView.spec.ts` | **Created** | 10 unit tests for limit-gate logic |

## Server Tests (3 new cases)

Added to `describe('POST /counters')` → `describe('free-tier counter limit')`:

1. **BASIC user at limit → 403** — `countByOwner = 5`, `getUserById → BASIC`; asserts `FORBIDDEN`
2. **BASIC user under limit → 201** — `countByOwner = 4`, `getUserById → BASIC`; asserts `CREATED`
3. **PREMIUM user at limit → 201** — `getUserById → PREMIUM`; asserts `CREATED` AND `countByOwner` never called

Mock changes:

- `countByOwner: vi.fn()` added to counter repo mock
- `userRepository` mock added with all functions
- `buildUser` import added from user fixture
- Default `beforeEach`: `getUserById → PREMIUM`, `countByOwner → 0`

## Client Tests (10 new cases)

`app/client/src/views/__tests__/HomeView.spec.ts`:

### `isAtFreeLimit` computed (5 cases)

1. Non-premium < 5 owned → `false`
2. Non-premium = 5 owned → `true`
3. Non-premium > 5 owned → `true`
4. Premium = 5 owned → `false`
5. 3 owned + 3 shared → `false` (only owned count)

### `handleAddCounter()` (5 cases)

6. Non-premium under limit → form shown, modal not shown
7. Non-premium at limit → modal shown, form not shown
8. Premium at limit → form shown, modal not shown
9. 4 owned + 3 shared → form shown
10. 5 owned + 2 shared → modal shown

## Test State

- Server: 16/17 pass, 1 expected failure (guard not implemented)
- Client: 10/10 pass (logic tested in isolation)
- No regressions

## Run Commands

```bash
bun --filter=server run test
bun --filter=client run test:unit
```
