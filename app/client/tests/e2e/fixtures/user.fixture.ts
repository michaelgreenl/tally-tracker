import type { ClientUser } from '@tally/core';

export const TEST_USER_ID = crypto.randomUUID();
export const TEST_OTHER_USER_ID = crypto.randomUUID();

export const buildClientUser = (overrides: Partial<ClientUser> = {}): ClientUser => ({
    id: TEST_USER_ID,
    email: 'test@test.com',
    tier: 'BASIC',
    ...overrides,
});
