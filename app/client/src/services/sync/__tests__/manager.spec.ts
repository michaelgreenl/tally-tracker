import { UNAUTHORIZED, NOT_FOUND, UNPROCESSABLE_ENTITY, SERVER_ERROR } from '@tally/utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildCommand, TEST_USER_ID } from '@/test/fixtures/sync.fixture';
import { ApiError } from '@/utils/errors';

vi.mock('@capacitor/network', () => ({
    Network: {
        getStatus: vi.fn(),
        addListener: vi.fn(),
    },
}));

vi.mock('@/services/sync/queue', () => ({
    SyncQueueService: {
        getQueue: vi.fn(),
        removeCommand: vi.fn(),
    },
}));

vi.mock('@/api', () => ({
    default: vi.fn(),
}));

vi.mock('@/stores/authStore', () => ({
    useAuthStore: vi.fn(),
}));

import { Network } from '@capacitor/network';
import { SyncQueueService } from '../queue';
import apiFetch from '@/api';
import { SyncManager } from '../manager';
import { useAuthStore } from '@/stores/authStore';

type SyncAuthDependencies = Pick<ReturnType<typeof useAuthStore>, 'user' | 'logout'>;

const useAuthStoreMock = vi.mocked(useAuthStore, { partial: true });

const buildAuthStoreDouble = ({
    userId = TEST_USER_ID,
    logout = vi.fn(),
}: {
    userId?: string | null;
    logout?: SyncAuthDependencies['logout'];
} = {}): SyncAuthDependencies =>
    ({
        user: userId === null ? null : { id: userId, email: 'test@test.com', tier: 'BASIC' as const },
        logout,
    }) satisfies SyncAuthDependencies;

