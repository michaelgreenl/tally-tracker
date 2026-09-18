// @vitest-environment jsdom
import { act, createElement, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { CounterProvider, useCounters } from './counters';
import { CounterStorage } from './services/counter-storage';
import { SyncManager } from './services/sync-manager';
import { SyncQueue } from './services/sync-queue';
import { changeSession } from './services/session-scope';
import { ApiError } from './api';

import type { ClientCounter, HexColor } from '@tally/core/client';
import type { Root } from 'react-dom/client';

const bridge = vi.hoisted(() => ({
    ApiError: class extends Error {
        constructor(
            message: string,
            public status: number,
        ) {
            super(message);
        }
    },
    values: new Map<string, string>(),
    setItem: vi.fn(),
    fetch: vi.fn(),
    update: (_counter?: unknown) => {},
}));
vi.mock('@react-native-async-storage/async-storage', () => ({
    default: {
        getItem: async (key: string) => bridge.values.get(key) ?? null,
        setItem: bridge.setItem,
        removeItem: async (key: string) => {
            bridge.values.delete(key);
        },
    },
}));
vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));
vi.mock('expo-network', () => ({
    getNetworkStateAsync: async () => ({ isConnected: true }),
    addNetworkStateListener: () => ({ remove() {} }),
}));
vi.mock('react-native', () => ({ AppState: { addEventListener: () => ({ remove() {} }) } }));
vi.mock('./session', () => ({
    useSession: () => ({ ready: true, user: { id: 'account', tier: 'BASIC' }, isAuthenticated: true }),
}));
vi.mock('./services/auth.service', () => ({ AuthService: { getCachedUser: async () => ({ id: 'account' }) } }));
vi.mock('./api', () => ({ default: bridge.fetch, ApiError: bridge.ApiError, getErrorMessage: () => 'Failed' }));
vi.mock('./socket', () => ({
    subscribeToCounterUpdates: (listener: () => void) => {
        bridge.update = listener;
        return () => {};
    },
    connectSocket() {},
    disconnectSocket() {},
}));

const initial: ClientCounter = {
    id: 'water',
    userId: 'account',
    title: 'Water',
    count: 1,
    metric: null,
    increment: 1,
    color: '#000000' as HexColor,
    type: 'PERSONAL',
    inviteCode: null,
};
const other = { ...initial, id: 'other', title: 'Other counter' };
let state: ReturnType<typeof useCounters>;
let root: Root;
let remote: ClientCounter[];
function Probe() {
    const value = useCounters();
    useEffect(() => {
        state = value;
    });
    return null;
}

beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    changeSession('account');
    bridge.values.clear();
    bridge.setItem.mockImplementation(async (key: string, value: string) => {
        bridge.values.set(key, value);
    });
    remote = [initial, other];
    bridge.fetch
        .mockReset()
        .mockImplementation(async () => ({ success: true, data: { counters: structuredClone(remote) } }));
    await CounterStorage.save([initial, other]);
    root = createRoot(document.createElement('div'));
    await act(async () => root.render(createElement(CounterProvider, null, createElement(Probe))));
});

afterEach(async () => {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
});

it('checks an existing invite with the server instead of rejecting it from a cached Basic quota', async () => {
    const joined = { ...initial, userId: 'owner', type: 'SHARED' as const, inviteCode: 'existing-invite' };
    remote = [joined];
    await act(async () => bridge.update());
    bridge.fetch.mockResolvedValueOnce({ success: true, data: { counter: joined } });
    await act(async () => {
        expect(await state.joinCounter(joined.inviteCode)).toEqual({ success: true });
    });
    expect(state.counters).toEqual([joined]);
});

