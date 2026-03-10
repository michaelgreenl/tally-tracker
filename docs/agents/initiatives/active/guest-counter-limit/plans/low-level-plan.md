# Low-Level Plan: guest-counter-limit (v2)

> Implementation plan derived from high-level-plan.md (v3) and context.md. Each step produces a compilable codebase. Steps are ordered so dependencies are satisfied before consumers.
>
> **Revision note (v2):** Addresses 3 issues from low-level-0001 review: (1) auth mock changed from plain arrow to `vi.fn()`, (2) missing "rejected shares don't count" test added (9th scenario), (3) `useRouter` import and `router` declaration added to HomeView.vue.

---

## Milestone 1 — Shared Constant

---

### Step 1: Create `limits.ts` constant file

**File:** `packages/utils/src/constants/limits.ts` **Action:** Create **Depends on:** None

#### Changes

Create a new file with the following content:

```ts
export const MAX_FREE_COUNTERS = 5;
```

This follows the same pattern as `status-codes.ts` — simple named exports of primitive constants.

#### Verification

```bash
bun run type-check
```

No consumers yet, so this just needs to be valid TypeScript. The file will be wired in the next step.

---

### Step 2: Re-export `limits.ts` from the constants barrel

**File:** `packages/utils/src/constants/index.ts` **Action:** Modify **Depends on:** Step 1

#### Changes

The file currently contains (line 1):

```ts
export * from './status-codes.ts';
```

Add a second line to re-export the new limits module. The file becomes:

```ts
export * from './status-codes.ts';
export * from './limits.ts';
```

This completes the export chain: `limits.ts` -> `constants/index.ts` -> `src/index.ts` -> `@packages/utils`. No change to `packages/utils/src/index.ts` is needed — it already re-exports everything from `./constants/index.ts`.

#### Verification

```bash
bun run type-check
```

After this step, `import { MAX_FREE_COUNTERS } from '@packages/utils'` resolves to `5` in both client and server. The existing `FORBIDDEN`, `NOT_FOUND`, etc. exports are unaffected.

---

## Milestone 2 — Server-Side Limit Enforcement

---

### Step 3: Add `countAccessibleByUser` to the counter repository

**File:** `app/server/src/db/repositories/counter.repository.ts` **Action:** Modify **Depends on:** None (no dependency on the constant — this is a pure DB function)

#### Changes

Append the new function **after** the `updateShare` function (currently the last export, ending at line 194). Add it at the end of the file:

```ts
// Counts all counters accessible to a user (owned + accepted shares).
// Mirrors the WHERE clause of getAllByUser — keep them in sync.
export const countAccessibleByUser = async (userId: string): Promise<number> =>
    prisma.counter.count({
        where: {
            OR: [
                { userId },
                {
                    shares: {
                        some: {
                            userId,
                            status: 'ACCEPTED' as ShareStatusType,
                        },
                    },
                },
            ],
        },
    });
```

**No new imports are needed.** The function uses `prisma` (line 1), and `ShareStatusType` (line 4) — both already imported.

The `OR` clause is identical to `getAllByUser` (lines 43-53) but uses `prisma.counter.count()` instead of `findMany`, and omits `include`/`orderBy` since only the count is needed.

#### Verification

```bash
bun --filter=server run type-check
```

---

### Step 4: Add the counter-limit guard to the `post` handler

**File:** `app/server/src/api/controllers/counter.controller.ts` **Action:** Modify **Depends on:** Step 2 (constant), Step 3 (repository function)

#### Changes — Imports (lines 1-2)

**Change 1:** Add `FORBIDDEN` and `MAX_FREE_COUNTERS` to the `@packages/utils` import on line 1.

Replace:

```ts
import { CREATED, BAD_REQUEST, NOT_FOUND, CONFLICT, SERVER_ERROR } from '@packages/utils';
```

With:

```ts
import { CREATED, BAD_REQUEST, FORBIDDEN, NOT_FOUND, CONFLICT, SERVER_ERROR, MAX_FREE_COUNTERS } from '@packages/utils';
```

**Change 2:** Add a `userRepository` namespace import after the existing `counterRepository` import (line 2). Insert a new line 3:

After:

```ts
import * as counterRepository from '../../db/repositories/counter.repository.js';
```

Add:

```ts
import * as userRepository from '../../db/repositories/user.repository.js';
```

