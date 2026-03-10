# Low-Level Implementation Plan: Free-Tier Counter Limit (v2)

> Revision 2 — fixes 4 defects from LL reviewer: missing `computed` import, duplicate `useRouter`, test mock patterns, default `beforeEach` mocks.

## Milestone 1: Shared Constant

### Step 1.1 — Create `packages/utils/src/constants/limits.ts`

- **File**: `packages/utils/src/constants/limits.ts`
- **Change type**: New file
- **Code**:

```ts
export const MAX_FREE_COUNTERS = 5;
```

- **Why**: Single source of truth for the free-tier counter cap, consumed by both server and client.

### Step 1.2 — Re-export from `packages/utils/src/constants/index.ts`

- **File**: `packages/utils/src/constants/index.ts`
- **Change type**: Modify
- **Before**:

```ts
export * from './status-codes.ts';
```

- **After**:

```ts
export * from './status-codes.ts';
export * from './limits.ts';
```

- **Why**: Barrel re-export so `@packages/utils` consumers can `import { MAX_FREE_COUNTERS } from '@packages/utils'`. Uses `.ts` extension per existing convention.

---

## Milestone 2: Server-Side Guard

### Step 2.1 — Add `countByOwner` to `counter.repository.ts`

- **File**: `app/server/src/db/repositories/counter.repository.ts`
- **Change type**: Modify
- **Add at the end of the file** (before any trailing newline), the following function:

```ts
export const countByOwner = (userId: string): Promise<number> =>
    prisma.counter.count({
        where: { userId },
    });
```

- **Imports**: None new — `prisma` is already imported at the top.
- **Why**: The guard needs a fast `COUNT(*)` query to check how many counters a user owns. Only counts owned counters (`userId` field), not shared ones.

### Step 2.2 — Add free-tier guard to `counter.controller.ts` `post` handler

- **File**: `app/server/src/api/controllers/counter.controller.ts`
- **Change type**: Modify

**Import changes** — add `FORBIDDEN` and `MAX_FREE_COUNTERS` to the existing `@packages/utils` import, and add a new import for `userRepository`:

- **Before**:

```ts
import { CREATED, BAD_REQUEST, NOT_FOUND, CONFLICT, SERVER_ERROR } from '@packages/utils';
import * as counterRepository from '../../db/repositories/counter.repository.js';
```

- **After**:

```ts
import { CREATED, BAD_REQUEST, NOT_FOUND, CONFLICT, SERVER_ERROR, FORBIDDEN, MAX_FREE_COUNTERS } from '@packages/utils';
import * as counterRepository from '../../db/repositories/counter.repository.js';
import * as userRepository from '../../db/repositories/user.repository.js';
```

**Guard logic** — insert immediately after the `if (!userId)` early-return block and before the `const counter = await counterRepository.post(...)` call:

```ts
// Free-tier counter limit guard
const owner = await userRepository.getUserById(userId);
if (!owner || owner.tier !== 'PREMIUM') {
    const ownedCount = await counterRepository.countByOwner(userId);
    if (ownedCount >= MAX_FREE_COUNTERS) {
        return res.status(FORBIDDEN).json({
            success: false,
            message: `Free accounts are limited to ${MAX_FREE_COUNTERS} counters. Upgrade to Premium for unlimited counters.`,
        });
    }
}
```

**Full handler after edit** (for clarity):

```ts
export const post = async (req: Request<{}, {}, CreateCounterRequest>, res: Response<CounterResponse>) => {
    try {
        const userId = req.user?.id;
        const { id, title, count, color, type, inviteCode } = req.body;

        if (!userId) {
            return res.status(BAD_REQUEST).json({ success: false, message: 'Invalid userId' });
        }

        // Free-tier counter limit guard
        const owner = await userRepository.getUserById(userId);
        if (!owner || owner.tier !== 'PREMIUM') {
            const ownedCount = await counterRepository.countByOwner(userId);
            if (ownedCount >= MAX_FREE_COUNTERS) {
                return res.status(FORBIDDEN).json({
                    success: false,
                    message: `Free accounts are limited to ${MAX_FREE_COUNTERS} counters. Upgrade to Premium for unlimited counters.`,
                });
            }
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
        res.status(SERVER_ERROR).json({ success: false, message: 'Server error: ' + error.message });
    }
};
```

