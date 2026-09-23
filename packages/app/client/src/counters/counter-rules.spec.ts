import { describe, expect, it } from 'vitest';

import { isGuestCounterLimitReached, orderCounters, reconcileAuthenticatedCounters } from './counter-rules';

import type { ClientCounter, HexColor } from '@tally/core/client';

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
    it('removes stale local records after a server snapshot, but keeps guests for upload', () => {
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

        expect(result.counters).toEqual([remote, counter('guest', 'PERSONAL', 'user-1')]);
        expect(result.guestCounters).toEqual([counter('guest', 'PERSONAL', 'user-1')]);
        expect(reconcileAuthenticatedCounters(local, null, 'user-1').counters).toEqual([
            counter('guest', 'PERSONAL', 'user-1'),
            counter('duplicate', 'PERSONAL', 'user-1'),
            accepted,
        ]);
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

describe('isGuestCounterLimitReached', () => {
    it('allows three personal counters and ignores shared counters', () => {
        const counters = [counter('one', 'PERSONAL'), counter('shared', 'SHARED'), counter('two', 'PERSONAL')];

        expect(isGuestCounterLimitReached(counters)).toBe(false);
        expect(isGuestCounterLimitReached([...counters, counter('three', 'PERSONAL')])).toBe(true);
    });
});
