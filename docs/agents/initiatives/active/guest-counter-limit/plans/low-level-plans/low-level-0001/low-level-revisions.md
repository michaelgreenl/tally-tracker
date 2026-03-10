# Low-Level Plan Revisions (Iteration 1)

## VERDICT: REJECT

4 concrete defects that will cause compile errors or test failures if implemented as written.

---

## Issue 1 — `computed` not imported in HomeView.vue

**Problem:** The plan adds `ownedCounterCount` and `isAtFreeLimit` as `computed` refs, but `computed` is NOT in the current `from 'vue'` import:

```ts
import { ref, onMounted, onUnmounted } from 'vue';
```

**Fix:** Add `computed` to the vue import:

```ts
import { ref, computed, onMounted, onUnmounted } from 'vue';
```

---

## Issue 2 — `useRouter` is already imported in HomeView.vue

**Problem:** The plan says to add `useRouter` import and `const router = useRouter()`, but both already exist in the file (line 4 and line 38).

**Fix:** Remove the instruction to add `useRouter` import and `const router = useRouter()` from Milestone 3 — both already exist. Reuse the existing `router` reference.

---

## Issue 3 — Test file mock patterns need clarification

**Problem:** The `vi.mock` call for `user.repository` needs to follow the same no-extension pattern as the existing counter repo mock, and `import * as userRepository` must be added after it with `.js` extension (matching existing import style at line 34).

**Fix:** Clarify that:

- `vi.mock('../../../db/repositories/user.repository', ...)` uses no extension (matching existing counter mock pattern)
- `import * as userRepository from '../../../db/repositories/user.repository.js'` uses `.js` (matching existing import pattern)

---

## Issue 4 — Default mock returns needed in beforeEach for existing tests

**Problem:** The new guard code runs before `counterRepository.post` for all existing POST tests. If `getUserById` isn't mocked to return a PREMIUM user by default, existing tests will fail with 500s.

**Fix:** Explicitly include in the plan:

1. Add `import { buildUser } from '../fixtures/user.fixture.js'` to test file imports
2. Add these defaults to the `beforeEach` block:

```ts
vi.mocked(userRepository.getUserById).mockResolvedValue(buildUser({ tier: 'PREMIUM' }));
vi.mocked(counterRepository.countByOwner).mockResolvedValue(0);
```

---

## Minor Observations (non-blocking)

- `getUserById` returns `null` if user not found. The guard should handle null (treat as non-premium) — current code `if (!owner || owner.tier !== 'PREMIUM')` does handle this correctly.
- `authStore` and `counterStore` are already instantiated in HomeView.vue (lines 36–37). Do not re-declare them.
- Verify `IonModal` component API (`is-open`, `@didDismiss`) matches the Ionic Vue 8 API before coding the template.