describe('SyncManager', () => {
    beforeEach(() => {
        vi.mocked(Network.getStatus).mockReset();
        vi.mocked(Network.addListener).mockReset();
        vi.mocked(SyncQueueService.getQueue).mockReset();
        vi.mocked(SyncQueueService.removeCommand).mockReset();
        vi.mocked(apiFetch).mockReset();
        useAuthStoreMock.mockReset();
        SyncManager.isSyncing = false;
        SyncManager.syncRequested = false;
        useAuthStoreMock.mockReturnValue(buildAuthStoreDouble());
    });

    describe('processQueue', () => {
        it('should skip processing if already syncing', async () => {
            SyncManager.isSyncing = true;

            await SyncManager.processQueue();

            expect(SyncManager.syncRequested).toBe(true);
            expect(SyncQueueService.getQueue).not.toHaveBeenCalled();
        });

        it('should skip processing if offline', async () => {
            vi.mocked(Network.getStatus).mockResolvedValue({ connected: false, connectionType: 'none' });

            await SyncManager.processQueue();

            expect(SyncQueueService.getQueue).not.toHaveBeenCalled();
        });

        it('should process and remove successful commands, including replayed idempotency responses', async () => {
            vi.mocked(Network.getStatus).mockResolvedValue({ connected: true, connectionType: 'wifi' });
            vi.mocked(SyncQueueService.getQueue).mockResolvedValue([buildCommand()]);
            vi.mocked(apiFetch).mockResolvedValue({
                success: true,
                message: 'Counter updated successfully',
                data: { counter: { id: 'counter-123' } },
            });

            await SyncManager.processQueue();

            expect(apiFetch).toHaveBeenCalled();
            expect(SyncQueueService.removeCommand).toHaveBeenCalled();
            expect(SyncManager.isSyncing).toBe(false);
        });

        it('should process commands added while a sync pass is active', async () => {
            const firstCommand = buildCommand({ id: 'first-command' });
            const secondCommand = buildCommand({ id: 'second-command' });
            let resolveFirstRequest: (value: unknown) => void = () => undefined;

            vi.mocked(Network.getStatus).mockResolvedValue({ connected: true, connectionType: 'wifi' });
            vi.mocked(SyncQueueService.getQueue)
                .mockResolvedValueOnce([firstCommand])
                .mockResolvedValueOnce([secondCommand]);
            vi.mocked(apiFetch)
                .mockImplementationOnce(
                    () =>
                        new Promise((resolve) => {
                            resolveFirstRequest = resolve;
                        }),
                )
                .mockResolvedValueOnce({ success: true });

            const activeSync = SyncManager.processQueue();
            await vi.waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));

            await SyncManager.processQueue();
            resolveFirstRequest({ success: true });
            await activeSync;

            expect(apiFetch).toHaveBeenCalledTimes(2);
            expect(SyncQueueService.removeCommand).toHaveBeenCalledWith('first-command');
            expect(SyncQueueService.removeCommand).toHaveBeenCalledWith('second-command');
            expect(SyncManager.isSyncing).toBe(false);
            expect(SyncManager.syncRequested).toBe(false);
        });

        it('should process only commands queued by the current user', async () => {
            const currentUserCommand = buildCommand({ id: 'current-user-command' });
            const otherUserCommand = buildCommand({ id: 'other-user-command', queuedByUserId: 'other-user' });

            vi.mocked(Network.getStatus).mockResolvedValue({ connected: true, connectionType: 'wifi' });
            vi.mocked(SyncQueueService.getQueue).mockResolvedValue([otherUserCommand, currentUserCommand]);
            vi.mocked(apiFetch).mockResolvedValue({ success: true });

            await SyncManager.processQueue();

            expect(apiFetch).toHaveBeenCalledTimes(1);
            expect(SyncQueueService.removeCommand).toHaveBeenCalledTimes(1);
            expect(SyncQueueService.removeCommand).toHaveBeenCalledWith('current-user-command');
        });

        it('should keep queued commands when there is no authenticated user', async () => {
            useAuthStoreMock.mockReturnValue(buildAuthStoreDouble({ userId: null }));

            vi.mocked(Network.getStatus).mockResolvedValue({ connected: true, connectionType: 'wifi' });
            vi.mocked(SyncQueueService.getQueue).mockResolvedValue([buildCommand()]);

            await SyncManager.processQueue();

            expect(apiFetch).not.toHaveBeenCalled();
            expect(SyncQueueService.removeCommand).not.toHaveBeenCalled();
            expect(SyncManager.isSyncing).toBe(false);
        });

        it('should remove command and continue on 4xx errors (except 401)', async () => {
            const cmd1 = buildCommand({ id: 'cmd-1' });
            const cmd2 = buildCommand({ id: 'cmd-2' });

            vi.mocked(Network.getStatus).mockResolvedValue({ connected: true, connectionType: 'wifi' });
            vi.mocked(SyncQueueService.getQueue).mockResolvedValue([cmd1, cmd2]);
            vi.mocked(apiFetch)
                .mockRejectedValueOnce(new ApiError('Validation failed', UNPROCESSABLE_ENTITY))
                .mockResolvedValueOnce({ success: true });

            await SyncManager.processQueue();

            expect(SyncQueueService.removeCommand).toHaveBeenCalledTimes(2);
        });

        it('should remove a stale DELETE command and continue processing the queue', async () => {
            const staleDelete = buildCommand({ id: 'stale-delete', type: 'DELETE', entityId: 'counter-123' });
            const nextCommand = buildCommand({ id: 'next-command' });

            vi.mocked(Network.getStatus).mockResolvedValue({ connected: true, connectionType: 'wifi' });
            vi.mocked(SyncQueueService.getQueue).mockResolvedValue([staleDelete, nextCommand]);
            vi.mocked(apiFetch)
                .mockRejectedValueOnce(new ApiError('Counter not found', NOT_FOUND))
                .mockResolvedValueOnce({ success: true });

            await SyncManager.processQueue();

            expect(apiFetch).toHaveBeenCalledWith(
                '/counters/counter-123',
                expect.objectContaining({ method: 'DELETE' }),
            );
            expect(SyncQueueService.removeCommand).toHaveBeenCalledTimes(2);
            expect(SyncQueueService.removeCommand).toHaveBeenCalledWith('stale-delete');
            expect(SyncQueueService.removeCommand).toHaveBeenCalledWith('next-command');
        });

        it('should stop processing and trigger logout on 401', async () => {
            const mockLogout = vi.fn();
            useAuthStoreMock.mockReturnValue(buildAuthStoreDouble({ logout: mockLogout }));

            vi.mocked(Network.getStatus).mockResolvedValue({ connected: true, connectionType: 'wifi' });
            vi.mocked(SyncQueueService.getQueue).mockResolvedValue([
                buildCommand({ id: 'cmd-1' }),
                buildCommand({ id: 'cmd-2' }),
            ]);
            vi.mocked(apiFetch).mockRejectedValue(new ApiError('Unauthorized', UNAUTHORIZED));

            await SyncManager.processQueue();

            expect(SyncQueueService.removeCommand).not.toHaveBeenCalled();
            expect(mockLogout).toHaveBeenCalledWith(false);
            expect(SyncManager.isSyncing).toBe(false);
        });

        it.each([
            { failure: 'network', error: new ApiError('Network Error', 0) },
            { failure: '5xx', error: new ApiError('Server error', SERVER_ERROR) },
        ])('should stop processing and keep commands on $failure errors', async ({ error }) => {
            vi.mocked(Network.getStatus).mockResolvedValue({ connected: true, connectionType: 'wifi' });
            vi.mocked(SyncQueueService.getQueue).mockResolvedValue([
                buildCommand({ id: 'cmd-1' }),
                buildCommand({ id: 'cmd-2' }),
            ]);
            vi.mocked(apiFetch).mockRejectedValue(error);

            await SyncManager.processQueue();

            expect(apiFetch).toHaveBeenCalledTimes(1);
            expect(SyncQueueService.removeCommand).not.toHaveBeenCalled();
            expect(SyncManager.isSyncing).toBe(false);
        });

        it('should include idempotency key header', async () => {
            const command = buildCommand({ id: 'unique-cmd-id' });

            vi.mocked(Network.getStatus).mockResolvedValue({ connected: true, connectionType: 'wifi' });
            vi.mocked(SyncQueueService.getQueue).mockResolvedValue([command]);
            vi.mocked(apiFetch).mockResolvedValue({ success: true });

            await SyncManager.processQueue();

            expect(apiFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: { 'X-Idempotency-Key': 'unique-cmd-id' },
                }),
            );
        });
    });

    describe('executeCommand', () => {
        beforeEach(() => {
            vi.mocked(apiFetch).mockResolvedValue({ success: true });
        });

        it.each([
            {
                type: 'CREATE' as const,
                endpoint: '/counters',
                method: 'POST',
                payload: { id: 'counter-123', title: 'Created', count: 0, type: 'PERSONAL' },
            },
            {
                type: 'UPDATE' as const,
                endpoint: '/counters/update/counter-123',
                method: 'PUT',
                payload: { title: 'Updated' },
            },
            {
                type: 'SET_COUNT' as const,
                endpoint: '/counters/counter-123/count',
                method: 'PUT',
                payload: { count: -1 },
            },
            {
                type: 'INCREMENT' as const,
                endpoint: '/counters/increment/counter-123',
                method: 'PUT',
                payload: { amount: 2 },
            },
            {
                type: 'DELETE' as const,
                endpoint: '/counters/counter-123',
                method: 'DELETE',
                payload: {},
            },
            {
                type: 'REMOVE' as const,
                endpoint: '/counters/remove-shared/counter-123',
                method: 'PUT',
                payload: {},
            },
        ])('maps $type to its exact request contract', async ({ type, endpoint, method, payload }) => {
            await SyncManager.executeCommand(
                buildCommand({ id: 'idempotency-key', type, entityId: 'counter-123', payload }),
            );

            expect(apiFetch).toHaveBeenCalledTimes(1);
            expect(apiFetch).toHaveBeenCalledWith(endpoint, {
                method,
                ...(type === 'DELETE' || type === 'REMOVE' ? {} : { body: payload }),
                headers: { 'X-Idempotency-Key': 'idempotency-key' },
            });
        });
    });
});