Note the `.js` extension — this is required by the server's NodeNext module resolution, matching the existing `counter.repository.js` import pattern.

#### Changes — `post` handler body (lines 15-42)

The guard is inserted **after** the `!userId` check (line 20-22) and **before** `counterRepository.post()` (line 24).

Replace the entire `post` function body (lines 15-42):

```ts
export const post = async (req: Request<{}, {}, CreateCounterRequest>, res: Response<CounterResponse>) => {
    try {
        const userId = req.user?.id;
        const { id, title, count, color, type, inviteCode } = req.body;

        if (!userId) {
            return res.status(BAD_REQUEST).json({ success: false, message: 'Invalid userId' });
        }

        const counter = await counterRepository.post({ id, userId, title, count, color, type, inviteCode });

        if (!counter) {
            return res.status(NOT_FOUND).json({ success: false, message: 'Counter not found' });
        }

        res.status(CREATED).json({
            success: true,
            message: 'Counter created successfully',
            data: { counter },
        });
    } catch (error: any) {
        console.error('Counter Controller Error: ', error);
        res.status(SERVER_ERROR).json({
            success: false,
            message: 'Server error: ' + error.message,
        });
    }
};
```

With:

```ts
export const post = async (req: Request<{}, {}, CreateCounterRequest>, res: Response<CounterResponse>) => {
    try {
        const userId = req.user?.id;
        const { id, title, count, color, type, inviteCode } = req.body;

        if (!userId) {
            return res.status(BAD_REQUEST).json({ success: false, message: 'Invalid userId' });
        }

        // --- Counter limit guard (non-premium users) ---
        const user = await userRepository.getUserById(userId);

        if (!user) {
            return res.status(NOT_FOUND).json({ success: false, message: 'User not found' });
        }

        if (user.tier !== 'PREMIUM') {
            const accessibleCount = await counterRepository.countAccessibleByUser(userId);
            if (accessibleCount >= MAX_FREE_COUNTERS) {
                return res.status(FORBIDDEN).json({
                    success: false,
                    message: 'Counter limit reached. Upgrade to Premium for unlimited counters.',
                });
            }
        }
        // --- End counter limit guard ---

        const counter = await counterRepository.post({ id, userId, title, count, color, type, inviteCode });

        if (!counter) {
            return res.status(NOT_FOUND).json({ success: false, message: 'Counter not found' });
        }

        res.status(CREATED).json({
            success: true,
            message: 'Counter created successfully',
            data: { counter },
        });
    } catch (error: any) {
        console.error('Counter Controller Error: ', error);
        res.status(SERVER_ERROR).json({
            success: false,
            message: 'Server error: ' + error.message,
        });
    }
};
```

**Key behavioral notes:**

- `userRepository.getUserById(userId)` is called to get the user's `tier` from the DB (JWT does not contain `tier` — see AD-3).
- If `getUserById` returns `null`, the guard returns 404. This is a defensive check for users deleted between JWT issuance and request.
- If `user.tier !== 'PREMIUM'`, the guard queries `countAccessibleByUser` to count owned + accepted-shared counters.
- If the count is >= 5, the guard returns 403 with the limit message.
- Premium users skip the count query entirely — no unnecessary DB call.

#### Verification

```bash
bun --filter=server run type-check
```

---

### Step 5: Update test mocks and add limit enforcement tests

**File:** `app/server/src/tests/integration/specs/counters.spec.ts` **Action:** Modify **Depends on:** Step 3, Step 4

This is the most complex step. There are three categories of changes:

1. **Mock infrastructure additions** (top of file)
2. **Import additions** (top of file)
3. **New test `describe` block** (after existing tests)

#### Changes — Mock additions (after line 27, before line 29)

**Change 1:** Add `countAccessibleByUser: vi.fn()` to the existing `counter.repository` mock block.

Replace the `counter.repository` mock (lines 16-27):

```ts
vi.mock('../../../db/repositories/counter.repository', () => ({
    post: vi.fn(),
    getAllByUser: vi.fn(),
    getByIdOrShare: vi.fn(),
    remove: vi.fn(),
    put: vi.fn(),
    increment: vi.fn(),
    getParticipants: vi.fn(),
    join: vi.fn(),
    createShare: vi.fn(),
    updateShare: vi.fn(),
}));
```

