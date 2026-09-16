import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api';
import { SyncManager } from './sync-manager';

import type { MutationCommand } from './sync-queue';

const { apiError, apiFetch, authService, network, syncQueue } = vi.hoisted(() => {
    class MockApiError extends Error {
        constructor(
            message: string,
            public status?: number,
        ) {
            super(message);
        }
    }

    return {
        apiError: MockApiError,
        apiFetch: vi.fn(),
        authService: { getCachedUser: vi.fn() },
        network: { addNetworkStateListener: vi.fn(), getNetworkStateAsync: vi.fn() },
        syncQueue: { get: vi.fn(), remove: vi.fn() },
    };
});

vi.mock('../api', () => ({ ApiError: apiError, default: apiFetch }));
vi.mock('./auth.service', () => ({ AuthService: authService }));
vi.mock('./sync-queue', () => ({ SyncQueue: syncQueue }));
vi.mock('expo-network', () => network);

const command = (id: string, type: MutationCommand['type'] = 'CREATE'): MutationCommand => ({
    id,
    queuedByUserId: 'user-1',
    type,
    entityId: `counter-${id}`,
    payload: { title: id },
});

describe('SyncManager', () => {
    beforeEach(() => {
        SyncManager.dispose();
        SyncManager.syncRequested = false;
        apiFetch.mockReset();
        authService.getCachedUser.mockReset();
        network.addNetworkStateListener.mockReset();
        network.getNetworkStateAsync.mockReset();
        syncQueue.get.mockReset();
        syncQueue.remove.mockReset();
        network.getNetworkStateAsync.mockResolvedValue({ isConnected: true });
        authService.getCachedUser.mockResolvedValue({ id: 'user-1' });
        syncQueue.remove.mockResolvedValue(undefined);
    });

    it('leaves the queue untouched while offline', async () => {
        network.getNetworkStateAsync.mockResolvedValue({ isConnected: false });

        await expect(SyncManager.processQueuePass()).resolves.toBe(false);
        expect(syncQueue.get).not.toHaveBeenCalled();
    });

    it('processes only commands queued by the current user', async () => {
        syncQueue.get.mockResolvedValue([{ ...command('other'), queuedByUserId: 'user-2' }]);

        await expect(SyncManager.processQueuePass()).resolves.toBe(true);
        expect(apiFetch).not.toHaveBeenCalled();
        expect(syncQueue.remove).not.toHaveBeenCalled();
    });

    it.each(['DELETE', 'REMOVE'] as const)('completes an already-missing %s and continues the queue', async (type) => {
        syncQueue.get.mockResolvedValue([command('missing', type), command('good')]);
        apiFetch.mockRejectedValueOnce(new ApiError('Counter not found', 404)).mockResolvedValueOnce({ success: true });

        await expect(SyncManager.processQueuePass()).resolves.toBe(true);
        expect(syncQueue.remove).toHaveBeenCalledTimes(2);
        expect(syncQueue.remove).toHaveBeenNthCalledWith(1, 'missing');
        expect(syncQueue.remove).toHaveBeenNthCalledWith(2, 'good');
    });

    it.each([0, 401, 403, 404, 408, 422, 429, 500])('preserves failed writes after status %s', async (status) => {
        syncQueue.get.mockResolvedValue([command('retry'), command('later')]);
        apiFetch.mockRejectedValueOnce(new ApiError('Retry later', status));

        await expect(SyncManager.processQueuePass()).resolves.toBe(false);
        expect(apiFetch).toHaveBeenCalledOnce();
        expect(syncQueue.remove).not.toHaveBeenCalled();
    });

    it('reports a rejected create and retries the same queued write after recovery', async () => {
        let queue = [command('retry')];
        syncQueue.get.mockImplementation(async () => queue);
        syncQueue.remove.mockImplementation(async (id: string) => {
            queue = queue.filter((item) => item.id !== id);
        });
        const status = vi.fn();
        SyncManager.init(status);
        apiFetch.mockRejectedValueOnce(new ApiError('Invalid mutation', 422));

        await SyncManager.processQueue();
        expect(queue).toEqual([command('retry')]);
        expect(status).toHaveBeenLastCalledWith('error');

        apiFetch.mockResolvedValueOnce({ success: true });
        await SyncManager.processQueue();
        expect(queue).toEqual([]);
        expect(status).toHaveBeenLastCalledWith('idle');
        expect(apiFetch.mock.calls[1]).toEqual(apiFetch.mock.calls[0]);
    });

    it.each([
        ['CREATE', '/counters', 'POST'],
        ['UPDATE', '/counters/update/counter-command', 'PUT'],
        ['SET_COUNT', '/counters/counter-command/count', 'PUT'],
        ['INCREMENT', '/counters/increment/counter-command', 'PUT'],
        ['DELETE', '/counters/counter-command', 'DELETE'],
        ['REMOVE', '/counters/remove-shared/counter-command', 'PUT'],
    ] as const)('maps %s commands to their API contract', async (type, endpoint, method) => {
        const queued = command('command', type);

        await SyncManager.executeCommand(queued);

        expect(apiFetch).toHaveBeenCalledWith(
            endpoint,
            expect.objectContaining({
                method,
                headers: { 'X-Idempotency-Key': 'command' },
            }),
        );
    });
});
