import type { ClientCounter } from '@packages/core';
import type { HexColor } from '@packages/core';
import type { MutationCommand } from '@/services/sync/types';

export const TEST_COUNTER_ID = crypto.randomUUID();
export const TEST_USER_ID = crypto.randomUUID();

export const buildCounter = (overrides: Partial<ClientCounter> = {}): ClientCounter => ({
    id: TEST_COUNTER_ID,
    title: 'Test Counter',
    count: 0,
    color: '#000000' as HexColor,
    type: 'PERSONAL',
    inviteCode: null,
    userId: TEST_USER_ID,
    ...overrides,
});

export const buildSharedCounter = (overrides: Partial<ClientCounter> = {}): ClientCounter =>
    buildCounter({
        type: 'SHARED',
        inviteCode: 'ABC12345',
        ...overrides,
    });

export const buildCommand = (overrides: Partial<MutationCommand> = {}): MutationCommand => ({
    id: crypto.randomUUID(),
    type: 'CREATE',
    entity: 'counter',
    entityId: TEST_COUNTER_ID,
    payload: { title: 'Test Counter' },
    timestamp: Date.now(),
    retryCount: 0,
    ...overrides,
});
