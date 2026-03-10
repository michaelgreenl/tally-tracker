# Context: guest-counter-limit Initiative

> Generated for `high-level-0002`. Documents the actual current state of every file the plan touches or references.

---

## 1. Shared Constants (`packages/utils/`)

### Directory structure

```
packages/utils/src/
  constants/
    index.ts       ← exists
    status-codes.ts ← exists
  index.ts         ← exists
```

**No `limits.ts` file exists yet.** `MAX_FREE_COUNTERS` does not currently exist anywhere in the codebase.

### `packages/utils/src/constants/status-codes.ts`

All HTTP status constants are here. The `FORBIDDEN` constant (403) already exists:

```ts
export const OK = 200;
export const CREATED = 201;
export const OK_NO_CONTENT = 204;
export const BAD_REQUEST = 400;
export const UNAUTHORIZED = 401;
export const FORBIDDEN = 403; // ← already defined, plan can use it
export const NOT_FOUND = 404;
export const REQUEST_TIMEOUT = 408;
export const CONFLICT = 409;
export const UNPROCESSABLE_ENTITY = 422;
export const SERVER_ERROR = 500;
```

### `packages/utils/src/constants/index.ts`

Single line — re-exports everything from `status-codes.ts`:

```ts
export * from './status-codes.ts';
```

**The plan requires adding `export * from './limits.ts';` to this file.**

### `packages/utils/src/index.ts`

Single line — re-exports everything from the constants barrel:

```ts
export * from './constants/index.ts';
```

The chain is: `limits.ts` → `constants/index.ts` → `src/index.ts` → consumers. Adding `export * from './limits.ts'` to `constants/index.ts` is the only required wiring change.

### Observation

The plan's note about verifying the re-export chain is valid — the chain requires one edit to `constants/index.ts`. The server uses NodeNext module resolution, but the existing `constants/index.ts` already uses `.ts` extensions (`'./status-codes.ts'`), so the new limits import should follow the same pattern: `'./limits.ts'`.

---

## 2. Server: Counter Controller (`app/server/src/api/controllers/counter.controller.ts`)

### Current imports

```ts
import { CREATED, BAD_REQUEST, NOT_FOUND, CONFLICT, SERVER_ERROR } from '@packages/utils';
import * as counterRepository from '../../db/repositories/counter.repository.js';
import type { Request, Response } from 'express';
import type { ShareStatusType } from '@packages/core';
import type { CounterResponse } from '@packages/core';
import type {
    CreateCounterRequest,
    UpdateCounterRequest,
    IncrementCounterRequest,
    JoinCounterRequest,
    UpdateShareRequest,
} from '@packages/core';
```

`FORBIDDEN` is **not imported**. The plan requires adding it.

No `userRepository` import exists currently. The plan requires adding one.

### `post` handler (full, current)

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

The guard insertion point is **after the `!userId` check and before `counterRepository.post()`**.

### `req.user` shape

Defined by the Express namespace augmentation in `packages/core/src/types/requests.d.ts`:

```ts
declare global {
    namespace Express {
        interface Request {
            user?: ClientUser;
        }
    }
}
```

`ClientUser` is `Omit<User, 'password' | 'createdAt' | 'updatedAt'>` which includes `id`, `email`, `phone`, and `tier`.

**However**, the JWT payload signed in `user.controller.ts → login` is:

```ts
jwt.sign({ id: user.id, email: user.email, phone: user.phone }, ...)
```

`tier` is **NOT in the JWT payload**. The `jwt.verify()` result is assigned directly to `req.user`. Therefore at runtime, `req.user.tier` is `undefined` even though the TypeScript type says it exists. This confirms **AD-3** in the plan: the controller must DB-query for tier and cannot rely on `req.user.tier`.

In integration tests, `req.user` is mocked with `tier` explicitly:

- `counters.spec.ts`: `req.user = { id: TEST_USER_ID, email: 'test@test.com', tier: 'PREMIUM' }`
- `sharing.spec.ts`: `req.user = { id: TEST_USER_ID, email: 'test@test.com', tier: 'BASIC' }`

### Route middleware stack for `POST /counters`

```ts
router.use(jwt);
router.use(idempotency);
router.post('/', validate(createCounterSchema), post);
```

