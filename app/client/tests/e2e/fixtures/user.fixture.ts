import type { ClientUser } from '@packages/core';

export const TEST_USER_ID = crypto.randomUUID();
export const TEST_OTHER_USER_ID = crypto.randomUUID();

export const buildClientUser = (overrides: Partial<ClientUser> = {}): ClientUser => ({
    id: TEST_USER_ID,
    email: 'test@test.com',
    phone: null,
    tier: 'BASIC',
    ...overrides,
});