With:

```ts
vi.mock('../../../db/repositories/counter.repository', () => ({
    post: vi.fn(),
    getAllByUser: vi.fn(),
    getByIdOrShare: vi.fn(),
    remove: vi.fn(),
    put: vi.fn(),
    increment: vi.fn(),
    getParticipants: vi.fn(),
    join: vi.fn(),
    createShare: vi.fn(),
    updateShare: vi.fn(),
    countAccessibleByUser: vi.fn(),
}));
```

**Change 2:** Add a new `user.repository` mock block. Insert it **after** the `idempotency.repository` mock (after line 32) and before the repository import (line 34):

```ts
vi.mock('../../../db/repositories/user.repository', () => ({
    getUserById: vi.fn(),
}));
```

**Change 3 (v2 fix — Issue 1):** Replace the existing `auth.middleware` mock so that `jwt` is a `vi.fn()` spy instead of a plain arrow function. This is required so that `vi.mocked(jwt).mockImplementation(...)` works in the limit enforcement tests.

Replace the existing `auth.middleware` mock (lines 8-14):

```ts
vi.mock('../../../middleware/auth.middleware', () => ({
    jwt: (req, res, next) => {
        req.user = { id: TEST_USER_ID, email: 'test@test.com', tier: 'PREMIUM' };
        next();
    },
}));
```

With:

```ts
vi.mock('../../../middleware/auth.middleware', () => ({
    jwt: vi.fn((req: any, _res: any, next: any) => {
        req.user = { id: TEST_USER_ID, email: 'test@test.com', tier: 'PREMIUM' };
        next();
    }),
}));
```

The default behavior is identical — `req.user` is set with `tier: 'PREMIUM'` and `next()` is called. The only difference is that `jwt` is now a `vi.fn()` spy, enabling `vi.mocked(jwt).mockImplementation(...)` in test blocks that need to override the tier.

#### Changes — Import additions (after line 34)

**Change 4:** Add imports for the newly mocked modules and fixtures. After the existing import on line 34:

```ts
import * as counterRepository from '../../../db/repositories/counter.repository.js';
```

Add:

```ts
import * as userRepository from '../../../db/repositories/user.repository.js';
import { jwt } from '../../../middleware/auth.middleware.js';
import { buildUser } from '../fixtures/user.fixture.js';
```

**Change 5:** Add `FORBIDDEN` to the status code import on line 1:

Replace:

```ts
import { OK, CREATED, NOT_FOUND, UNPROCESSABLE_ENTITY } from '@packages/utils';
```

With:

```ts
import { OK, CREATED, FORBIDDEN, NOT_FOUND, UNPROCESSABLE_ENTITY } from '@packages/utils';
```

#### Changes — Existing `POST /counters` tests: add `getUserById` mock to `beforeEach`

The existing 5 `POST /counters` tests use the auth mock with `tier: 'PREMIUM'`. The controller now calls `getUserById` before reaching `counterRepository.post()`. Since the existing auth mock sets `tier: 'PREMIUM'`, the guard will call `getUserById` and then skip the count check (premium users skip).

However, `getUserById` must return a non-null user, or the guard will return 404 before reaching `post`. We need to mock `getUserById` to return a PREMIUM user in the existing `POST /counters` tests.

Add a `beforeEach` **inside** the existing `describe('POST /counters', ...)` block (after line 42, before line 43):

```ts
    describe('POST /counters', () => {
        beforeEach(() => {
            vi.mocked(userRepository.getUserById).mockResolvedValue(
                buildUser({ tier: 'PREMIUM' }) as any,
            );
        });
```

Note: `buildUser()` returns a full `User` object but `getUserById` returns a select subset. Using `as any` satisfies the mock typing. This is consistent with how other mocks in this file use loose typing (e.g., `buildCounter()` returns a plain object, not the exact Prisma return type).

#### Changes — New test block: limit enforcement tests

Append the following **new `describe` block** inside `describe('Counter Routes', ...)`, after the `PUT /counters/update/:counterId` block (after line 189, before line 190 — the closing `});`):

