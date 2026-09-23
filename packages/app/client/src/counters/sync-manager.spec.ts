import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api';
import { SyncManager } from './sync-manager';
import { changeSession, SessionChangedError } from '../session/session-scope';
import { SyncQueue } from './sync-queue';

import type { MutationCommand } from './sync-queue';
import type { SyncStatus } from './sync-manager';

const { apiError, apiFetch, authService, network, storage } = vi.hoisted(() => {
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
        storage: new Map<string, string>(),
    };
});

vi.mock('../api', () => ({ ApiError: apiError, default: apiFetch }));
vi.mock('../session/auth.service', () => ({ AuthService: authService }));
vi.mock('@react-native-async-storage/async-storage', () => ({
    default: {
        getItem: async (key: string) => storage.get(key) ?? null,
        setItem: async (key: string, value: string) => {
            storage.set(key, value);
        },
    },
}));
vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));
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
        changeSession('user-1');
        SyncManager.dispose();
        SyncManager.syncRequested = false;
        apiFetch.mockReset();
        authService.getCachedUser.mockReset();
        network.addNetworkStateListener.mockReset();
        network.getNetworkStateAsync.mockReset();
        storage.clear();
        network.getNetworkStateAsync.mockResolvedValue({ isConnected: true });
        authService.getCachedUser.mockResolvedValue({ id: 'user-1' });
    });

    it('leaves the queue untouched while offline', async () => {
        network.getNetworkStateAsync.mockResolvedValue({ isConnected: false });
        await SyncQueue.save([command('offline')]);

        await expect(SyncManager.processQueuePass()).resolves.toBe(false);
        expect(await SyncQueue.get()).toEqual([command('offline')]);
        expect(apiFetch).not.toHaveBeenCalled();
    });

    it('processes only commands queued by the current user', async () => {
        await SyncQueue.save([{ ...command('other'), queuedByUserId: 'user-2' }]);

        await expect(SyncManager.processQueuePass()).resolves.toBe(true);
        expect(apiFetch).not.toHaveBeenCalled();
        expect(await SyncQueue.get()).toEqual([{ ...command('other'), queuedByUserId: 'user-2' }]);
    });

    it('cannot send a command owned by a different session', async () => {
        await expect(
            SyncManager.executeCommand({ ...command('other'), queuedByUserId: 'user-2' }),
        ).rejects.toBeInstanceOf(SessionChangedError);
        expect(apiFetch).not.toHaveBeenCalled();
    });

    it('does not leave the guest screen loading while an old account finishes syncing', async () => {
        await SyncQueue.save([command('pending')]);
        let finish!: () => void;
        apiFetch.mockReturnValueOnce(
            new Promise<void>((resolve) => {
                finish = resolve;
            }),
        );
        const pending = SyncManager.processQueue();
        await vi.waitFor(() => expect(apiFetch).toHaveBeenCalledOnce());
        changeSession();
        const guestStatus = vi.fn();
        SyncManager.init(guestStatus);
        finish();
        await pending;
        expect(guestStatus).toHaveBeenLastCalledWith('idle');
        expect(guestStatus).not.toHaveBeenCalledWith('syncing');
    });

    it('stops an old account’s queued writes after an account switch', async () => {
        const queue = [command('first'), command('second')];
        await SyncQueue.save(queue);
        apiFetch.mockImplementationOnce(async () => {
            changeSession('user-2');
            authService.getCachedUser.mockResolvedValue({ id: 'user-2' });
            return { success: true };
        });
        await expect(SyncManager.processQueuePass()).rejects.toBeInstanceOf(SessionChangedError);
        expect(apiFetch).toHaveBeenCalledOnce();
        expect(await SyncQueue.get()).toEqual(queue);
        await SyncManager.processQueuePass();
        expect(apiFetch).toHaveBeenCalledOnce();
    });

    it('reports syncing only while this account has queued writes', async () => {
        const statuses: SyncStatus[] = [];
        SyncManager.init((status) => statuses.push(status));
        await SyncQueue.save([]);
        await SyncManager.processQueue();
        await SyncQueue.save([{ ...command('other'), queuedByUserId: 'user-2' }]);
        await SyncManager.processQueue();
        expect(statuses).not.toContain('syncing');

        await SyncQueue.save([command('mine')]);
        let finish!: () => void;
        apiFetch.mockReturnValue(
            new Promise<void>((resolve) => {
                finish = resolve;
            }),
        );
        const pending = SyncManager.processQueue();
        try {
            await vi.waitFor(() => expect(statuses.at(-1)).toBe('syncing'));
        } finally {
            finish();
            await pending;
        }
        expect(statuses.at(-1)).toBe('idle');
    });

    it.each(['DELETE', 'REMOVE'] as const)('completes an already-missing %s and continues the queue', async (type) => {
        await SyncQueue.save([command('missing', type), command('good')]);
        apiFetch.mockRejectedValueOnce(new ApiError('Counter not found', 404)).mockResolvedValueOnce({ success: true });

        await expect(SyncManager.processQueuePass()).resolves.toBe(true);
        expect(await SyncQueue.get()).toEqual([]);
    });

    it.each([0, 401, 408, 429, 500])(
        'stops transient failures without changing request identity after status %s',
        async (status) => {
            await SyncQueue.save([command('retry'), command('later')]);
            apiFetch.mockRejectedValueOnce(new ApiError('Retry later', status));

            await expect(SyncManager.processQueuePass()).resolves.toBe(false);
            expect(apiFetch).toHaveBeenCalledOnce();
            expect(await SyncQueue.get()).toEqual([command('retry'), command('later')]);
        },
    );

    it('retains a new retry key when a recovered write loses its acknowledgement', async () => {
        await SyncQueue.save([command('retry', 'INCREMENT')]);
        const status = vi.fn();
        SyncManager.init(status);
        const receipts = new Map<string, number>();
        let hasAccess = false;
        let count = 0;
        apiFetch.mockImplementation(async (_path, options) => {
            const key = options.headers['X-Idempotency-Key'];
            if (receipts.get(key) === 404 || !hasAccess) {
                receipts.set(key, 404);
                throw new ApiError('Counter not found', 404);
            }
            if (!receipts.has(key)) {
                count += 1;
                receipts.set(key, 200);
                throw new TypeError('Response lost');
            }
            return { success: true };
        });

        await SyncManager.processQueue();
        expect(status).toHaveBeenLastCalledWith('error');
        hasAccess = true;
        await SyncManager.processQueue();
        await SyncManager.processQueue();
        expect(count).toBe(1);
        expect(await SyncQueue.get()).toEqual([]);
        expect(status).toHaveBeenLastCalledWith('idle');
        const keys = apiFetch.mock.calls.map(([, options]) => options.headers['X-Idempotency-Key']);
        expect(keys[1]).not.toBe(keys[0]);
        expect(keys[2]).toBe(keys[1]);
    });

    it('does not rekey an ambiguous idempotency conflict', async () => {
        const removal = { ...command('removal', 'DELETE'), entityId: 'counter-conflict' };
        await SyncQueue.save([command('conflict'), removal]);
        apiFetch.mockRejectedValue(new ApiError('Idempotency conflict', 409));
        await SyncManager.processQueue();
        await SyncManager.processQueue();
        expect(apiFetch.mock.calls.map(([, options]) => options.headers['X-Idempotency-Key'])).toEqual([
            'conflict',
            'conflict',
        ]);
        expect((await SyncQueue.get()).map((item) => item.id)).toEqual(['conflict', 'removal']);
    });

    it('applies an edit queued during a retry only after that request is definitely rejected', async () => {
        await SyncQueue.save([command('bad')]);
        apiFetch.mockRejectedValueOnce(new ApiError('Invalid title', 422));
        await SyncManager.processQueue();
        let reject!: () => void;
        apiFetch.mockImplementationOnce(
            () =>
                new Promise((_resolve, fail) => {
                    reject = () => fail(new ApiError('Invalid title', 422));
                }),
        );
        let createdTitle = '';
        apiFetch.mockImplementation(async (_path, options) => {
            if (options.body.title !== 'Fixed') throw new ApiError('Invalid title', 422);
            createdTitle = options.body.title;
            return { success: true };
        });
        const pending = SyncManager.processQueue();
        await vi.waitFor(() => expect(reject).toBeTypeOf('function'));
        await SyncQueue.add({ ...command('edit', 'UPDATE'), entityId: 'counter-bad', payload: { title: 'Fixed' } });
        const requested = SyncManager.processQueue();
        reject();
        await Promise.all([pending, requested]);
        expect(createdTitle).toBe('Fixed');
        expect(await SyncQueue.get()).toEqual([]);
    });

    it.each([
        ['CREATE', '/counters', 'POST'],
        ['UPDATE', '/counters/update/counter-command', 'PUT'],
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
                headers: { 'X-Idempotency-Key': 'command', 'X-Account-Id': 'user-1' },
            }),
        );
    });
});
