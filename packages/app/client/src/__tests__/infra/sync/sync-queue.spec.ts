import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SyncQueue } from '../../../infra/sync/sync-queue';

import type { MutationCommand } from '../../../infra/sync/sync-queue';

const { storage } = vi.hoisted(() => ({ storage: new Map<string, string>() }));

vi.mock('@react-native-async-storage/async-storage', () => ({
    default: {
        getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
        setItem: vi.fn(async (key: string, value: string) => {
            storage.set(key, value);
        }),
        removeItem: vi.fn(async (key: string) => {
            storage.delete(key);
        }),
    },
}));
vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));

const command = (id: string): MutationCommand => ({
    id,
    queuedByUserId: 'user-1',
    type: 'CREATE',
    entityId: `counter-${id}`,
    payload: {},
});

describe('SyncQueue', () => {
    beforeEach(() => storage.clear());

    it('preserves concurrent additions', async () => {
        await Promise.all([SyncQueue.add(command('one')), SyncQueue.add(command('two'))]);

        await expect(SyncQueue.get()).resolves.toEqual([command('one'), command('two')]);
    });

    it('removes only the completed command', async () => {
        await SyncQueue.save([command('one'), command('two')]);

        await SyncQueue.remove('one');

        await expect(SyncQueue.get()).resolves.toEqual([command('two')]);
    });
});
