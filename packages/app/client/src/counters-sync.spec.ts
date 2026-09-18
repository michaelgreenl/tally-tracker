// @vitest-environment jsdom
import { act, createElement, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { CounterProvider, useCounters } from './counters';
import { CounterStorage } from './services/counter-storage';
import { SyncManager } from './services/sync-manager';
import { SyncQueue } from './services/sync-queue';
import { changeSession } from './services/session-scope';

import type { ClientCounter, HexColor } from '@tally/core/client';
import type { Root } from 'react-dom/client';

const bridge = vi.hoisted(() => ({
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
    useSession: () => ({ ready: true, user: { id: 'account' }, isAuthenticated: true }),
}));
vi.mock('./services/auth.service', () => ({ AuthService: { getCachedUser: async () => ({ id: 'account' }) } }));
vi.mock('./api', () => ({ default: bridge.fetch, ApiError: Error, getErrorMessage: () => 'Failed' }));
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
