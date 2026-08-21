import type { MutationCommand } from '@/services/sync/types';

export const TEST_COUNTER_ID = 'counter-123';
export const TEST_USER_ID = 'user-123';

export const buildCommand = (overrides: Partial<MutationCommand> = {}): MutationCommand => ({
    id: 'command-123',
    queuedByUserId: TEST_USER_ID,
    type: 'CREATE',
    entity: 'counter',
    entityId: TEST_COUNTER_ID,
    payload: { title: 'Test Counter' },
    timestamp: 1_700_000_000_000,
    ...overrides,
});
