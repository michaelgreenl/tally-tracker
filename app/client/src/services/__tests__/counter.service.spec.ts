import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ClientCounter, HexColor } from '@tally/core';

vi.mock('@/services/storage.service', () => ({
    LocalStorageService: {},
}));

vi.mock('@/services/sync/queue', () => ({
    SyncQueueService: {
        addCommand: vi.fn(),
    },
}));

vi.mock('@/services/sync/manager', () => ({
    SyncManager: {
        processQueue: vi.fn(),
    },
}));

vi.mock('@/stores/authStore', () => ({
    useAuthStore: vi.fn(),
}));

vi.mock('@/utils/safeUUID', () => ({
    randomUUID: vi.fn(() => 'command-1'),
}));

import { CounterService } from '../counter.service';
import { SyncQueueService } from '@/services/sync/queue';
import { SyncManager } from '@/services/sync/manager';
import { useAuthStore } from '@/stores/authStore';
import { randomUUID } from '@/utils/safeUUID';

type CounterAuthDependencies = Pick<ReturnType<typeof useAuthStore>, 'isAuthenticated' | 'user'>;

const useAuthStoreMock = vi.mocked(useAuthStore, { partial: true });

const buildCounter = (overrides: Partial<ClientCounter> = {}): ClientCounter => ({
    id: 'counter-1',
    title: 'Counter',
    count: 0,
    color: '#000000' as HexColor,
    type: 'PERSONAL',
    inviteCode: null,
    userId: 'user-1',
    ...overrides,
});

const authenticatedStore = (userId = 'user-1'): CounterAuthDependencies =>
    ({
        isAuthenticated: true,
        user: { id: userId, email: 'test@test.com', tier: 'BASIC' },
    }) satisfies CounterAuthDependencies;

beforeEach(() => {
    vi.mocked(SyncQueueService.addCommand).mockReset();
    vi.mocked(SyncQueueService.addCommand).mockResolvedValue(undefined);
    vi.mocked(SyncManager.processQueue).mockReset();
    useAuthStoreMock.mockReset();
    useAuthStoreMock.mockReturnValue(authenticatedStore());
    vi.mocked(randomUUID).mockReset();
    vi.mocked(randomUUID).mockReturnValue('command-1');
});

describe('CounterService.increment', () => {
    it.each([0, -1])('queues SET_COUNT with absolute personal count %i', async (count) => {
        await CounterService.increment(buildCounter({ count }), -1);

        expect(SyncQueueService.addCommand).toHaveBeenCalledWith({
            id: 'command-1',
            queuedByUserId: 'user-1',
            type: 'SET_COUNT',
            entity: 'counter',
            entityId: 'counter-1',
            payload: { count },
            timestamp: expect.any(Number),
        });
        expect(SyncManager.processQueue).toHaveBeenCalledTimes(1);
    });

    it('queues INCREMENT with a delta for shared counters', async () => {
        await CounterService.increment(buildCounter({ type: 'SHARED', count: 5 }), 1);

        expect(SyncQueueService.addCommand).toHaveBeenCalledWith({
            id: 'command-1',
            queuedByUserId: 'user-1',
            type: 'INCREMENT',
            entity: 'counter',
            entityId: 'counter-1',
            payload: { amount: 1 },
            timestamp: expect.any(Number),
        });
        expect(SyncManager.processQueue).toHaveBeenCalledTimes(1);
    });
});

describe('CounterService.delete', () => {
    it.each([
        { relationship: 'owner', ownerId: 'user-1', commandType: 'DELETE' },
        { relationship: 'participant', ownerId: 'owner-2', commandType: 'REMOVE' },
    ] as const)(
        'queues $commandType when the current user is the counter $relationship',
        async ({ ownerId, commandType }) => {
            await CounterService.delete(buildCounter({ type: 'SHARED', userId: ownerId }));

            expect(SyncQueueService.addCommand).toHaveBeenCalledWith({
                id: 'command-1',
                queuedByUserId: 'user-1',
                type: commandType,
                entity: 'counter',
                entityId: 'counter-1',
                payload: {},
                timestamp: expect.any(Number),
            });
            expect(SyncManager.processQueue).toHaveBeenCalledTimes(1);
        },
    );
});
