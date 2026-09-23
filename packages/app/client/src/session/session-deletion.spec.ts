// @vitest-environment jsdom
import { act, createElement, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { SessionProvider, useSession } from './session-context';
import { AuthService, USER_KEY } from './auth.service';
import { CounterService } from '../counters/counter.service';
import { CounterStorage } from '../counters/counter-storage';
import { SyncQueue } from '../counters/sync-queue';
import { changeSession, getSessionScope, SessionChangedError, writeSession } from './session-scope';
import { tokenStorage } from './token-storage';

import type { ClientCounter, ClientUser } from '@tally/core/client';
import type { Root } from 'react-dom/client';

const { storage, secure, setItem, removeItem, fetchMock, router } = vi.hoisted(() => ({
    storage: new Map<string, string>(),
    secure: new Map<string, string>(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    fetchMock: vi.fn(),
    router: { replace: vi.fn() },
}));
vi.mock('@react-native-async-storage/async-storage', () => ({
    default: { getItem: async (key: string) => storage.get(key) ?? null, setItem, removeItem },
}));
vi.mock('expo-secure-store', () => ({
    getItemAsync: async (key: string) => secure.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => {
        secure.set(key, value);
    },
    deleteItemAsync: async (key: string) => {
        secure.delete(key);
    },
}));
vi.mock('./token-storage', () => import('./token-storage.native'));
vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));
vi.mock('expo-network', () => ({ getNetworkStateAsync: async () => ({ isConnected: false }) }));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' }, AppState: { addEventListener: () => ({ remove() {} }) } }));
vi.mock('expo-router', () => ({ useRouter: () => router }));

const accountA: ClientUser = { id: 'a', email: 'a@example.com', tier: 'BASIC', emailVerified: true };
const accountB: ClientUser = { ...accountA, id: 'b', email: 'b@example.com' };
const counter = (userId: string): ClientCounter => ({
    id: `counter-${userId}`,
    userId,
    title: 'Water',
    count: 2,
    increment: 1,
    metric: null,
    color: null,
    type: 'PERSONAL',
    inviteCode: null,
});
const joined: ClientCounter = {
    ...counter('owner'),
    type: 'SHARED',
    shares: [
        {
            id: 'share-a',
            counterId: 'counter-owner',
            userId: 'a',
            status: 'ACCEPTED',
            createdAt: new Date(0),
            updatedAt: new Date(0),
        },
    ],
};
const counters = [counter('a'), joined, counter('b'), counter('guest')];
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const credentials = (user: ClientUser) => ({
    user,
    accessToken: `access-${user.id}`,
    refreshToken: `refresh-${user.id}`,
});
let session: ReturnType<typeof useSession>;
let root: Root;

function Probe() {
    const value = useSession();
    useEffect(() => {
        session = value;
    });
    return null;
}

beforeEach(async () => {
    vi.resetAllMocks();
    storage.clear();
    secure.clear();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('__DEV__', false);
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', '');
    setItem.mockImplementation(async (key: string, value: string) => {
        storage.set(key, value);
    });
    removeItem.mockImplementation(async (key: string) => {
        storage.delete(key);
    });
    await AuthService.saveLogin(credentials(accountA), changeSession('a'));
    await CounterStorage.save(counters);
    for (const userId of ['a', 'b', 'guest']) await CounterStorage.saveOrder(userId, [`counter-${userId}`]);
    await SyncQueue.save(
        ['a', 'b'].map((userId) => ({
            id: `command-${userId}`,
            queuedByUserId: userId,
            entityId: `counter-${userId}`,
            type: 'INCREMENT',
            payload: { amount: 1 },
        })),
    );
    fetchMock.mockImplementation(async (_url: string, options: RequestInit) => {
        if (options.method === 'DELETE') return json({ success: true });
        const user = options.method === 'POST' ? accountB : accountA;
        return json({ success: true, data: credentials(user) });
    });
    root = createRoot(document.createElement('div'));
    await act(async () => root.render(createElement(SessionProvider, null, createElement(Probe))));
});