```ts
describe('POST /counters — limit enforcement', () => {
    beforeEach(() => {
        // Override auth mock to use BASIC tier for limit tests
        vi.mocked(jwt).mockImplementation((req: any, _res: any, next: any) => {
            req.user = { id: TEST_USER_ID, email: 'test@test.com', tier: 'BASIC' };
            next();
        });
    });

    afterEach(() => {
        // Restore PREMIUM auth mock for subsequent test blocks
        vi.mocked(jwt).mockImplementation((req: any, _res: any, next: any) => {
            req.user = { id: TEST_USER_ID, email: 'test@test.com', tier: 'PREMIUM' };
            next();
        });
    });

    it('should allow BASIC user under limit (3 owned, 0 shared)', async () => {
        vi.mocked(userRepository.getUserById).mockResolvedValue(buildUser({ tier: 'BASIC' }) as any);
        vi.mocked(counterRepository.countAccessibleByUser).mockResolvedValue(3);
        vi.mocked(counterRepository.post).mockResolvedValue(buildCounter({ title: 'New' }));

        const res = await request(app).post('/counters').send({ title: 'New' });

        expect(res.status).toBe(CREATED);
        expect(res.body.data.counter.title).toBe('New');
    });

    it('should allow BASIC user under limit with shares (2 owned, 2 shared = 4)', async () => {
        vi.mocked(userRepository.getUserById).mockResolvedValue(buildUser({ tier: 'BASIC' }) as any);
        vi.mocked(counterRepository.countAccessibleByUser).mockResolvedValue(4);
        vi.mocked(counterRepository.post).mockResolvedValue(buildCounter({ title: 'New' }));

        const res = await request(app).post('/counters').send({ title: 'New' });

        expect(res.status).toBe(CREATED);
    });

    it('should reject BASIC user at limit — all owned (5 owned, 0 shared)', async () => {
        vi.mocked(userRepository.getUserById).mockResolvedValue(buildUser({ tier: 'BASIC' }) as any);
        vi.mocked(counterRepository.countAccessibleByUser).mockResolvedValue(5);

        const res = await request(app).post('/counters').send({ title: 'Rejected' });

        expect(res.status).toBe(FORBIDDEN);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/counter limit reached/i);
        expect(counterRepository.post).not.toHaveBeenCalled();
    });

    it('should reject BASIC user at limit — mixed (3 owned, 2 shared = 5)', async () => {
        vi.mocked(userRepository.getUserById).mockResolvedValue(buildUser({ tier: 'BASIC' }) as any);
        vi.mocked(counterRepository.countAccessibleByUser).mockResolvedValue(5);

        const res = await request(app).post('/counters').send({ title: 'Rejected' });

        expect(res.status).toBe(FORBIDDEN);
        expect(counterRepository.post).not.toHaveBeenCalled();
    });

    it('should reject BASIC user at limit — all shared (0 owned, 5 shared = 5)', async () => {
        vi.mocked(userRepository.getUserById).mockResolvedValue(buildUser({ tier: 'BASIC' }) as any);
        vi.mocked(counterRepository.countAccessibleByUser).mockResolvedValue(5);

        const res = await request(app).post('/counters').send({ title: 'Rejected' });

        expect(res.status).toBe(FORBIDDEN);
        expect(counterRepository.post).not.toHaveBeenCalled();
    });

    it('should reject BASIC user over limit (legacy data, 6 owned)', async () => {
        vi.mocked(userRepository.getUserById).mockResolvedValue(buildUser({ tier: 'BASIC' }) as any);
        vi.mocked(counterRepository.countAccessibleByUser).mockResolvedValue(6);

        const res = await request(app).post('/counters').send({ title: 'Rejected' });

        expect(res.status).toBe(FORBIDDEN);
        expect(counterRepository.post).not.toHaveBeenCalled();
    });

    it('should allow BASIC user — rejected shares do not count toward limit (3 owned, 2 rejected = 3 effective)', async () => {
        vi.mocked(userRepository.getUserById).mockResolvedValue(buildUser({ tier: 'BASIC' }) as any);
        // countAccessibleByUser returns 3 because the WHERE clause filters to ACCEPTED shares only
        vi.mocked(counterRepository.countAccessibleByUser).mockResolvedValue(3);
        vi.mocked(counterRepository.post).mockResolvedValue(buildCounter({ title: 'New' }));

        const res = await request(app).post('/counters').send({ title: 'New' });

        expect(res.status).toBe(CREATED);
        expect(counterRepository.post).toHaveBeenCalled();
    });

    it('should allow PREMIUM user regardless of count (10 owned, 5 shared = 15)', async () => {
        // Override back to PREMIUM for this single test
        vi.mocked(jwt).mockImplementation((req: any, _res: any, next: any) => {
            req.user = { id: TEST_USER_ID, email: 'test@test.com', tier: 'PREMIUM' };
            next();
        });
        vi.mocked(userRepository.getUserById).mockResolvedValue(buildUser({ tier: 'PREMIUM' }) as any);
        vi.mocked(counterRepository.post).mockResolvedValue(buildCounter({ title: 'Premium Counter' }));

        const res = await request(app).post('/counters').send({ title: 'Premium Counter' });

        expect(res.status).toBe(CREATED);
        // countAccessibleByUser should NOT be called for premium users
        expect(counterRepository.countAccessibleByUser).not.toHaveBeenCalled();
    });

    it('should return 404 when user not found (null)', async () => {
        vi.mocked(userRepository.getUserById).mockResolvedValue(null);

        const res = await request(app).post('/counters').send({ title: 'Ghost' });

        expect(res.status).toBe(NOT_FOUND);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/user not found/i);
        expect(counterRepository.post).not.toHaveBeenCalled();
    });
});
```

