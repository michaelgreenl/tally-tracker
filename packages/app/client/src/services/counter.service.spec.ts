import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CounterService } from './counter.service';

import type { ClientCounter, HexColor } from '@tally/core/client';

const { addCommand, processQueue } = vi.hoisted(() => ({
    addCommand: vi.fn(),
    processQueue: vi.fn(),
}));

vi.mock('expo-crypto', () => ({ randomUUID: () => 'command-1' }));
vi.mock('../api', () => ({ default: vi.fn() }));
vi.mock('./auth.service', () => ({
    AuthService: { getCachedUser: () => Promise.resolve({ id: 'user-1' }) },
}));
vi.mock('./counter-storage', () => ({ CounterStorage: {} }));
vi.mock('./sync-manager', () => ({ SyncManager: { processQueue } }));
vi.mock('./sync-queue', () => ({ SyncQueue: { add: addCommand } }));

const counter = (type: ClientCounter['type']): ClientCounter => ({
    id: 'counter-1',
    title: 'Counter',
    color: '#000000' as HexColor,
    count: 4,
    inviteCode: type === 'SHARED' ? 'invite-1' : null,
    userId: 'user-1',
    type,
});

describe('CounterService.increment', () => {
    beforeEach(() => {
        addCommand.mockReset();
        addCommand.mockResolvedValue(undefined);
        processQueue.mockReset();
    });

    it.each([
        { type: 'PERSONAL' as const, command: 'SET_COUNT', payload: { count: 4 } },
        { type: 'SHARED' as const, command: 'INCREMENT', payload: { amount: 1 } },
    ])('queues the $command contract for a $type counter', async ({ type, command, payload }) => {
        await CounterService.increment(counter(type), 1);

        expect(addCommand).toHaveBeenCalledWith({
            id: 'command-1',
            queuedByUserId: 'user-1',
            type: command,
            entity: 'counter',
            entityId: 'counter-1',
            payload,
            timestamp: expect.any(Number),
        });
        expect(processQueue).toHaveBeenCalledOnce();
    });
});