afterEach(async () => {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

it.each([{ email: accountB.email, password: 'Test-password-123' }, { idToken: 'google-token' }])(
    'removes deleted account data after delayed writes without clearing the next login: %j',
    async (credentials) => {
        const scope = getSessionScope();
        const savedCounters = await CounterStorage.getAll();
        const response = Promise.withResolvers<Response>();
        fetchMock.mockReturnValueOnce(response.promise);
        const deletion = session.deleteAccount();
        await vi.waitFor(() =>
            expect(fetchMock).toHaveBeenCalledWith(
                expect.stringContaining('/users'),
                expect.objectContaining({ method: 'DELETE' }),
            ),
        );
        expect(session.user).toEqual(accountA);
        expect(await CounterStorage.getAll()).toEqual(savedCounters);
        expect((await SyncQueue.get()).map((item) => item.queuedByUserId)).toEqual(['a', 'b']);
        expect(await CounterStorage.getOrder('a')).toEqual(['counter-a']);

        const write = Promise.withResolvers<void>();
        setItem.mockImplementation(async (key: string, value: string) => {
            if (key === 'app_counters' || key === 'app_sync_queue') await write.promise;
            storage.set(key, value);
        });
        const oldWrite = writeSession(scope, async () => {
            await CounterService.persist(counters);
            await CounterService.persistOrder('a', ['counter-owner', 'counter-a']);
        });
        const stale = expect(oldWrite).rejects.toBeInstanceOf(SessionChangedError);
        // This command belongs to A, even though its counter belongs to someone else.
        const queued = CounterService.increment(joined, 2, scope);
        await vi.waitFor(() => expect(setItem.mock.calls.filter(([key]) => key === 'app_sync_queue')).toHaveLength(2));
        await act(async () => {
            response.resolve(json({ success: true }));
        });
        expect(session.user).toBeNull();

        let login!: ReturnType<typeof session.login>;
        await act(async () => {
            login = session.login(credentials);
        });
        await vi.waitFor(() => expect(getSessionScope().userId).toBe('b'));
        await act(async () => {
            write.resolve();
            await Promise.all([stale, queued]);
            expect((await deletion).success).toBe(true);
            expect((await login).success).toBe(true);
        });
        expect(await CounterStorage.getAll()).toEqual([counter('b'), counter('guest')]);
        expect(await CounterStorage.getOrder('a')).toEqual([]);
        expect(await CounterStorage.getOrder('b')).toEqual(['counter-b']);
        expect(await CounterStorage.getOrder('guest')).toEqual(['counter-guest']);
        expect((await SyncQueue.get()).map((item) => item.queuedByUserId)).toEqual(['b']);
        expect(session.user).toEqual(accountB);
        expect(await AuthService.getCachedUser()).toEqual(accountB);
        expect(await tokenStorage.getAccessToken()).toBe('access-b');
        expect(await tokenStorage.getRefreshToken()).toBe('refresh-b');
        await expect(CounterService.increment(joined, 1, scope)).rejects.toBeInstanceOf(SessionChangedError);
    },
);

it('preserves the session and stored work if the server rejects deletion', async () => {
    const saved = new Map(storage);
    const savedTokens = new Map(secure);
    fetchMock.mockResolvedValueOnce(json({ success: false }, 503));
    await act(async () => {
        expect((await session.deleteAccount()).success).toBe(false);
    });
    expect(session.user).toEqual(accountA);
    expect(storage).toEqual(saved);
    expect(secure).toEqual(savedTokens);
    expect(router.replace).not.toHaveBeenCalled();
});

it('reports incomplete local cleanup after confirmed deletion and still removes credentials', async () => {
    removeItem.mockImplementation(async (key: string) => {
        if (key === 'app_counters_order_a') throw new Error('Storage unavailable');
        storage.delete(key);
    });
    await act(async () => {
        expect((await session.deleteAccount()).success).toBe(true);
    });
    expect(session.user).toBeNull();
    expect(session.notice).not.toBe('');
    expect(storage.has(USER_KEY)).toBe(false);
    expect(secure.size).toBe(0);
    expect((await SyncQueue.get()).map((item) => item.queuedByUserId)).toEqual(['b']);
});