The `idempotency` middleware runs before `post`. The new limit guard will be inside the `post` handler itself (not a separate middleware), so the idempotency layer is already satisfied before the guard runs.

---

## 3. Server: Counter Repository (`app/server/src/db/repositories/counter.repository.ts`)

### All exported functions

| Function | Signature | Notes |
| --- | --- | --- |
| `post` | `({ id?, userId, title, count?, color?, type?, inviteCode? }) => Promise<Counter>` | Creates a counter |
| `remove` | `({ counterId, userId }) => Promise<Counter>` | Hard delete |
| `getAllByUser` | `(userId: string) => Promise<Counter[]>` | Owned + accepted shares |
| `getByIdOrShare` | `({ counterId, userId }) => Promise<Counter \| null>` | Auth check |
| `getParticipants` | `(counterId: string) => Promise<string[]>` | Owner + accepted sharers |
| `put` | `({ counterId, userId, data }) => Promise<Counter \| null>` | Update |
| `increment` | `({ counterId, userId, amount }) => Promise<Counter \| null>` | Atomic increment |
| `join` | `(inviteCode: string) => Promise<Counter \| null>` | Lookup by invite code |
| `createShare` | `({ counterId, userId, status }) => Promise<CounterShare>` | Create share record |
| `updateShare` | `({ counterId, userId, status }) => Promise<CounterShare>` | Update share by compound key |

**`countAccessibleByUser` does not exist yet.**

### `getAllByUser` — the exact `OR` clause the plan mirrors

```ts
export const getAllByUser = async (userId: string) =>
    prisma.counter.findMany({
        where: {
            OR: [
                { userId: userId },
                {
                    shares: {
                        some: {
                            userId: userId,
                            status: 'ACCEPTED' as ShareStatusType,
                        },
                    },
                },
            ],
        },
        include: {
            shares: true,
            owner: { select: { email: true, id: true } },
        },
        orderBy: { updatedAt: 'desc' },
    });
```

The plan's proposed `countAccessibleByUser` replaces `findMany` with `prisma.counter.count()` and drops the `include`/`orderBy` — correct for a count query.

### Import pattern in repository

```ts
import prisma from '../prisma.js';
import { Prisma } from '@prisma/client';
import type { ShareStatusType, CounterTypeType as CounterType } from '@packages/core';
```

The `.js` extension is used on the prisma import. New function will use the same existing imports — no new imports required.

---

## 4. Server: User Repository (`app/server/src/db/repositories/user.repository.ts`)

### `getUserById` — returns `tier`

```ts
const userSelectSchema = {
    id: true,
    email: true,
    phone: true,
    tier: true, // ← included
    createdAt: true,
    updatedAt: true,
};

export const getUserById = (userId: string) =>
    prisma.user.findUnique({
        where: { id: userId },
        select: {
            ...userSelectSchema,
            sharedCounters: {
                select: { status: true, counter: true },
            },
        },
    });
```

`getUserById` returns `tier`. The plan's controller guard can call `userRepository.getUserById(userId)` and read `.tier`. Return type is `{ id, email, phone, tier, createdAt, updatedAt, sharedCounters } | null`.

### All exported functions

| Function         | Signature                                                         |
| ---------------- | ----------------------------------------------------------------- |
| `createUser`     | `({ email?, phone?, password }) => Promise<User>`                 |
| `deleteUser`     | `(userId: string) => Promise<User>`                               |
| `getAllUsers`    | `({ limit, offset }) => Promise<User[]>`                          |
| `getUserById`    | `(userId: string) => Promise<User \| null>`                       |
| `getUserByEmail` | `(email: string) => Promise<User \| null>`                        |
| `getUserByPhone` | `(phone: string) => Promise<User \| null>`                        |
| `updateUserInfo` | `(userId: string, data: Prisma.UserUpdateInput) => Promise<true>` |

---

## 5. Prisma Schema

### `User` model (`packages/core/prisma/schema/user.prisma`)