it('keeps a pending tap through an old socket event, then fetches the acknowledged server value', async () => {
    let acknowledge!: () => void;
    bridge.fetch.mockImplementation(async (_path: string, options: { method: string }) => {
        if (options.method === 'PUT') {
            await new Promise<void>((resolve) => {
                acknowledge = resolve;
            });
            remote = [other, { ...initial, count: 3 }]; // Another device added one, too.
            return { success: true, data: { counter: remote[1] } };
        }
        return { success: true, data: { counters: structuredClone(remote) } };
    });
    await act(async () => {
        await state.incrementCounter(initial.id, 1);
    });
    try {
        await act(async () => bridge.update(initial));
        expect(state.counters[0].count).toBe(2);
    } finally {
        await act(async () => {
            acknowledge();
            await SyncManager.processQueue();
        });
    }
    // No socket event or manual refresh after the ack: the real processor must refresh the view.
    expect(await SyncQueue.get()).toEqual([]);
    expect(state.counters).toEqual([{ ...initial, count: 3 }, other]);
    expect(await CounterStorage.getAll()).toEqual(state.counters);
});

it('ignores a pre-ack snapshot that finishes after the queue drains', async () => {
    let acknowledge!: () => void;
    let oldSnapshot!: () => void;
    bridge.fetch.mockImplementation(async (_path: string, options: { method: string }) => {
        if (options.method === 'PUT') {
            await new Promise<void>((resolve) => {
                acknowledge = resolve;
            });
            remote = [{ ...initial, count: 3 }];
            return { success: true, data: { counter: remote[0] } };
        }
        return { success: true, data: { counters: structuredClone(remote) } };
    });
    bridge.fetch.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                oldSnapshot = () => resolve({ success: true, data: { counters: [initial] } });
            }),
    );
    await act(async () => state.refreshCounters());
    await act(async () => {
        await state.incrementCounter(initial.id, 1);
    });
    await act(async () => {
        acknowledge();
        await SyncManager.processQueue();
    });
    await act(async () => oldSnapshot());
    expect(state.counters[0].count).toBe(3);
    expect((await CounterStorage.getAll())[0].count).toBe(3);
});

it('does not overwrite local intent while its queue write is still pending', async () => {
    let finishFetch!: () => void;
    bridge.fetch.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                finishFetch = () => resolve({ success: true, data: { counters: [initial] } });
            }),
    );
    await act(async () => state.refreshCounters());
    let saveCommand!: () => void;
    bridge.setItem.mockImplementation(async (key: string, value: string) => {
        if (key === 'app_sync_queue')
            await new Promise<void>((resolve) => {
                saveCommand = resolve;
            });
        bridge.values.set(key, value);
    });
    let mutation!: ReturnType<typeof state.incrementCounter>;
    await act(async () => {
        mutation = state.incrementCounter(initial.id, 1);
    });
    try {
        await act(async () => finishFetch());
        expect(state.counters[0].count).toBe(2);
        expect((await CounterStorage.getAll())[0].count).toBe(2);
    } finally {
        bridge.setItem.mockImplementation(async (key: string, value: string) => {
            bridge.values.set(key, value);
        });
        await act(async () => {
            saveCommand();
            await mutation;
            await SyncManager.processQueue();
        });
    }
});

it('keeps a confirmed join when an earlier snapshot arrives late', async () => {
    const joined = { ...initial, id: 'joined', userId: 'owner', type: 'SHARED' as const };
    let finishOldFetch!: () => void;
    bridge.fetch.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                finishOldFetch = () => resolve({ success: true, data: { counters: [initial, other] } });
            }),
    );
    await act(async () => state.refreshCounters());
    bridge.fetch.mockImplementation(async (path: string) => {
        if (path === '/counters/join') {
            remote = [initial, other, joined];
            return { success: true, data: { counter: joined } };
        }
        return { success: true, data: { counters: structuredClone(remote) } };
    });
    await act(async () => {
        await state.joinCounter('invite');
    });
    await act(async () => finishOldFetch());
    expect(state.counters.map((counter) => counter.id)).toEqual(['water', 'other', 'joined']);
    expect(await CounterStorage.getAll()).toEqual(state.counters);
});