- **Why**: Server is the authoritative enforcement point. Queries DB for tier (not JWT) per HL decision. Returns 403 with actionable message. PREMIUM users skip the count query entirely. BASIC users under the limit pass through.

---

## Milestone 3: Client Modal + UpgradeView

### Step 3.1 — Create `UpgradeView.vue`

- **File**: `app/client/src/views/UpgradeView.vue`
- **Change type**: New file
- **Code**:

```vue
<template>
    <ion-page>
        <ion-header>
            <ion-toolbar>
                <ion-buttons slot="start">
                    <ion-button @click="router.back()">
                        <ion-icon :icon="arrowBack" />
                    </ion-button>
                </ion-buttons>
                <ion-title>Upgrade to Premium</ion-title>
            </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
            <div class="upgrade-content">
                <h2>Unlock Unlimited Counters</h2>
                <p>Free accounts are limited to {{ MAX_FREE_COUNTERS }} counters.</p>
                <p>Upgrade to Premium for unlimited counters and more.</p>
                <!-- Payment integration placeholder -->
                <BaseButton @click="router.back()">Go Back</BaseButton>
            </div>
        </ion-content>
    </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon } from '@ionic/vue';
import { arrowBack } from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { MAX_FREE_COUNTERS } from '@packages/utils';
import BaseButton from '@/components/base/BaseButton.vue';

const router = useRouter();
</script>

<style scoped lang="scss">
.upgrade-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 1rem;
    padding-top: 2rem;
}
</style>
```

- **Why**: Standalone `/upgrade` route per HL decision. Placeholder page — payment integration is out of scope.

### Step 3.2 — Add `/upgrade` route to `router/index.ts`

- **File**: `app/client/src/router/index.ts`
- **Change type**: Modify

**Add import** after the existing view imports:

```ts
import UpgradeView from '@/views/UpgradeView.vue';
```

**Add route** — insert after the `/join` route entry in the `routes` array:

- **Before**:

```ts
    { path: '/join', name: 'Join', component: JoinView },
];
```

- **After**:

```ts
    { path: '/join', name: 'Join', component: JoinView },
    { path: '/upgrade', name: 'Upgrade', component: UpgradeView, meta: { title: 'Upgrade' } },
];
```

- **Why**: Registers the `/upgrade` route so the modal CTA can navigate to it.

### Step 3.3 — Add upgrade modal + counter-limit gate to `HomeView.vue`

- **File**: `app/client/src/views/HomeView.vue`
- **Change type**: Modify

**3.3a — Update the `vue` import to include `computed`.**

- **Before** (line 2):

```ts
import { ref, onMounted, onUnmounted } from 'vue';
```

- **After**:

```ts
import { ref, computed, onMounted, onUnmounted } from 'vue';
```

**3.3b — Add `IonModal` to the Ionic imports.**

- **Before**:

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

- **After**:

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

**3.3c — Add `MAX_FREE_COUNTERS` import.** Place near the other imports in `<script setup>`:

```ts
import { MAX_FREE_COUNTERS } from '@packages/utils';
```

> **DO NOT** add `import { useRouter } from 'vue-router'` — it already exists on line 4. **DO NOT** add `const router = useRouter()` — it already exists on line 38. **DO NOT** re-instantiate `authStore` or `counterStore` — they already exist (lines 36–37).

**3.3d — Add state and computed.** Add after the existing `ref` declarations (`showCounterForm`, `counterToUpdate`):

```ts
const showUpgradeModal = ref(false);

const ownedCounterCount = computed(() => counterStore.counters.filter((c) => c.userId === authStore.user?.id).length);
const isAtFreeLimit = computed(() => !authStore.isPremium && ownedCounterCount.value >= MAX_FREE_COUNTERS);
```

