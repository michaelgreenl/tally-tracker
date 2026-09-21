import { beforeEach, expect, it, vi } from 'vitest';

import { CounterStorage } from './counter-storage';
import { SyncQueue } from './sync-queue';
import { changeSession } from './session-scope';
import { WidgetSync } from './widget-sync';

const device = vi.hoisted(() => ({
    values: new Map<string, string>(),
    pending: [] as { id: string; owner: string; counterId: string; amount: number }[],
    failQueueWrite: false,
    failAcknowledgement: false,
}));
vi.mock('@react-native-async-storage/async-storage', () => ({
    default: {
        getItem: async (key: string) => device.values.get(key) ?? null,
        setItem: async (key: string, value: string) => {
            if (key === 'app_sync_queue' && device.failQueueWrite) throw new Error('Storage unavailable');
            device.values.set(key, value);
        },
        removeItem: async (key: string) => {
            device.values.delete(key);
        },
    },
}));
vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));
vi.mock('./widget-bridge', () => ({
    widgetBridge: {
        pending: () => JSON.stringify(device.pending),
        acknowledge: (ids: string[]) => {
            if (device.failAcknowledgement) throw new Error('Widget store unavailable');
            device.pending = device.pending.filter((tap) => !ids.includes(tap.id));
        },
        hide() {},
    },
}));

const counter = {
    id: 'water',
    userId: 'alice',
    title: 'Water',
    count: 1,
    increment: 0.1,
    metric: 'bottle',
    type: 'PERSONAL' as const,
    inviteCode: null,
    color: null,
};
const tap = (owner = 'alice', amount = 0.1) => ({ id: crypto.randomUUID(), owner, counterId: 'water', amount });

beforeEach(async () => {
    device.values.clear();
    device.pending = [];
    device.failQueueWrite = false;
    device.failAcknowledgement = false;
    await CounterStorage.save([counter]);
});

it('recovers an interrupted handoff without applying the tap twice or losing its server command', async () => {
    const scope = changeSession('alice');
    const command = tap();
    device.pending = [command];
    device.failQueueWrite = true;
    await expect(WidgetSync.consume(scope)).rejects.toThrow();
    device.failQueueWrite = false;
    await WidgetSync.consume(scope);
    expect((await CounterStorage.getAll())[0].count).toBe(1.1);
    expect(await SyncQueue.get()).toEqual([
        { id: command.id, queuedByUserId: 'alice', type: 'INCREMENT', entityId: 'water', payload: { amount: 0.1 } },
    ]);
    expect(device.pending).toEqual([]);
});

it('keeps the retry identity when both stores saved but acknowledging the widget failed', async () => {
    const scope = changeSession('alice');
    const command = tap();
    device.pending = [command];
    device.failAcknowledgement = true;
    await expect(WidgetSync.consume(scope)).rejects.toThrow();
    device.failAcknowledgement = false;
    await WidgetSync.consume(scope);
    expect((await CounterStorage.getAll())[0].count).toBe(1.1);
    expect((await SyncQueue.get()).map((item) => item.id)).toEqual([command.id]);
});

it('keeps another account isolated and waits for an empty cache to be filled before importing', async () => {
    const command = tap();
    device.pending = [command];
    await CounterStorage.save([]);
    await WidgetSync.consume(changeSession('bob'));
    const alice = changeSession('alice');
    await WidgetSync.consume(alice);
    expect(device.pending).toEqual([command]);
    await CounterStorage.save([counter]);
    await WidgetSync.consume(alice);
    expect((await CounterStorage.getAll())[0].count).toBe(1.1);
    expect((await SyncQueue.get())[0].queuedByUserId).toBe('alice');
});

it('saves guest decimal taps locally without creating authenticated commands', async () => {
    await CounterStorage.save([{ ...counter, userId: 'guest', count: 0 }]);
    device.pending = [tap('guest'), tap('guest'), tap('guest')];
    await WidgetSync.consume(changeSession());
    expect((await CounterStorage.getAll())[0].count).toBe(0.3);
    expect(await SyncQueue.get()).toEqual([]);
});

it('retires taps for a removed counter only after an authoritative refresh', async () => {
    const scope = changeSession('alice');
    const command = tap();
    device.pending = [command];
    await CounterStorage.save([]);
    await WidgetSync.consume(scope, true);
    expect(device.pending).toEqual([]);
    expect(await SyncQueue.get()).toEqual([]);
});

it('retains a tap when another device reaches the count limit, then imports it after correction', async () => {
    const scope = changeSession('alice');
    const maximum = 999_999_999.999999;
    await CounterStorage.save([{ ...counter, count: maximum }]);
    const command = tap();
    device.pending = [command];
    await expect(WidgetSync.consume(scope)).rejects.toBeInstanceOf(RangeError);
    expect(device.pending).toEqual([command]);
    await CounterStorage.save([{ ...counter, count: maximum - 1 }]);
    await WidgetSync.consume(scope);
    expect((await SyncQueue.get()).map((item) => item.id)).toEqual([command.id]);
    expect(device.pending).toEqual([]);
});
