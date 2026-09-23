// @vitest-environment jsdom
import { act, createElement, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { CounterProvider, useCounters } from './counter-context';
import { CounterService } from '../services/counter.service';
import { SyncManager } from '../services/sync-manager';

import type { ClientCounter, HexColor } from '@tally/core/client';
import type { Root } from 'react-dom/client';

vi.mock('expo-crypto', () => ({ getRandomBytes: vi.fn(), randomUUID: vi.fn() }));
vi.mock('react-native', () => ({ AppState: { addEventListener: () => ({ remove() {} }) } }));
vi.mock('../session', () => ({ useSession: () => ({ ready: true, user: { id: 'account' } }) }));
vi.mock('../api', () => ({ ApiError: Error, getErrorMessage: vi.fn(), REQUEST_FAILED_MESSAGE: 'Failed' }));
vi.mock('../services/counter.service', () => ({
    CounterService: {
        getOrder: async () => [],
        getAllLocal: vi.fn(),
        fetchRemote: vi.fn(),
        persist: vi.fn(),
    },
}));
vi.mock('../services/sync-manager', () => ({
    SyncManager: { init() {}, dispose() {}, processQueue: vi.fn() },
}));
vi.mock('../services/sync-queue', () => ({ SyncQueue: { get: async () => [] } }));
vi.mock('../socket', () => ({
    subscribeToCounterUpdates: () => () => {},
    connectSocket() {},
    disconnectSocket() {},
}));

const local: ClientCounter = {
    id: 'water',
    userId: 'account',
    title: 'Water',
    count: 1,
    color: '#000000' as HexColor,
    metric: null,
    increment: 1,
    inviteCode: null,
    type: 'PERSONAL',
};
let state: ReturnType<typeof useCounters>;
let root: Root;

function Probe() {
    const value = useCounters();
    useEffect(() => {
        state = value;
    });
    return null;
}

beforeEach(async () => {
    vi.resetAllMocks();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.mocked(CounterService.getAllLocal).mockResolvedValue([local]);
    vi.mocked(CounterService.fetchRemote).mockResolvedValue([local]);
    root = createRoot(document.createElement('div'));
    await act(async () => root.render(createElement(CounterProvider, null, createElement(Probe))));
});

afterEach(async () => {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
});

it.each(['success', 'failure'])('finishes a manual refresh after sync %s without losing counters', async (result) => {
    const remote = { ...local, count: 7 };
    let finishFetch!: () => void;
    let finishQueue!: () => void;
    vi.mocked(CounterService.fetchRemote).mockReturnValueOnce(
        new Promise((resolve, reject) => {
            finishFetch = () => (result === 'success' ? resolve([remote]) : reject(new Error('Offline')));
        }),
    );
    vi.mocked(SyncManager.processQueue).mockReturnValueOnce(
        new Promise((resolve) => {
            finishQueue = resolve;
        }),
    );

    await act(async () => state.refreshCounters());
    expect(state.refreshing).toBe(true);
    expect(state.counters).toEqual([local]);

    await act(async () => finishFetch());
    expect(state.refreshing).toBe(true);

    await act(async () => finishQueue());
    expect(state.refreshing).toBe(false);
    expect(state.counters).toEqual([result === 'success' ? remote : local]);
    expect(state.syncError).toBe(result === 'failure');
});
