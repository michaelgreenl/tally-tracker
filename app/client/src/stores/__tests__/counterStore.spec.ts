import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const { auth } = vi.hoisted(() => ({
    auth: {
        isAuthenticated: false,
        user: null as { id: string } | null,
    },
}));

vi.mock('@/stores/authStore', () => ({
    useAuthStore: () => auth,
}));

vi.mock('@/services/counter.service', () => ({
    CounterService: {
        persist: vi.fn(),
        create: vi.fn(),
        clearLocalCounters: vi.fn(),
        getAllLocal: vi.fn(),
        fetchRemote: vi.fn(),
        increment: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        consolidate: vi.fn(),
        join: vi.fn(),
    },
}));

import { CounterService } from '@/services/counter.service';
import { GUEST_COUNTER_LIMIT_MESSAGE, useCounterStore } from '../counterStore';

describe('counterStore.eligibleCount', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        auth.isAuthenticated = false;
        auth.user = null;
        vi.clearAllMocks();
        vi.mocked(CounterService.persist).mockResolvedValue(undefined);
        vi.mocked(CounterService.create).mockResolvedValue(undefined);
    });

    it('counts only non-SHARED counters', async () => {
        const store = useCounterStore();

        await store.createCounter('Personal', null, 'PERSONAL');
        await store.createCounter('Shared', null, 'SHARED');

        expect(store.eligibleCount).toBe(1);
    });

    it('reflects zero when no eligible counters exist', () => {
        const store = useCounterStore();
        expect(store.eligibleCount).toBe(0);
    });
});

describe('counterStore.createCounter', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        auth.isAuthenticated = false;
        auth.user = null;
        vi.clearAllMocks();
        vi.mocked(CounterService.persist).mockResolvedValue(undefined);
        vi.mocked(CounterService.create).mockResolvedValue(undefined);
    });

    it('allows three guest personal counters and blocks the fourth before persistence', async () => {
        const store = useCounterStore();

        await store.createCounter('One', null, 'PERSONAL');
        await store.createCounter('Two', null, 'PERSONAL');
        await store.createCounter('Three', null, 'PERSONAL');

        const calls = vi.mocked(CounterService.persist).mock.calls.length;
        const res = await store.createCounter('Four', null, 'PERSONAL');

        expect(res).toEqual({ success: false, message: GUEST_COUNTER_LIMIT_MESSAGE });
        expect(store.counters).toHaveLength(3);
        expect(store.counters.map((counter) => counter.title)).toEqual(['One', 'Two', 'Three']);
        expect(CounterService.persist).toHaveBeenCalledTimes(calls);
        expect(CounterService.create).not.toHaveBeenCalled();
    });

    it('ignores shared counters when enforcing the guest cap', async () => {
        const store = useCounterStore();

        await store.createCounter('Shared One', null, 'SHARED');
        await store.createCounter('Shared Two', null, 'SHARED');
        await store.createCounter('Shared Three', null, 'SHARED');

        const res = await store.createCounter('Personal One', null, 'PERSONAL');

        expect(res.success).toBe(true);
        expect(store.counters).toHaveLength(4);
        expect(store.counters[3]).toMatchObject({ title: 'Personal One', type: 'PERSONAL' });
        expect(CounterService.create).not.toHaveBeenCalled();
    });

    it('keeps authenticated create behavior unchanged', async () => {
        auth.isAuthenticated = true;
        auth.user = { id: 'user-1' };

        const store = useCounterStore();
        const res = await store.createCounter('Owned', null, 'PERSONAL');

        expect(res.success).toBe(true);
        expect(store.counters).toHaveLength(1);
        expect(CounterService.persist).toHaveBeenCalledTimes(1);
        expect(CounterService.create).toHaveBeenCalledTimes(1);
        expect(CounterService.create).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Owned',
                userId: 'user-1',
                type: 'PERSONAL',
                inviteCode: null,
            }),
        );
    });
});
