# Low-Level Plan Revisions: low-level-0001

> Reviewer: Low-Level Plan Reviewer Status: REJECT — 3 issues found. All must be resolved before implementation.

---

## Issue 1 — Step 5: `vi.mocked(jwt).mockImplementation(...)` will fail at runtime

**Step affected:** Step 5 (counters.spec.ts — limit enforcement `describe` block)

**Problem:**

The plan's `beforeEach` and `afterEach` inside `describe('POST /counters — limit enforcement')` call:

```ts
vi.mocked(jwt).mockImplementation((req: any, _res: any, next: any) => {
    req.user = { id: TEST_USER_ID, email: 'test@test.com', tier: 'BASIC' };
    next();
});
```

This requires `jwt` to be a Vitest spy (`vi.fn()`). However, the top-level `vi.mock('../../../middleware/auth.middleware', ...)` in the existing spec wraps `jwt` as a **plain arrow function literal** — not a `vi.fn()`:

```ts
vi.mock('../../../middleware/auth.middleware', () => ({
    jwt: (req, res, next) => {
        // ← plain function, NOT vi.fn()
        req.user = { id: TEST_USER_ID, email: 'test@test.com', tier: 'PREMIUM' };
        next();
    },
}));
```

Calling `.mockImplementation()` on a non-spy will throw a runtime error: `jwt.mockImplementation is not a function`.

**Correct approach:**

Change the top-level `vi.mock` for `auth.middleware` so that `jwt` is a `vi.fn()` with the PREMIUM implementation as its default:

```ts
vi.mock('../../../middleware/auth.middleware', () => ({
    jwt: vi.fn((req: any, _res: any, next: any) => {
        req.user = { id: TEST_USER_ID, email: 'test@test.com', tier: 'PREMIUM' };
        next();
    }),
}));
```

Then the plan's `vi.mocked(jwt).mockImplementation(...)` calls in `beforeEach`/`afterEach` will work correctly. This single change to the top-level mock is the only required fix — the rest of the `beforeEach`/`afterEach` pattern in the limit enforcement block is correct.

The import of `jwt` from the mocked module (already planned in Step 5, Change 3) is also required for `vi.mocked(jwt)` to reference the spy. Ensure the import reads:

```ts
import { jwt } from '../../../middleware/auth.middleware.js';
```

---

## Issue 2 — Step 5: Missing test scenario — "Rejected shares don't count"

**Step affected:** Step 5 (counters.spec.ts — new test block)

**Problem:**

The high-level plan's test matrix specifies **9 required scenarios** (Milestone 4, "Test Scenarios: Shared Counters & the Limit"). The low-level plan's new `describe` block only includes **8 tests**. The missing scenario is:

| Scenario                        | Owned | Shared (accepted) | Total | Can Create? |
| ------------------------------- | ----- | ----------------- | ----- | ----------- |
| **Rejected shares don't count** | 3     | 2 rejected        | **3** | **Yes**     |

This scenario validates that `REJECTED` (and implicitly `PENDING`) shares are excluded from the count. It is critical for correctness — without it, a regression that accidentally counts non-ACCEPTED shares would go undetected.

**Correct approach:**

Add the following test case inside `describe('POST /counters — limit enforcement', ...)`, after the "over limit (legacy data)" test:

```ts
it('should allow BASIC user — rejected shares do not count toward limit (3 owned, 2 rejected = 3 effective)', async () => {
    vi.mocked(userRepository.getUserById).mockResolvedValue(buildUser({ tier: 'BASIC' }) as any);
    // countAccessibleByUser returns 3 because the WHERE clause filters to ACCEPTED shares only
    vi.mocked(counterRepository.countAccessibleByUser).mockResolvedValue(3);
    vi.mocked(counterRepository.post).mockResolvedValue(buildCounter({ title: 'New' }));

    const res = await request(app).post('/counters').send({ title: 'New' });

    expect(res.status).toBe(CREATED);
    expect(counterRepository.post).toHaveBeenCalled();
});
```

Note: Because `countAccessibleByUser` is mocked, the test does not directly exercise the `WHERE` clause. However, it confirms the controller allows creation when `countAccessibleByUser` returns a value below the limit (3 < 5), which is the expected result when rejected shares are excluded. The scenario exists to document intent and catch any accidental double-counting at the controller level (e.g., if someone were to mistakenly add a second count query that included rejected shares). Update the summary table comment from "8 test cases" to "9 test cases".

---

## Issue 3 — Step 8: Missing `useRouter` import and `router` declaration in HomeView.vue

**Step affected:** Step 8 (HomeView.vue — modal + gate changes)

**Problem:**

The plan's template change (Change 6) uses `router.push('/upgrade')` inside the `ion-modal` markup:

```html
<BaseButton @click="showUpgradeModal = false; router.push('/upgrade')"> Learn More </BaseButton>
```

However, `HomeView.vue` does **not** currently import `useRouter` or declare a `router` const. The plan's script changes (Changes 1–4) add `IonModal`, `MAX_FREE_COUNTERS`, `showUpgradeModal`, and `handleAddCounter` — but never add the `useRouter` import or `const router = useRouter()`.

At runtime this would throw a `ReferenceError: router is not defined`.

**Correct approach:**

Add two things as part of the Step 8 script changes:

**1. Add `useRouter` to the vue-router import.**

After the existing vue-router import (which currently is just `import { useRouter } from 'vue-router'` if it exists, or add it fresh):

Check whether `HomeView.vue` already imports from `vue-router`. If it does not, add a new import after the `@ionic/vue` import block:

```ts
import { useRouter } from 'vue-router';
```

**2. Add `const router = useRouter()` to the setup block.**

After the store instantiations (e.g., after `const counterStore = useCounterStore()`), add:

```ts
const router = useRouter();
```

This declaration must appear **before** any reactive state that references `router`, and before the `handleAddCounter` function (though `handleAddCounter` doesn't use `router` directly — it only controls the modal). The `router` reference is used only in the template's modal CTA.

**Alternative (simpler) approach:**

If `router` setup seems like unnecessary boilerplate for a single CTA, the template click handler can use `$router` (Vue's injected router instance available in templates) instead:

```html
<BaseButton @click="showUpgradeModal = false; $router.push('/upgrade')"> Learn More </BaseButton>
```

Either approach is acceptable. The plan must explicitly implement one of them to avoid the `ReferenceError`.

---

## Revision Checklist

| # | Step | Issue | Fix Required |
| --- | --- | --- | --- |
| 1 | Step 5 | `jwt` mock is a plain function, not `vi.fn()` — `mockImplementation` will throw | Change top-level auth.middleware mock to use `vi.fn(...)` |
| 2 | Step 5 | Missing "rejected shares don't count" test scenario (9th of 9) | Add the missing test case to the limit enforcement `describe` block |
| 3 | Step 8 | `router.push('/upgrade')` used in template without `useRouter` import/declaration | Add `import { useRouter } from 'vue-router'` and `const router = useRouter()` to HomeView.vue script changes |