```prisma
enum UserTier {
    PREMIUM
    BASIC
}

model User {
    id       String   @id @default(uuid()) @db.Uuid
    email    String?  @unique
    phone    String?  @unique
    password String
    tier     UserTier @default(BASIC)   // ← exists, default BASIC

    counters       Counter[]      @relation("OwnedCounters")
    sharedCounters CounterShare[] @relation("ReceivedShares")
    refreshTokens  RefreshToken[] @relation("RefreshTokens")

    createdAt DateTime @default(now()) @map("created_at")
    updatedAt DateTime @updatedAt @map("updated_at")

    @@map("users")
}
```

`tier` field and `UserTier` enum confirmed. No migration needed.

### `Counter` model (`packages/core/prisma/schema/counter.prisma`)

```prisma
model Counter {
    id         String      @id @default(uuid())
    title      String
    count      Int         @default(0)
    color      String?
    type       CounterType @default(PERSONAL)
    inviteCode String?     @unique @map("invite_code")

    userId String @map("user_id") @db.Uuid
    owner  User   @relation("OwnedCounters", fields: [userId], references: [id], onDelete: Cascade)

    shares CounterShare[]

    createdAt DateTime @default(now()) @map("created_at")
    updatedAt DateTime @updatedAt @map("updated_at")

    @@map("counters")
}
```

