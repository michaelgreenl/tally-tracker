import { describe, expect, it, vi } from 'vitest';

import { isGuestCounterLimitReached } from './counters';

import type { ClientCounter, HexColor } from '@tally/core/client';

vi.mock('expo-crypto', () => ({ getRandomBytes: vi.fn(), randomUUID: vi.fn() }));
vi.mock('./api', () => ({ getErrorMessage: (_error: unknown, fallback: string) => fallback }));
vi.mock('./services/counter.service', () => ({ CounterService: {} }));
vi.mock('./services/sync-manager', () => ({ SyncManager: {} }));
vi.mock('./socket', () => ({}));
vi.mock('./session', () => ({ useSession: vi.fn() }));

const counter = (id: string, type: ClientCounter['type']): ClientCounter => ({
    id,
    title: id,
    color: '#000000' as HexColor,
    count: 0,
    inviteCode: null,
    userId: 'guest',
    type,
});

describe('isGuestCounterLimitReached', () => {
    it('allows three personal counters and ignores shared counters', () => {
        const counters = [counter('one', 'PERSONAL'), counter('shared', 'SHARED'), counter('two', 'PERSONAL')];

        expect(isGuestCounterLimitReached(counters)).toBe(false);
        expect(isGuestCounterLimitReached([...counters, counter('three', 'PERSONAL')])).toBe(true);
    });
});