**Import note:** The `afterEach` import is already available from vitest's globals. However, `afterEach` is not currently imported on line 2. Add it:

Replace:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
```

With:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
```

#### Summary of all changes to `counters.spec.ts`

| Location | Change |
| --- | --- |
| Line 1 | Add `FORBIDDEN` to `@packages/utils` import |
| Line 2 | Add `afterEach` to vitest import |
| Lines 8-14 | **(v2 fix)** Change `jwt` from plain arrow function to `vi.fn(...)` spy |
| Lines 16-27 | Add `countAccessibleByUser: vi.fn()` to counter.repository mock |
| After line 32 | Add `vi.mock('../../../db/repositories/user.repository', ...)` block |
| After line 34 | Add imports: `userRepository`, `jwt`, `buildUser` |
| Inside `describe('POST /counters')` | Add `beforeEach` with `getUserById` mock for PREMIUM user |
| After `PUT /counters/update` block | Add new `describe('POST /counters — limit enforcement')` block with **9 test cases** |

#### Verification

```bash
bun --filter=server run test
```

All existing tests should still pass (they use PREMIUM tier, which skips the guard). The 9 new tests should all pass.

As an acceptance check (not a new unit test), verify the existing `POST /counters` tests still produce `CREATED` (201):

```bash
bun --filter=server run test -- --reporter=verbose 2>&1 | grep -E "should create a personal counter|should create a shared counter"
```

Both should show as passing.

---

## Milestone 3 — Client-Side Modal & UpgradeView

---

### Step 6: Create `UpgradeView.vue` boilerplate

**File:** `app/client/src/views/UpgradeView.vue` **Action:** Create **Depends on:** None

#### Changes

Create a new file following the same view patterns used in the codebase (`IonPage` + `IonContent` wrapper, `<script setup lang="ts">`). This is a placeholder page:

```vue
<script setup lang="ts">
import { useRouter } from 'vue-router';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton } from '@ionic/vue';

const router = useRouter();
</script>

<template>
    <ion-page>
        <ion-header>
            <ion-toolbar color="primary">
                <ion-title>Upgrade to Premium</ion-title>
                <ion-buttons slot="start">
                    <ion-button @click="router.back()">Back</ion-button>
                </ion-buttons>
            </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
            <div class="upgrade-wrapper">
                <h2>Unlock Unlimited Counters</h2>
                <p>Free accounts are limited to 5 counters. Upgrade to Premium for unlimited counters and more.</p>
                <p><strong>Coming soon.</strong></p>
            </div>
        </ion-content>
    </ion-page>
</template>

<style lang="scss" scoped>
.upgrade-wrapper {
    max-width: 600px;
    margin: 0 auto;
    text-align: center;
}
</style>
```

#### Verification

```bash
bun --filter=client run type-check
```

The file should compile but is not reachable yet (no route). That's added in the next step.

---

### Step 7: Register the `/upgrade` route

**File:** `app/client/src/router/index.ts` **Action:** Modify **Depends on:** Step 6

#### Changes — Import (after line 7)

After the existing view imports (lines 4-7):

