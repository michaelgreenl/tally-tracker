import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CounterService } from './counter.service';
import apiFetch from '../api';

import type { ClientCounter, HexColor } from '@tally/core/client';

const { addCommand, processQueue, getQueue } = vi.hoisted(() => ({
    addCommand: vi.fn(),
    processQueue: vi.fn(),
    getQueue: vi.fn(),
}));

vi.mock('expo-crypto', () => ({ randomUUID: () => 'command-1' }));
vi.mock('../api', () => ({ default: vi.fn() }));
vi.mock('./auth.service', () => ({
    AuthService: { getCachedUser: () => Promise.resolve({ id: 'user-1' }) },
}));
vi.mock('./counter-storage', () => ({ CounterStorage: {} }));
vi.mock('./sync-manager', () => ({ SyncManager: { processQueue } }));
vi.mock('./sync-queue', () => ({ SyncQueue: { add: addCommand, get: getQueue } }));

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
        { type: 'PERSONAL' as const, command: 'INCREMENT', payload: { amount: 1 } },
        { type: 'SHARED' as const, command: 'INCREMENT', payload: { amount: 1 } },
    ])('queues the $command contract for a $type counter', async ({ type, command, payload }) => {
        await CounterService.increment(counter(type), 1);

        expect(addCommand).toHaveBeenCalledWith({
            id: 'command-1',
            queuedByUserId: 'user-1',
            type: command,
            entityId: 'counter-1',
            payload,
        });
        expect(processQueue).toHaveBeenCalledOnce();
    });
});

describe('CounterService.share', () => {
    beforeEach(() => vi.resetAllMocks());

    it('does not issue an invite while this counter has pending changes', async () => {
        getQueue.mockResolvedValue([{ entityId: 'counter-1', queuedByUserId: 'user-1' }]);

        await expect(CounterService.share('counter-1')).rejects.toThrow('Wait for this counter to sync');
        expect(apiFetch).not.toHaveBeenCalled();
    });

    it('waits for the sync pass before requesting the server-issued link', async () => {
        let finishSync!: () => void;
        processQueue.mockImplementation(
            () =>
                new Promise<void>((resolve) => {
                    finishSync = resolve;
                }),
        );
        getQueue.mockResolvedValue([]);
        const response = { success: true, data: { counter: counter('SHARED') } };
        vi.mocked(apiFetch).mockResolvedValue(response);

        const sharing = CounterService.share('counter-1');
        await vi.waitFor(() => expect(finishSync).toBeTypeOf('function'));
        expect(apiFetch).not.toHaveBeenCalled();
        finishSync();

        await expect(sharing).resolves.toEqual(response);
        expect(apiFetch).toHaveBeenCalledWith('/counters/counter-1/share', { method: 'POST' });
    });
});