**3.3e — Add gated click handler.** Replace the "Add counter" button click:

- **Before**:

```vue
<BaseButton v-if="!showCounterForm" @click="showCounterForm = true">Add counter</BaseButton>
```

- **After**:

```vue
<BaseButton v-if="!showCounterForm" @click="handleAddCounter">Add counter</BaseButton>
```

Add the handler function in `<script setup>`:

```ts
const handleAddCounter = () => {
    if (isAtFreeLimit.value) {
        showUpgradeModal.value = true;
    } else {
        showCounterForm.value = true;
    }
};
```

**3.3f — Add modal markup.** Insert within the template near the bottom of the content area:

```vue
<ion-modal :is-open="showUpgradeModal" @did-dismiss="showUpgradeModal = false">
    <ion-header>
        <ion-toolbar>
            <ion-title>Counter Limit Reached</ion-title>
            <ion-buttons slot="end">
                <ion-button @click="showUpgradeModal = false">Close</ion-button>
            </ion-buttons>
        </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
        <div class="upgrade-modal-content">
            <p>Free accounts are limited to {{ MAX_FREE_COUNTERS }} counters.</p>
            <p>Upgrade to Premium for unlimited counters.</p>
            <BaseButton @click="showUpgradeModal = false; router.push('/upgrade')">
                View Upgrade Options
            </BaseButton>
        </div>
    </ion-content>
</ion-modal>
```

**3.3g — Add modal styles.** Append to the existing `<style scoped lang="scss">` block:

```scss
.upgrade-modal-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 1rem;
    padding-top: 2rem;
}
```

- **Why**: Client-side gate provides instant UX feedback. Filters to OWNED counters only to match server's `countByOwner` behavior. Modal state is a local `ref<boolean>` per architecture decision.

---

## Milestone 4: Integration Tests

### Step 4.1 — Update `counters.spec.ts`

- **File**: `app/server/src/tests/integration/specs/counters.spec.ts`
- **Change type**: Modify

**4.1a — Add `FORBIDDEN` and `MAX_FREE_COUNTERS` to the `@packages/utils` import.**

Find the existing import and append:

```ts
import { ..., FORBIDDEN, MAX_FREE_COUNTERS } from '@packages/utils';
```

**4.1b — Add `countByOwner` to the counter repository mock.**

Find the existing `vi.mock('../../../db/repositories/counter.repository', ...)` object and add:

```ts
countByOwner: vi.fn(),
```

**4.1c — Add `userRepository` mock and import.**

Add a new top-level `vi.mock` (no `.js` extension, matching existing counter mock pattern) and import (with `.js` extension, matching existing import pattern):

```ts
vi.mock('../../../db/repositories/user.repository', () => ({
    getUserById: vi.fn(),
}));

import * as userRepository from '../../../db/repositories/user.repository.js';
```

**4.1d — Add `buildUser` import from user fixture.**

```ts
import { buildUser } from '../fixtures/user.fixture.js';
```

**4.1e — Add default mock returns in `beforeEach` for existing tests.**

In the existing `beforeEach` block (which resets mocks), add these defaults so the guard passes for all existing POST tests (the existing auth mock sets `tier: 'PREMIUM'` on `req.user`, but the guard queries DB not JWT):

```ts
vi.mocked(userRepository.getUserById).mockResolvedValue(buildUser({ tier: 'PREMIUM' }));
vi.mocked(counterRepository.countByOwner).mockResolvedValue(0);
```

**4.1f — Add three new test cases** inside a new `describe('free-tier counter limit')` block nested under `describe('POST /counters')`:

