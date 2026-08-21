import type { ClientCounter } from '@tally/core';
import type { HexColor } from '@tally/core';

export const buildCounter = (overrides: Partial<ClientCounter> = {}): ClientCounter => ({
    id: crypto.randomUUID(),
    title: 'Test Counter',
    count: 0,
    color: '#000000' as HexColor,
    type: 'PERSONAL',
    inviteCode: null,
    userId: crypto.randomUUID(),
    ...overrides,
});

export const buildSharedCounter = (overrides: Partial<ClientCounter> = {}): ClientCounter =>
    buildCounter({
        type: 'SHARED',
        inviteCode: 'ABC12345',
        ...overrides,
    });
