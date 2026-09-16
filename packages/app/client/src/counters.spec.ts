import { describe, expect, it, vi } from 'vitest';

import {
    hasJoinedSharedCounter,
    isGuestCounterLimitReached,
    orderCounters,
    reconcileAuthenticatedCounters,
} from './counters';

import type { ClientCounter, HexColor } from '@tally/core/client';

vi.mock('expo-crypto', () => ({ getRandomBytes: vi.fn(), randomUUID: vi.fn() }));
vi.mock('react-native', () => ({ AppState: {} }));
vi.mock('./api', () => ({ getErrorMessage: (_error: unknown, fallback: string) => fallback }));
vi.mock('./services/counter.service', () => ({ CounterService: {} }));
vi.mock('./services/sync-manager', () => ({ SyncManager: {} }));
vi.mock('./services/sync-queue', () => ({ SyncQueue: {} }));
vi.mock('./socket', () => ({}));
vi.mock('./session', () => ({ useSession: vi.fn() }));

const counter = (id: string, type: ClientCounter['type'], userId = 'guest'): ClientCounter => ({
    id,
    title: id,
    color: '#000000' as HexColor,
    count: 0,
    metric: null,
    increment: 1,
    inviteCode: null,
    userId,
    type,
});

it('reorders current records without restoring deleted counters or losing new counters and live counts', () => {
    const first = counter('first', 'PERSONAL');
    const second = { ...counter('second', 'SHARED'), count: 9 };
    const added = counter('added', 'PERSONAL');
    expect(orderCounters([first, second, added], ['deleted', 'second', 'second', 'first'])).toEqual([
        second,
        first,
        added,
    ]);
});

describe('authenticated counter reconciliation', () => {
    it('keeps eligible local data, migrates guests, and lets remote data win duplicates', () => {
        const remote = { ...counter('duplicate', 'PERSONAL', 'user-1'), count: 7 };
        const accepted = {
            ...counter('accepted', 'SHARED', 'owner'),
            shares: [
                {
                    id: 'share-1',
                    counterId: 'accepted',
                    userId: 'user-1',
                    status: 'ACCEPTED' as const,
                    createdAt: new Date('2026-01-01'),
                    updatedAt: new Date('2026-01-01'),
                },
            ],
        };
        const local = [
            counter('guest', 'PERSONAL'),
            counter('duplicate', 'PERSONAL', 'user-1'),
            accepted,
            counter('foreign', 'PERSONAL', 'user-2'),
        ];

        const result = reconcileAuthenticatedCounters(local, [remote], 'user-1');

        expect(result.counters).toEqual([remote, counter('guest', 'PERSONAL', 'user-1'), accepted]);
        expect(result.guestCounters).toEqual([counter('guest', 'PERSONAL', 'user-1')]);
    });

    it('reports a failed sync when no remote snapshot is available', () => {
        expect(reconcileAuthenticatedCounters([], null, 'user-1').syncError).toBe(true);
    });

    it('keeps queued local changes and deletions during a remote refresh', () => {
        const local = { ...counter('pending', 'PERSONAL', 'user-1'), count: 5, metric: 'bottle' };
        const remote = [counter('pending', 'PERSONAL', 'user-1'), counter('deleted', 'PERSONAL', 'user-1')];
        const pending = [
            { id: 'update', queuedByUserId: 'user-1', type: 'UPDATE' as const, entityId: 'pending', payload: {} },
            { id: 'delete', queuedByUserId: 'user-1', type: 'DELETE' as const, entityId: 'deleted', payload: {} },
        ];

        expect(reconcileAuthenticatedCounters([local], remote, 'user-1', pending).counters).toEqual([local]);
    });
});

describe('hasJoinedSharedCounter', () => {
    it('counts joined shared counters but not shared counters owned by the user', () => {
        expect(hasJoinedSharedCounter([counter('owned', 'SHARED', 'user-1')], 'user-1')).toBe(false);
        expect(hasJoinedSharedCounter([counter('joined', 'SHARED', 'owner')], 'user-1')).toBe(true);
    });
});

describe('isGuestCounterLimitReached', () => {
    it('allows three personal counters and ignores shared counters', () => {
        const counters = [counter('one', 'PERSONAL'), counter('shared', 'SHARED'), counter('two', 'PERSONAL')];

        expect(isGuestCounterLimitReached(counters)).toBe(false);
        expect(isGuestCounterLimitReached([...counters, counter('three', 'PERSONAL')])).toBe(true);
    });
});
