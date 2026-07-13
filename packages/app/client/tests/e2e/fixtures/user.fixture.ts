import type { ClientUser } from '@tally/core';

export const buildClientUser = (overrides: Partial<ClientUser> = {}): ClientUser => ({
    id: crypto.randomUUID(),
    email: 'test@test.com',
    tier: 'BASIC',
    ...overrides,
});