it.each(['edit', 'delete'] as const)(
    'recovers a rejected creation after cache loss through %s without blocking other counters',
    async (recovery) => {
        await act(async () => root.unmount());
        await CounterStorage.clear();
        remote = [];
        const bad = { ...initial, id: 'failed', title: 'x'.repeat(51), count: 0 };
        const createPayload = ({ id, title, color, count, metric, increment }: ClientCounter) => ({
            id,
            title,
            color,
            count,
            metric,
            increment,
        });
        await SyncQueue.save([
            { id: 'create', queuedByUserId: 'account', entityId: bad.id, type: 'CREATE', payload: createPayload(bad) },
            { id: 'tap', queuedByUserId: 'account', entityId: bad.id, type: 'INCREMENT', payload: { amount: 1 } },
            {
                id: 'good',
                queuedByUserId: 'account',
                entityId: other.id,
                type: 'CREATE',
                payload: createPayload(other),
            },
            {
                id: 'foreign',
                queuedByUserId: 'another-account',
                entityId: bad.id,
                type: 'UPDATE',
                payload: { title: 'Other account' },
            },
        ]);
        bridge.fetch.mockImplementation(async (path, options) => {
            if (options.method === 'POST') {
                if (options.body.title.length > 50) throw new ApiError('Name too long', 422);
                remote.push({
                    ...structuredClone(options.body),
                    userId: 'account',
                    type: 'PERSONAL',
                    inviteCode: null,
                });
            } else if (path.includes('/increment/')) {
                const counter = remote.find((item) => item.id === path.split('/').at(-1));
                if (!counter) throw new ApiError('Counter missing', 404);
                counter.count += options.body.amount;
            } else if (options.method === 'DELETE') {
                throw new ApiError('Counter missing', 404);
            }
            return { success: true, data: { counters: structuredClone(remote) } };
        });
        root = createRoot(document.createElement('div'));
        await act(async () => root.render(createElement(CounterProvider, null, createElement(Probe))));
        expect(remote.map((counter) => counter.id)).toEqual([other.id]);
        expect(state.counters.find((counter) => counter.id === bad.id)?.count).toBe(1);
        expect(state.failedCounterIds.has(bad.id)).toBe(true);

        await act(async () => {
            if (recovery === 'edit') await state.updateCounter(bad.id, { title: 'Water' });
            else await state.deleteCounter(bad);
            await SyncManager.processQueue();
        });
        expect(remote.find((counter) => counter.id === bad.id)).toEqual(
            recovery === 'edit' ? { ...bad, title: 'Water', count: 1 } : undefined,
        );
        expect((await SyncQueue.get()).map((command) => command.id)).toEqual(['foreign']);
        expect(state.failedCounterIds.size).toBe(0);
    },
);

it('drains a healthy creation added while another counter is being rejected', async () => {
    let reject!: () => void;
    bridge.fetch.mockImplementation(async (path, options) => {
        if (options.method === 'POST') {
            if (options.body.title === 'Rejected') {
                await new Promise<void>((resolve) => {
                    reject = resolve;
                });
                throw new ApiError('Rejected', 422);
            }
            remote.push(options.body);
        }
        return { success: true, data: { counters: structuredClone(remote) } };
    });
    await act(async () => {
        await state.createCounter('Rejected', '#000000' as HexColor);
    });
    try {
        await act(async () => {
            await state.createCounter('Healthy', '#000000' as HexColor);
        });
    } finally {
        await act(async () => {
            reject();
            await SyncManager.processQueue();
        });
    }
    expect(remote.some((counter) => counter.title === 'Healthy')).toBe(true);
    expect((await SyncQueue.get()).map((command) => (command.payload as ClientCounter).title)).toEqual(['Rejected']);
});

it('rejects an overlong name before changing local storage or the queue', async () => {
    await act(async () => {
        expect((await state.createCounter('x'.repeat(51), '#000000' as HexColor)).success).toBe(false);
        expect((await state.updateCounter(initial.id, { title: 'x'.repeat(51) })).success).toBe(false);
    });
    expect(await CounterStorage.getAll()).toEqual([initial, other]);
    expect(await SyncQueue.get()).toEqual([]);
});