`userId` field confirmed. `shares` relation confirmed (used in `countAccessibleByUser`'s `some` clause).

### `CounterShare` model

```prisma
enum ShareStatus {
    PENDING
    ACCEPTED
    REJECTED
}

model CounterShare {
    id     String      @id @default(uuid())
    status ShareStatus @default(PENDING)

    counterId String  @map("counter_id")
    counter   Counter @relation(fields: [counterId], references: [id], onDelete: Cascade)

    userId String @map("user_id") @db.Uuid
    user   User   @relation("ReceivedShares", fields: [userId], references: [id], onDelete: Cascade)

    createdAt DateTime @default(now()) @map("created_at")
    updatedAt DateTime @updatedAt @map("updated_at")

    @@unique([counterId, userId])
    @@map("counter_shares")
}
```

`userId`, `status`, and the compound unique `[counterId, userId]` confirmed.

### Generated Zod types (`packages/core/src/types/generated/index.ts`)

- `UserTierSchema = z.enum(['PREMIUM','BASIC'])` — exists
- `type UserTierType = 'PREMIUM' | 'BASIC'` — exists
- `ShareStatusSchema = z.enum(['PENDING','ACCEPTED','REJECTED'])` — exists
- `type ShareStatusType = 'PENDING' | 'ACCEPTED' | 'REJECTED'` — exists (used in plan's `countAccessibleByUser`)

No regeneration of generated types is needed.

---

## 6. Client: Types

### `ClientUser` (`packages/core/src/types/models.d.ts`)

```ts
export type ClientUser = Omit<User, 'password' | 'createdAt' | 'updatedAt'>;
```

Where `User` comes from the generated schema (which includes `tier: UserTier`). Therefore `ClientUser` includes `id`, `email`, `phone`, and `tier`. The `tier` field is present on `ClientUser`.

### `ClientCounter` (`packages/core/src/types/models.d.ts`)

```ts
export type ClientCounter = Omit<Counter, 'createdAt' | 'updatedAt' | 'color'> & {
    color: HexColor | null;
    shares?: CounterShare[];
};
```

Fields: `id`, `title`, `count`, `color` (typed as `HexColor | null`), `type`, `inviteCode`, `userId`, `shares?`.

---

## 7. Client: Auth Store (`app/client/src/stores/authStore.ts`)

### Relevant state and computed

```ts
const user = ref<ClientUser | null>(null);
const isAuthenticated = computed(() => !!user.value);
const isPremium = computed(() => user.value?.tier === 'PREMIUM');
```

`isPremium` already exists and computes correctly from `user.tier`. The plan's gate condition `!authStore.isPremium` is directly usable.

### `user` ref type

`ClientUser | null` — includes `tier`.

### `login` flow (relevant to consolidation)

```ts
await counterStore.consolidateGuestCounters();
```

Called after successful login. Guest counters are synced via `CounterService.consolidate()` which queues `CREATE` commands through the sync queue.

---

## 8. Client: Counter Store (`app/client/src/stores/counterStore.ts`)

### `counters` ref

```ts
const counters = ref<ClientCounter[]>([]);
```

### How `counters` is populated (the `init` function)

```ts
async function init() {
    counters.value = await CounterService.getAllLocal(); // local storage first

    if (!isGuest.value) {
        const remoteCounters = await CounterService.fetchRemote(); // GET /counters
        if (remoteCounters) {
            const remoteIds = new Set(remoteCounters.map((c) => c.id));
            const pendingLocal = counters.value.filter((c) => !remoteIds.has(c.id));
            counters.value = [...remoteCounters, ...pendingLocal];
            await saveState();
        }
    }
}
```

`CounterService.fetchRemote()` calls `GET /counters` which maps to `counterController.getAllByUser` → `counterRepository.getAllByUser(userId)`. That query returns **owned + accepted-shared** counters. Therefore `counterStore.counters` includes both owned and shared counters when authenticated.

**The plan's claim that `counterStore.counters.length` includes shared counters is confirmed correct.**

### `createCounter` — optimistic pattern

```ts
async function createCounter(title, color, type): Promise<StoreResponse> {
    const newCounter: ClientCounter = { id: randomUUID(), title, color, count: 0, userId: ..., type, inviteCode };
    counters.value.push(newCounter);       // ← optimistic local add
    await saveState();

    if (!isGuest.value) await CounterService.create(newCounter);  // ← enqueues to sync queue

    return ok();
}
```

The optimistic push happens **before** the server call. If the server returns 403, the local counter already exists. The sync queue will continue retrying the failed `CREATE` command. This is the "offline/optimistic creation" edge case documented in the plan's Milestone 4 risks.

### `consolidateGuestCounters`

```ts
async function consolidateGuestCounters() {
    // ...
    if (newGuestCounters.length > 0) {
        await CounterService.consolidate(newGuestCounters, authStore.user?.id || '');
    }
}
```

`CounterService.consolidate` loops through guest counters and queues individual `CREATE` commands. The server will accept up to the limit and reject the rest with 403. The sync queue retries indefinitely — no specific handling of 403 responses exists in the sync layer.

---

## 9. Client: Counter Service (`app/client/src/services/counter.service.ts`)

### `create` method — uses sync queue (not direct API call)

```ts
async create(counter: ClientCounter) {
    await SyncQueueService.addCommand({
        id: randomUUID(),
        type: 'CREATE',
        entity: 'counter',
        entityId: counter.id,
        payload: { id, title, color, count, type, inviteCode },
        timestamp: Date.now(),
        retryCount: 0,
    });
    SyncManager.processQueue();
}
```

Counter creation is **not** a direct `apiFetch` call — it goes through `SyncQueueService` → `SyncManager`. The `SyncManager.processQueue()` sends the actual HTTP request. A 403 response from the server will be received by the sync manager's processing logic. The plan's concern about the sync queue retrying on 403 is valid — whether the sync manager treats 403 as a permanent failure or retries it is relevant context (but the sync manager source was not read here).

### `join` method — direct API call (not sync queue)

```ts
async join(inviteCode: string) {
    const res = await apiFetch<CounterResponse, JoinCounterRequest>('/counters/join', {
        method: 'POST',
        body: { inviteCode },
    });
    return res;
}
```

The `join` endpoint is synchronous (no sync queue). This is consistent with the plan noting the `join` endpoint is not gated by the limit.

---

## 10. Client: HomeView (`app/client/src/views/HomeView.vue`)

### "Add Counter" button — current implementation

```html
<BaseButton v-if="!showCounterForm" @click="showCounterForm = true">Add counter</BaseButton>
```

The click handler is an inline assignment `showCounterForm = true`. The plan requires this to be replaced with a named function `handleAddCounter()` that branches on the premium/limit check.

### Current reactive state in `<script setup>`

```ts
const showCounterForm = ref(false);
const counterToUpdate = ref<ClientCounter | null>(null);
```

`showUpgradeModal` does not exist yet.

### Current Ionic component imports

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

`IonModal` is **not imported**. The plan requires adding it.

### Current store/composable imports

```ts
import { useAuthStore } from '@/stores/authStore';
import { useCounterStore } from '@/stores/counterStore';
```

Both stores are already imported. `authStore.isPremium` and `counterStore.counters` are directly accessible.

No import from `@packages/utils` currently exists in `HomeView.vue`. The plan requires adding `import { MAX_FREE_COUNTERS } from '@packages/utils'`.

---

## 11. Client: Router (`app/client/src/router/index.ts`)

### Current routes

```ts
const routes: Array<RouteRecordRaw> = [
    { path: '/', redirect: '/login' },
    { path: '/login', name: 'Login', component: LoginView, meta: { title: 'Login' } },
    { path: '/register', name: 'Register', component: RegisterView, meta: { title: 'Register' } },
    { path: '/home', name: 'Home', component: HomeView },
    { path: '/join', name: 'Join', component: JoinView },
];
```

No `/upgrade` route exists. The plan requires adding one.

### Route guard pattern

```ts
router.beforeEach(async (to, from, next) => {
    if (!authStore.isAuthenticated && to.meta.requiresAuth) {
        next('/login');
    } else if (authStore.isAuthenticated && (to.path === '/login' || to.path === '/register')) {
        next('/home');
    } else {
        next();
    }
});
```

Routes without `meta.requiresAuth` are accessible to anyone (including unauthenticated users). The plan's AD-6 specifies no `requiresAuth` on `/upgrade` — consistent with the existing pattern for `/join`.

### Import pattern for views

All views are imported at the top of the file (`import HomeView from '@/views/HomeView.vue'`). New `UpgradeView` will need to follow this pattern.

---

## 12. Server Integration Tests (`app/server/src/tests/integration/`)

### `counters.spec.ts` — mock setup pattern

```ts
vi.mock('../../../middleware/auth.middleware', () => ({
    jwt: (req, res, next) => {
        req.user = { id: TEST_USER_ID, email: 'test@test.com', tier: 'PREMIUM' };
        next();
    },
}));

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

vi.mock('../../../db/repositories/idempotency.repository', () => ({
    get: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
}));
```

**Important observations for new limit tests:**

1. The auth mock in `counters.spec.ts` hardcodes `tier: 'PREMIUM'`. The new limit tests need to override this with `tier: 'BASIC'` for tests that verify limit enforcement. This requires either a separate `describe` block with its own `vi.mock` call, or a `beforeEach` that re-mocks the middleware differently.
2. `counter.repository` is fully mocked — `countAccessibleByUser` will need to be added to the mock object when it's added to the repository.
3. `user.repository` is **not currently mocked** in `counters.spec.ts`. The controller currently doesn't call it, so it wasn't needed. The new guard will call `userRepository.getUserById()`, so a `vi.mock('../../../db/repositories/user.repository')` block will be required in the updated test file.
4. The idempotency repository is mocked to return `null` (no cached response) — new tests don't need to change this.

### `counters.spec.ts` — existing `POST /counters` tests

```ts
describe('POST /counters', () => {
    it('should create a personal counter', ...)
    it('should create a shared counter with invite code', ...)
    it('should reject shared counter without invite code', ...)
    it('should reject empty title', ...)
    it('should reject title over 50 characters', ...)
});
```

Five existing tests. None test the limit. The auth mock uses `tier: 'PREMIUM'` — existing tests are unaffected by the new guard because PREMIUM users skip the count check.

### Server fixture files

**`counter.fixture.ts`:**

```ts
export const TEST_COUNTER_ID = randomUUID();
export const TEST_USER_ID = randomUUID();
export const TEST_OTHER_USER_ID = randomUUID();
export const TEST_SHARE_ID = randomUUID();

export const buildCounter = (overrides = {}) => ({
    id: TEST_COUNTER_ID,
    title: 'Test Counter',
    count: 0,
    color: null,
    type: 'PERSONAL',
    inviteCode: null,
    userId: TEST_USER_ID,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    shares: [] as CounterShare[],
    owner: { id: TEST_USER_ID, email: 'test@test.com' },
    ...overrides,
});

export const buildShare = (overrides: Partial<CounterShare> = {}): CounterShare => ({
    id: TEST_SHARE_ID,
    status: 'ACCEPTED',
    counterId: TEST_COUNTER_ID,
    userId: TEST_OTHER_USER_ID,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
});
```

**`user.fixture.ts`:**

```ts
export const buildUser = (overrides: Partial<User> = {}): User => ({
    id: TEST_USER_ID,
    email: 'test@test.com',
    phone: null,
    password: hashedPassword,
    tier: 'BASIC', // ← default is BASIC
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
});

export const buildClientUser = (overrides: Partial<ClientUser> = {}): ClientUser => ({
    id: TEST_USER_ID,
    email: 'test@test.com',
    phone: null,
    tier: 'BASIC',
    ...overrides,
});
```

`buildUser` is not currently used in `counters.spec.ts` but is available. `buildUser({ tier: 'PREMIUM' })` and `buildUser({ tier: 'BASIC' })` are ready to use for mocking `getUserById` return values.

---

## 13. E2E Tests (Client)

### Directory structure

```
app/client/tests/e2e/
  specs/
    auth.cy.ts
    counters.cy.ts
    sharing.cy.ts
  fixtures/
    user.fixture.ts   ← exists, BASIC tier default
    counter.fixture.ts ← exists
  support/
    commands.ts
    e2e.ts
    status-codes.ts
```

### `app/client/tests/e2e/fixtures/user.fixture.ts`

```ts
export const buildClientUser = (overrides: Partial<ClientUser> = {}): ClientUser => ({
    id: TEST_USER_ID,
    email: 'test@test.com',
    phone: null,
    tier: 'BASIC',
    ...overrides,
});
```

A `PREMIUM` fixture variant can be built with `buildClientUser({ tier: 'PREMIUM' })` — no new file needed, just a call-site override.

### `counters.cy.ts` — "Add Counter" button selector

```ts
cy.contains('ion-button:visible', 'Add counter').click();
```

New E2E tests for the modal flow can follow this same selector pattern.

---

## 14. Discrepancies and Observations

| Area | Plan Assumes | Actual State |
| --- | --- | --- |
| `req.user.tier` | Not in JWT payload (AD-3 correctly notes this) | Confirmed: JWT is signed with `{ id, email, phone }` only. `tier` is absent from the token. `req.user.tier` is `undefined` at runtime despite TypeScript type saying otherwise. |
| `FORBIDDEN` constant | Exists in `@packages/utils` | Confirmed — already in `status-codes.ts`. |
| `getAllByUser` OR pattern | Assumed to be the pattern to mirror | Confirmed — exact `OR` clause exists in `counter.repository.ts`. |
| `getUserById` returns `tier` | Assumed | Confirmed — `tier: true` in `userSelectSchema`. |
| `isPremium` computed | Assumed to exist in `authStore` | Confirmed — `computed(() => user.value?.tier === 'PREMIUM')`. |
| `counterStore.counters` includes shared | Assumed (AD-4) | Confirmed — `fetchRemote()` calls `GET /counters` → `getAllByUser` which uses the same OR clause. |
| `user.repository` mock in tests | Not addressed in existing test | Not currently mocked in `counters.spec.ts`. New tests that trigger `getUserById` in the controller will need `vi.mock('../../../db/repositories/user.repository', ...)` added. |
| `countAccessibleByUser` in test mock | Not addressed in existing test | The `vi.mock` for `counter.repository` will need `countAccessibleByUser: vi.fn()` added when the function is introduced. |
| Auth mock tier in `counters.spec.ts` | Tests assume BASIC user hits limit | Current mock is `tier: 'PREMIUM'`. Existing `POST /counters` tests pass because PREMIUM skips the guard. New BASIC-tier limit tests need a different auth mock setup (separate `describe` with its own mock, or `beforeEach` override). |
| `IonModal` import | Plan adds it | Not present in `HomeView.vue` currently. |
| `@packages/utils` import in `HomeView.vue` | Plan adds it | Not present in `HomeView.vue` currently. |
| `UpgradeView.vue` | New file | Does not exist. |
| `/upgrade` route | New route | Does not exist in router. |
| `limits.ts` | New file | Does not exist. |
| `countAccessibleByUser` in repo | New function | Does not exist. |
| `showUpgradeModal` ref | New state | Does not exist in `HomeView.vue`. |
| E2E `user.fixture.ts` modification | "May need PREMIUM variant" | `buildClientUser({ tier: 'PREMIUM' })` works as-is with override — no file modification may be needed. |