```ts
describe('free-tier counter limit', () => {
    it('should return 403 when BASIC user has reached counter limit', async () => {
        vi.mocked(userRepository.getUserById).mockResolvedValue(buildUser({ tier: 'BASIC' }));
        vi.mocked(counterRepository.countByOwner).mockResolvedValue(MAX_FREE_COUNTERS);

        const res = await request(app)
            .post('/counters')
            .send(buildCounter({ title: 'Over Limit' }));
        expect(res.status).toBe(FORBIDDEN);
        expect(res.body.success).toBe(false);
    });

    it('should create counter when BASIC user is under the limit', async () => {
        vi.mocked(userRepository.getUserById).mockResolvedValue(buildUser({ tier: 'BASIC' }));
        vi.mocked(counterRepository.countByOwner).mockResolvedValue(MAX_FREE_COUNTERS - 1);
        vi.mocked(counterRepository.post).mockResolvedValue(buildCounter());

        const res = await request(app)
            .post('/counters')
            .send(buildCounter({ title: 'Under Limit' }));
        expect(res.status).toBe(CREATED);
        expect(res.body.success).toBe(true);
    });

    it('should create counter when PREMIUM user is at the limit', async () => {
        vi.mocked(userRepository.getUserById).mockResolvedValue(buildUser({ tier: 'PREMIUM' }));
        vi.mocked(counterRepository.countByOwner).mockResolvedValue(MAX_FREE_COUNTERS);
        vi.mocked(counterRepository.post).mockResolvedValue(buildCounter());

        const res = await request(app)
            .post('/counters')
            .send(buildCounter({ title: 'Premium User' }));
        expect(res.status).toBe(CREATED);
        expect(res.body.success).toBe(true);
    });
});
```

> **Important**: The implementer must inspect the existing test file to determine exact fixture usage (especially the `send()` body shape — it may need just `{ title, ... }` not a full `buildCounter()` return) and adjust accordingly.

- **Why**: Validates all three critical scenarios: BASIC at limit (blocked), BASIC under limit (allowed), PREMIUM at limit (allowed).

---

## File Change Summary

| #   | File Path                                                 | Change Type | Milestone |
| --- | --------------------------------------------------------- | ----------- | --------- |
| 1   | `packages/utils/src/constants/limits.ts`                  | New         | 1         |
| 2   | `packages/utils/src/constants/index.ts`                   | Modify      | 1         |
| 3   | `app/server/src/db/repositories/counter.repository.ts`    | Modify      | 2         |
| 4   | `app/server/src/api/controllers/counter.controller.ts`    | Modify      | 2         |
| 5   | `app/client/src/views/UpgradeView.vue`                    | New         | 3         |
| 6   | `app/client/src/router/index.ts`                          | Modify      | 3         |
| 7   | `app/client/src/views/HomeView.vue`                       | Modify      | 3         |
| 8   | `app/server/src/tests/integration/specs/counters.spec.ts` | Modify      | 4         |

**Files NOT touched** (per HL mandates):

- `counterStore.ts` — no guard added to `createCounter`
- `consolidateGuestCounters` logic — untouched
- `authStore.ts` — `isPremium` already exists, no changes needed
- JWT / auth middleware — tier is not added to token

---

## Reviewer Fixes Applied (v1 → v2)

| Issue | Fix Applied |
| --- | --- |
| 1. `computed` not imported in HomeView | Added `computed` to `import { ref, computed, onMounted, onUnmounted } from 'vue'` (Step 3.3a) |
| 2. Duplicate `useRouter` | Removed — noted `useRouter` and `router` already exist (line 4/38). Added explicit "DO NOT" notes (Step 3.3c) |
| 3. Test mock extension pattern | `vi.mock(...)` uses no `.js` extension; `import * as ...` uses `.js` extension (Step 4.1c) |
| 4. Default `beforeEach` mocks | Added `buildUser` import + `getUserById`/`countByOwner` defaults in `beforeEach` (Steps 4.1d–e) |

---

## Verification Steps

```bash
# 1. TypeScript — server
bun --filter=server run type-check

# 2. TypeScript — client
bun --filter=client run type-check

# 3. Server tests (including new counter limit tests)
bun --filter=server run test

# 4. Client unit tests
bun --filter=client run test:unit

# 5. Full test suite
bun run test

# 6. Client build verification
bun --filter=client run build
```