```ts
import HomeView from '@/views/HomeView.vue';
import LoginView from '@/views/LoginView.vue';
import RegisterView from '@/views/RegisterView.vue';
import JoinView from '@/views/JoinView.vue';
```

Add:

```ts
import UpgradeView from '@/views/UpgradeView.vue';
```

#### Changes — Route entry (inside `routes` array, after line 18)

After the existing `/join` route entry (line 18):

```ts
    { path: '/join', name: 'Join', component: JoinView },
```

Add:

```ts
    { path: '/upgrade', name: 'Upgrade', component: UpgradeView, meta: { title: 'Upgrade' } },
```

No `requiresAuth` meta — consistent with AD-6 and the existing `/join` pattern. The `meta: { title: 'Upgrade' }` follows the pattern used by `/login` and `/register`.

#### Verification

```bash
bun --filter=client run type-check
```

---

### Step 8: Add the upgrade modal and gate logic to `HomeView.vue`

**File:** `app/client/src/views/HomeView.vue` **Action:** Modify **Depends on:** Step 2 (constant), Step 7 (route exists for CTA navigation)

#### Changes — Script section

**Change 1:** Add `IonModal` to the Ionic component import (lines 18-31).

Replace:

```ts
import {
    IonPage,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonButtons,
    IonButton,
    IonIcon,
    IonSpinner,
} from '@ionic/vue';
```

With:

```ts
import {
    IonPage,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonButtons,
    IonButton,
    IonIcon,
    IonSpinner,
    IonModal,
} from '@ionic/vue';
```

**Change 2:** Add the `MAX_FREE_COUNTERS` import. Insert after the type imports (after line 34):

After:

```ts
import type { ClientCounter } from '@packages/core';
```

Add:

```ts
import { MAX_FREE_COUNTERS } from '@packages/utils';
```

**Change 3 (v2 fix — Issue 3):** Add `useRouter` import and `router` declaration. Insert a new import after the `@packages/utils` import (added in Change 2):

```ts
import { useRouter } from 'vue-router';
```

Then, inside the `<script setup>` block, after the store instantiations (after `const counterStore = useCounterStore()`), add:

```ts
const router = useRouter();
```

This is required because the modal CTA template uses `router.push('/upgrade')`. Without this import and declaration, `router` would be undefined at runtime.

**Change 4:** Add the `showUpgradeModal` ref. Insert after the existing `counterToUpdate` ref (after line 41):

After:

```ts
const showCounterForm = ref(false);
const counterToUpdate = ref<ClientCounter | null>(null);
```

Add:

```ts
const showUpgradeModal = ref(false);
```

**Change 5:** Add the `handleAddCounter` function. Insert before the `</script>` tag (after the `closeCounterForm` function, after line 58):

After:

```ts
const closeCounterForm = () => {
    counterToUpdate.value = null;
    showCounterForm.value = false;
};
```

Add:

```ts
const handleAddCounter = () => {
    if (!authStore.isPremium && counterStore.counters.length >= MAX_FREE_COUNTERS) {
        showUpgradeModal.value = true;
    } else {
        showCounterForm.value = true;
    }
};
```

#### Changes — Template section

**Change 6:** Replace the "Add counter" button click handler. On line 102:

Replace:

```html
<BaseButton v-if="!showCounterForm" @click="showCounterForm = true">Add counter</BaseButton>
```

With:

```html
<BaseButton v-if="!showCounterForm" @click="handleAddCounter">Add counter</BaseButton>
```

**Change 7:** Add the `ion-modal` component. Insert it **after** the closing `</div>` of `content-wrapper` (after line 107) and **before** `</ion-content>` (line 108):

After:

```html
            </div>
```

And before:

```html
        </ion-content>
```

Insert:

```html
<ion-modal :is-open="showUpgradeModal" @didDismiss="showUpgradeModal = false">
    <div class="ion-padding modal-content">
        <h2>Counter Limit Reached</h2>
        <p>Free accounts are limited to {{ MAX_FREE_COUNTERS }} counters. Upgrade to Premium for unlimited counters.</p>
        <BaseButton @click="showUpgradeModal = false; router.push('/upgrade')"> Learn More </BaseButton>
        <BaseButton @click="showUpgradeModal = false">Dismiss</BaseButton>
    </div>
</ion-modal>
```

**Change 8:** Add modal styling. Append to the existing `<style>` block (after line 130, before `</style>`):

