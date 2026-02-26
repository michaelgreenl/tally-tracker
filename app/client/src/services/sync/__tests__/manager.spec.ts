import { UNAUTHORIZED, UNPROCESSABLE_ENTITY, SERVER_ERROR } from '@/constants/status-codes';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildCommand } from '../../../../tests/e2e/fixtures/counter.fixture';
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
    useAuthStore: vi.fn(() => ({
        logout: vi.fn(),
    })),
}));

import { Network } from '@capacitor/network';
import { SyncQueueService } from '../queue';
import apiFetch from '@/api';
import { SyncManager } from '../manager';
import { useAuthStore } from '@/stores/authStore';

describe('SyncManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        SyncManager.isSyncing = false;
    });

    describe('processQueue', () => {
        it('should skip processing if already syncing', async () => {
            SyncManager.isSyncing = true;

            await SyncManager.processQueue();

            expect(SyncQueueService.getQueue).not.toHaveBeenCalled();
        });

        it('should skip processing if offline', async () => {
            vi.mocked(Network.getStatus).mockResolvedValue({ connected: false, connectionType: 'none' });

            await SyncManager.processQueue();

            expect(SyncQueueService.getQueue).not.toHaveBeenCalled();
        });

        it('should process and remove successful commands', async () => {
            vi.mocked(Network.getStatus).mockResolvedValue({ connected: true, connectionType: 'wifi' });
            vi.mocked(SyncQueueService.getQueue).mockResolvedValue([buildCommand()]);
            vi.mocked(apiFetch).mockResolvedValue({ success: true });

            await SyncManager.processQueue();

            expect(apiFetch).toHaveBeenCalled();
            expect(SyncQueueService.removeCommand).toHaveBeenCalled();
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

        it('should stop processing and trigger logout on 401', async () => {
            const mockLogout = vi.fn();
            vi.mocked(useAuthStore).mockReturnValue({ logout: mockLogout } as any);

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

        it('should stop processing and keep commands on 5xx errors', async () => {
            vi.mocked(Network.getStatus).mockResolvedValue({ connected: true, connectionType: 'wifi' });
            vi.mocked(SyncQueueService.getQueue).mockResolvedValue([
                buildCommand({ id: 'cmd-1' }),
                buildCommand({ id: 'cmd-2' }),
            ]);
            vi.mocked(apiFetch).mockRejectedValue(new ApiError('Server error', SERVER_ERROR));

            await SyncManager.processQueue();

            expect(SyncQueueService.removeCommand).not.toHaveBeenCalled();
            expect(SyncManager.isSyncing).toBe(false);
        });

        it('should stop processing and keep commands on network errors', async () => {
            vi.mocked(Network.getStatus).mockResolvedValue({ connected: true, connectionType: 'wifi' });
            vi.mocked(SyncQueueService.getQueue).mockResolvedValue([buildCommand()]);
            vi.mocked(apiFetch).mockRejectedValue(new ApiError('Network Error', 0));

            await SyncManager.processQueue();

            expect(SyncQueueService.removeCommand).not.toHaveBeenCalled();
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

        it('should POST to /counters for CREATE', async () => {
            await SyncManager.executeCommand(buildCommand({ type: 'CREATE' }));

            expect(apiFetch).toHaveBeenCalledWith('/counters', expect.objectContaining({ method: 'POST' }));
        });

        it('should PUT to /counters/update/:id for UPDATE', async () => {
            await SyncManager.executeCommand(buildCommand({ type: 'UPDATE', entityId: 'counter-123' }));

            expect(apiFetch).toHaveBeenCalledWith(
                '/counters/update/counter-123',
                expect.objectContaining({ method: 'PUT' }),
            );
        });

        it('should PUT to /counters/increment/:id for INCREMENT', async () => {
            await SyncManager.executeCommand(
                buildCommand({ type: 'INCREMENT', entityId: 'counter-123', payload: { amount: 1 } }),
            );

            expect(apiFetch).toHaveBeenCalledWith(
                '/counters/increment/counter-123',
                expect.objectContaining({ method: 'PUT' }),
            );
        });

        it('should DELETE to /counters/:id for DELETE', async () => {
            await SyncManager.executeCommand(buildCommand({ type: 'DELETE', entityId: 'counter-123' }));

            expect(apiFetch).toHaveBeenCalledWith(
                '/counters/counter-123',
                expect.objectContaining({ method: 'DELETE' }),
            );
        });

        it('should PUT to /counters/remove-shared/:id for REMOVE', async () => {
            await SyncManager.executeCommand(buildCommand({ type: 'REMOVE', entityId: 'counter-123' }));

            expect(apiFetch).toHaveBeenCalledWith(
                '/counters/remove-shared/counter-123',
                expect.objectContaining({ method: 'PUT' }),
            );
        });
    });
});
