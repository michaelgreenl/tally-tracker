import { randomUUID } from 'crypto';

import type { CounterShare, RefreshToken } from '@prisma/client';
import type { CounterTypeType as CounterType } from '../../types/shared/generated/index.js';

export const TEST_COUNTER_ID = randomUUID();
export const TEST_USER_ID = randomUUID();
export const TEST_OTHER_USER_ID = randomUUID();
export const TEST_SHARE_ID = randomUUID();
export const TEST_REFRESH_TOKEN_ID = randomUUID();

export const buildCounter = (overrides: Record<string, any> = {}) => ({
    id: TEST_COUNTER_ID,
    title: 'Test Counter',
    count: 0,
    color: null,
    type: 'PERSONAL' as CounterType,
    inviteCode: null,
    userId: TEST_USER_ID,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    shares: [] as CounterShare[],
    owner: { id: TEST_USER_ID, email: 'test@test.com' },
    ...overrides,
});

export const buildShare = (overrides: Partial<CounterShare> = {}): CounterShare => ({
    id: TEST_SHARE_ID,
    status: 'ACCEPTED',
    counterId: TEST_COUNTER_ID,
    userId: TEST_OTHER_USER_ID,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
});

export const buildRefreshToken = (overrides: Partial<RefreshToken> = {}): RefreshToken => ({
    id: TEST_REFRESH_TOKEN_ID,
    userId: TEST_USER_ID,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    createdAt: new Date('2026-01-01'),
    ...overrides,
});