After:

```scss
.content-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding-right: 1em;
}
```

Add:

```scss
.modal-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    gap: 1em;
}
```

#### Summary of all changes to `HomeView.vue`

| Location                       | Change                                                    |
| ------------------------------ | --------------------------------------------------------- |
| Lines 18-31                    | Add `IonModal` to Ionic import                            |
| After line 34                  | Add `import { MAX_FREE_COUNTERS } from '@packages/utils'` |
| After `@packages/utils` import | **(v2 fix)** Add `import { useRouter } from 'vue-router'` |
| After store instantiations     | **(v2 fix)** Add `const router = useRouter()`             |
| After line 41                  | Add `showUpgradeModal` ref                                |
| After line 58                  | Add `handleAddCounter` function                           |
| Line 102                       | Replace click handler with `handleAddCounter`             |
| After line 107                 | Add `ion-modal` component                                 |
| After line 130                 | Add `.modal-content` styles                               |

#### Verification

```bash
bun --filter=client run type-check
```

---

## Milestone 4 — Integration Verification

---

### Step 9: Verify all tests pass together

**File:** N/A (verification only) **Action:** Run tests **Depends on:** Steps 1-8

#### Verification — Server tests

```bash
bun --filter=server run test
```

Expected: All existing tests pass. All 9 new limit enforcement tests pass.

#### Verification — Client type-check

```bash
bun --filter=client run type-check
```

Expected: No type errors.

#### Verification — Full type-check

```bash
bun run type-check
```

Expected: Both client and server pass.

#### Verification — Acceptance check (not a new test)

Run the server tests with verbose output and confirm the new test names appear:

```bash
bun --filter=server run test -- --reporter=verbose 2>&1 | grep "limit enforcement"
```

Expected output should show the `POST /counters — limit enforcement` describe block with all 9 tests passing.

---

## Complete File Change Summary

| Step | File                                                      | Action                               | Milestone |
| ---- | --------------------------------------------------------- | ------------------------------------ | --------- |
| 1    | `packages/utils/src/constants/limits.ts`                  | **Create**                           | M1        |
| 2    | `packages/utils/src/constants/index.ts`                   | Modify (add re-export)               | M1        |
| 3    | `app/server/src/db/repositories/counter.repository.ts`    | Modify (add `countAccessibleByUser`) | M2        |
| 4    | `app/server/src/api/controllers/counter.controller.ts`    | Modify (imports + guard)             | M2        |
| 5    | `app/server/src/tests/integration/specs/counters.spec.ts` | Modify (mocks + 9 tests)             | M2        |
| 6    | `app/client/src/views/UpgradeView.vue`                    | **Create**                           | M3        |
| 7    | `app/client/src/router/index.ts`                          | Modify (import + route)              | M3        |
| 8    | `app/client/src/views/HomeView.vue`                       | Modify (modal + gate + router)       | M3        |
| 9    | (none)                                                    | Verification only                    | M4        |

---

## Dependency Graph (Steps)

```
Step 1 (limits.ts)
  |
Step 2 (re-export)
  |
  +-------+--------+
  |                |
Step 3 (repo fn)  Step 6 (UpgradeView)
  |                |
Step 4 (guard)    Step 7 (route)
  |                |
Step 5 (tests)    Step 8 (HomeView modal)
  |                |
  +-------+--------+
          |
      Step 9 (verify all)
```

Steps 3-5 (server) and Steps 6-8 (client) can be done **in parallel** after Step 2 completes. Step 9 is the final verification gate.

---

## v2 Revision Log

| Issue # | Step | Change Made |
| --- | --- | --- |
| 1 | Step 5 | Top-level `vi.mock` for `auth.middleware` changed from plain arrow function to `vi.fn(...)` so that `vi.mocked(jwt).mockImplementation(...)` works in the limit enforcement `beforeEach`/`afterEach`. |
| 2 | Step 5 | Added 9th test case: "should allow BASIC user — rejected shares do not count toward limit (3 owned, 2 rejected = 3 effective)". Test count updated from 8 to 9 in all references. |
| 3 | Step 8 | Added `import { useRouter } from 'vue-router'` and `const router = useRouter()` to HomeView.vue script changes, so `router.push('/upgrade')` in the modal CTA template resolves correctly at runtime. |
