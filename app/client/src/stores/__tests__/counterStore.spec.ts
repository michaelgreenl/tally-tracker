import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import type { ClientCounter, HexColor } from '@tally/core';

const { auth } = vi.hoisted(() => ({
    auth: {
        isAuthenticated: false,
        user: null as { id: string; tier: 'BASIC' | 'PREMIUM' } | null,
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
import { BASIC_JOIN_LIMIT_MESSAGE, GUEST_COUNTER_LIMIT_MESSAGE, useCounterStore } from '../counterStore';

const signin = (tier: 'BASIC' | 'PREMIUM' = 'BASIC'): void => {
    auth.isAuthenticated = true;
    auth.user = { id: 'user-1', tier };
};

const counter = (overrides: Partial<ClientCounter> = {}): ClientCounter => ({
    id: 'counter-1',
    title: 'Counter',
    color: '#000000' as HexColor,
    count: 0,
    inviteCode: null,
    userId: 'user-1',
    type: 'PERSONAL',
    ...overrides,
});

beforeEach(() => {
    setActivePinia(createPinia());
    auth.isAuthenticated = false;
    auth.user = null;
    for (const method of Object.values(CounterService)) vi.mocked(method).mockReset();

    vi.mocked(CounterService.persist).mockResolvedValue(undefined);
    vi.mocked(CounterService.create).mockResolvedValue(undefined);
    vi.mocked(CounterService.clearLocalCounters).mockResolvedValue(undefined);
    vi.mocked(CounterService.getAllLocal).mockResolvedValue([]);
    vi.mocked(CounterService.fetchRemote).mockResolvedValue(null);
    vi.mocked(CounterService.increment).mockResolvedValue(undefined);
    vi.mocked(CounterService.update).mockResolvedValue(undefined);
    vi.mocked(CounterService.delete).mockResolvedValue(undefined);
    vi.mocked(CounterService.consolidate).mockResolvedValue(undefined);
    vi.mocked(CounterService.join).mockResolvedValue({ success: false, message: 'Join failed' });
});

describe('counterStore.eligibleCount', () => {
    it('counts only non-SHARED counters', async () => {
        const store = useCounterStore();

        await store.createCounter('Personal', null, 'PERSONAL');
        await store.createCounter('Shared', null, 'SHARED');

        expect(store.eligibleCount).toBe(1);
    });
});

describe('counterStore.createCounter', () => {
    it('allows three guest personal counters and blocks the fourth before persistence', async () => {
        const store = useCounterStore();

        await store.createCounter('One', null, 'PERSONAL');
        await store.createCounter('Two', null, 'PERSONAL');
        await store.createCounter('Three', null, 'PERSONAL');

        const calls = vi.mocked(CounterService.persist).mock.calls.length;
        const res = await store.createCounter('Four', null, 'PERSONAL');

        expect(res).toEqual({ success: false, message: GUEST_COUNTER_LIMIT_MESSAGE });
        expect(store.counters).toHaveLength(3);
        expect(store.counters.map((item) => item.title)).toEqual(['One', 'Two', 'Three']);
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
        signin();

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

describe('counterStore.consolidateGuestCounters', () => {
    it('consolidates persisted guest counters when an authenticated store starts empty', async () => {
        signin();
        const persistedGuestCounters = [
            counter({ id: 'guest-1', title: 'Guest One', userId: 'guest' }),
            counter({ id: 'guest-2', title: 'Guest Two', userId: 'guest' }),
            counter({ id: 'guest-3', title: 'Guest Three', userId: 'guest' }),
        ];
        const consolidatedCounters = persistedGuestCounters.map((item) => ({ ...item, userId: 'user-1' }));
        vi.mocked(CounterService.getAllLocal).mockResolvedValue(persistedGuestCounters);

        const store = useCounterStore();
        await store.consolidateGuestCounters();

        expect(CounterService.getAllLocal).toHaveBeenCalledTimes(1);
        expect(CounterService.consolidate).toHaveBeenCalledTimes(1);
        expect(CounterService.consolidate).toHaveBeenCalledWith(consolidatedCounters);
        expect(store.counters).toEqual(consolidatedCounters);
    });

    it("removes another user's persisted counters while retaining the current user's counters", async () => {
        signin();
        const currentUserCounter = counter({ id: 'current-1', title: 'Current', userId: 'user-1' });
        const otherUserCounter = counter({ id: 'other-1', title: 'Other', userId: 'user-2' });
        vi.mocked(CounterService.getAllLocal).mockResolvedValue([currentUserCounter, otherUserCounter]);

        const store = useCounterStore();
        await store.consolidateGuestCounters();

        expect(store.counters).toEqual([currentUserCounter]);
        expect(CounterService.persist).toHaveBeenCalledWith([currentUserCounter]);
        expect(CounterService.consolidate).not.toHaveBeenCalled();
    });

    it('preserves a persisted joined shared counter owned by another user', async () => {
        signin();
        const joinedCounter = counter({
            id: 'joined-1',
            type: 'SHARED',
            userId: 'owner-2',
            shares: [
                {
                    id: 'share-1',
                    status: 'ACCEPTED',
                    counterId: 'joined-1',
                    userId: 'user-1',
                    createdAt: new Date('2026-01-01'),
                    updatedAt: new Date('2026-01-01'),
                },
            ],
        });
        vi.mocked(CounterService.getAllLocal).mockResolvedValue([joinedCounter]);

        const store = useCounterStore();
        await store.consolidateGuestCounters();

        expect(store.counters).toEqual([joinedCounter]);
        expect(CounterService.persist).toHaveBeenCalledWith([joinedCounter]);
        expect(CounterService.consolidate).not.toHaveBeenCalled();
    });

    it('removes a foreign shared counter without an accepted share for the current user', async () => {
        signin();
        const foreignCounter = counter({
            id: 'foreign-shared-1',
            type: 'SHARED',
            userId: 'owner-2',
            shares: [
                {
                    id: 'share-rejected',
                    status: 'REJECTED',
                    counterId: 'foreign-shared-1',
                    userId: 'user-1',
                    createdAt: new Date('2026-01-01'),
                    updatedAt: new Date('2026-01-01'),
                },
                {
                    id: 'share-accepted-other',
                    status: 'ACCEPTED',
                    counterId: 'foreign-shared-1',
                    userId: 'user-3',
                    createdAt: new Date('2026-01-01'),
                    updatedAt: new Date('2026-01-01'),
                },
            ],
        });
        vi.mocked(CounterService.getAllLocal).mockResolvedValue([foreignCounter]);

        const store = useCounterStore();
        await store.consolidateGuestCounters();

        expect(store.counters).toEqual([]);
        expect(CounterService.persist).toHaveBeenCalledWith([]);
        expect(CounterService.consolidate).not.toHaveBeenCalled();
    });

    it('merges remote, guest, and current-user counters while consolidating only original guests', async () => {
        signin();
        const guestCounter = counter({ id: 'guest-1', title: 'Guest', userId: 'guest' });
        const currentUserCounter = counter({ id: 'current-1', title: 'Current', userId: 'user-1' });
        const otherUserCounter = counter({ id: 'other-1', title: 'Other', userId: 'user-2' });
        const remoteCounter = counter({ id: 'remote-1', title: 'Remote', userId: 'user-1' });
        const consolidatedGuest = { ...guestCounter, userId: 'user-1' };
        vi.mocked(CounterService.getAllLocal).mockResolvedValue([guestCounter, currentUserCounter, otherUserCounter]);
        vi.mocked(CounterService.fetchRemote).mockResolvedValue([remoteCounter]);

        const store = useCounterStore();
        await store.consolidateGuestCounters();

        const expectedCounters = [remoteCounter, consolidatedGuest, currentUserCounter];
        expect(store.counters).toEqual(expectedCounters);
        expect(CounterService.persist).toHaveBeenCalledWith(expectedCounters);
        expect(CounterService.consolidate).toHaveBeenCalledWith([consolidatedGuest]);
    });

    it('does not hydrate persisted counters for an unauthenticated store', async () => {
        vi.mocked(CounterService.getAllLocal).mockResolvedValue([
            counter({ id: 'guest-1', userId: 'guest' }),
            counter({ id: 'other-1', userId: 'user-2' }),
        ]);

        const store = useCounterStore();
        await store.consolidateGuestCounters();

        expect(store.counters).toEqual([]);
        expect(CounterService.getAllLocal).not.toHaveBeenCalled();
        expect(CounterService.persist).not.toHaveBeenCalled();
        expect(CounterService.consolidate).not.toHaveBeenCalled();
    });

    it('does not hydrate persisted counters without a current authenticated user id', async () => {
        auth.isAuthenticated = true;
        vi.mocked(CounterService.getAllLocal).mockResolvedValue([counter({ id: 'guest-1', userId: 'guest' })]);

        const store = useCounterStore();
        await store.consolidateGuestCounters();

        expect(store.counters).toEqual([]);
        expect(CounterService.getAllLocal).not.toHaveBeenCalled();
        expect(CounterService.persist).not.toHaveBeenCalled();
        expect(CounterService.consolidate).not.toHaveBeenCalled();
    });
});

describe('counterStore.joinCounter', () => {
    it('blocks BASIC users when hydrated counters already prove they joined a shared counter', async () => {
        signin();

        const store = useCounterStore();
        store.counters = [counter({ id: 'joined-1', type: 'SHARED', userId: 'owner-2' })];

        const res = await store.joinCounter('invite-1');

        expect(res).toEqual({ success: false, message: BASIC_JOIN_LIMIT_MESSAGE });
        expect(CounterService.getAllLocal).not.toHaveBeenCalled();
        expect(CounterService.join).not.toHaveBeenCalled();
        expect(store.loading).toBe(false);
    });

    it('blocks BASIC users from persisted counters when the store starts empty', async () => {
        signin();
        vi.mocked(CounterService.getAllLocal).mockResolvedValue([
            counter({ id: 'joined-1', type: 'SHARED', userId: 'owner-2' }),
        ]);

        const store = useCounterStore();
        const res = await store.joinCounter('invite-1');

        expect(res).toEqual({ success: false, message: BASIC_JOIN_LIMIT_MESSAGE });
        expect(CounterService.getAllLocal).toHaveBeenCalledTimes(1);
        expect(store.counters.map((item) => item.id)).toEqual(['joined-1']);
        expect(CounterService.join).not.toHaveBeenCalled();
        expect(CounterService.persist).not.toHaveBeenCalled();
        expect(store.loading).toBe(false);
    });

    it('ignores owned shared counters for BASIC users', async () => {
        signin();
        vi.mocked(CounterService.join).mockResolvedValue({ success: false, message: 'Server denied' });

        const store = useCounterStore();
        store.counters = [counter({ id: 'owned-1', type: 'SHARED', userId: 'user-1' })];

        const res = await store.joinCounter('invite-1');

        expect(res).toEqual({ success: false, message: 'Server denied' });
        expect(CounterService.join).toHaveBeenCalledWith('invite-1');
    });

    it('falls through to the server for PREMIUM users', async () => {
        signin('PREMIUM');
        vi.mocked(CounterService.join).mockResolvedValue({
            success: true,
            data: {
                counter: counter({ id: 'joined-2', type: 'SHARED', userId: 'owner-2' }),
            },
        });

        const store = useCounterStore();
        store.counters = [counter({ id: 'joined-1', type: 'SHARED', userId: 'owner-3' })];

        const res = await store.joinCounter('invite-1');

        expect(res).toEqual({ success: true });
        expect(CounterService.join).toHaveBeenCalledWith('invite-1');
    });

    it('falls through to the server for unauthenticated users', async () => {
        vi.mocked(CounterService.join).mockResolvedValue({ success: false, message: 'Invite expired' });

        const store = useCounterStore();
        store.counters = [counter({ id: 'joined-1', type: 'SHARED', userId: 'owner-2' })];

        const res = await store.joinCounter('invite-1');

        expect(res).toEqual({ success: false, message: 'Invite expired' });
        expect(CounterService.join).toHaveBeenCalledWith('invite-1');
    });

    it('falls through to the server when local state cannot prove the BASIC cap', async () => {
        signin();
        vi.mocked(CounterService.join).mockResolvedValue({ success: false, message: 'Invite invalid' });

        const store = useCounterStore();
        const res = await store.joinCounter('invite-1');

        expect(res).toEqual({ success: false, message: 'Invite invalid' });
        expect(CounterService.getAllLocal).toHaveBeenCalledTimes(1);
        expect(CounterService.join).toHaveBeenCalledWith('invite-1');
    });

    it('keeps successful joins deduplicated', async () => {
        signin('PREMIUM');
        const joined = counter({ id: 'joined-1', type: 'SHARED', userId: 'owner-2' });
        vi.mocked(CounterService.join).mockResolvedValue({
            success: true,
            data: { counter: joined },
        });

        const store = useCounterStore();
        store.counters = [joined];

        const res = await store.joinCounter('invite-1');

        expect(res).toEqual({ success: true });
        expect(store.counters).toHaveLength(1);
        expect(CounterService.persist).not.toHaveBeenCalled();
    });

    it('preserves cached counters on direct-link join success', async () => {
        signin('PREMIUM');
        const cached = counter({ id: 'cached-1', title: 'Cached', userId: 'user-1' });
        const joined = counter({ id: 'joined-1', title: 'Joined', type: 'SHARED', userId: 'owner-2' });
        vi.mocked(CounterService.getAllLocal).mockResolvedValue([cached]);
        vi.mocked(CounterService.join).mockResolvedValue({
            success: true,
            data: { counter: joined },
        });

        const store = useCounterStore();
        const res = await store.joinCounter('invite-1');

        expect(res).toEqual({ success: true });
        expect(CounterService.join).toHaveBeenCalledWith('invite-1');
        expect(store.counters.map((item) => item.id)).toEqual(['cached-1', 'joined-1']);
        expect(CounterService.persist).toHaveBeenCalledTimes(1);
        expect(CounterService.persist).toHaveBeenCalledWith([cached, joined]);
    });
});
