import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { buildCommand } from '@/test/fixtures/sync.fixture';

const {
    apiFetchMock,
    authServiceMock,
    connectSocketMock,
    counterStoreMock,
    disconnectSocketMock,
    isNativePlatformMock,
    localStorageMock,
    networkGetStatusMock,
    preferencesStore,
    routerPushMock,
} = vi.hoisted(() => ({
    apiFetchMock: vi.fn(),
    authServiceMock: {
        cacheUser: vi.fn(),
        checkAuth: vi.fn(),
        clearLocalAuth: vi.fn(),
        getAccessToken: vi.fn(),
        getCachedUser: vi.fn(),
        getRefreshToken: vi.fn(),
        login: vi.fn(),
        logout: vi.fn(),
        register: vi.fn(),
        setAccessToken: vi.fn(),
        setRefreshToken: vi.fn(),
        updateUser: vi.fn(),
    },
    connectSocketMock: vi.fn(),
    counterStoreMock: {
        clearState: vi.fn(),
        consolidateGuestCounters: vi.fn(),
    },
    disconnectSocketMock: vi.fn(),
    isNativePlatformMock: vi.fn(),
    localStorageMock: {
        getItem: vi.fn(),
        removeItem: vi.fn(),
        setItem: vi.fn(),
    },
    networkGetStatusMock: vi.fn(),
    preferencesStore: new Map<string, string>(),
    routerPushMock: vi.fn(),
}));

vi.stubGlobal('localStorage', {
    getItem: localStorageMock.getItem,
    removeItem: localStorageMock.removeItem,
    setItem: localStorageMock.setItem,
});

vi.mock('@capacitor/core', () => ({
    Capacitor: {
        isNativePlatform: isNativePlatformMock,
    },
}));

vi.mock('@capacitor/network', () => ({
    Network: {
        getStatus: networkGetStatusMock,
        addListener: vi.fn(),
    },
}));

vi.mock('@capacitor/preferences', () => ({
    Preferences: {
        get: vi.fn(async ({ key }: { key: string }) => ({ value: preferencesStore.get(key) ?? null })),
        remove: vi.fn(async ({ key }: { key: string }) => {
            preferencesStore.delete(key);
        }),
        set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
            preferencesStore.set(key, value);
        }),
    },
}));

vi.mock('@/api', () => ({
    default: apiFetchMock,
}));

vi.mock('@/router', () => ({
    default: {
        push: routerPushMock,
    },
}));

vi.mock('@/services/auth.service', () => ({
    AuthService: authServiceMock,
}));

vi.mock('@/socket', () => ({
    connectSocket: connectSocketMock,
    disconnectSocket: disconnectSocketMock,
}));

vi.mock('@/stores/counterStore', () => ({
    useCounterStore: () => counterStoreMock,
}));

import { SyncManager } from '../manager';
import { SyncQueueService } from '../queue';
import { useAuthStore } from '@/stores/authStore';
import { Preferences } from '@capacitor/preferences';

describe('sync queue session isolation', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        apiFetchMock.mockReset();
        for (const mock of Object.values(authServiceMock)) mock.mockReset();
        connectSocketMock.mockReset();
        disconnectSocketMock.mockReset();
        counterStoreMock.clearState.mockReset();
        counterStoreMock.consolidateGuestCounters.mockReset();
        isNativePlatformMock.mockReset();
        localStorageMock.getItem.mockReset();
        localStorageMock.removeItem.mockReset();
        localStorageMock.setItem.mockReset();
        networkGetStatusMock.mockReset();
        routerPushMock.mockReset();
        vi.mocked(Preferences.get).mockClear();
        vi.mocked(Preferences.remove).mockClear();
        vi.mocked(Preferences.set).mockClear();
        preferencesStore.clear();
        SyncManager.isSyncing = false;
        SyncManager.syncRequested = false;

        authServiceMock.cacheUser.mockResolvedValue(undefined);
        authServiceMock.clearLocalAuth.mockResolvedValue(undefined);
        authServiceMock.login.mockImplementation(async ({ email }: { email?: string }) => ({
            success: true,
            data: {
                user: {
                    id: email === 'user-a@test.com' ? 'user-a' : 'user-b',
                    email: email ?? 'user-b@test.com',
                    tier: 'BASIC',
                },
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
            },
        }));
        authServiceMock.setAccessToken.mockResolvedValue(undefined);
        authServiceMock.setRefreshToken.mockResolvedValue(undefined);
        counterStoreMock.clearState.mockResolvedValue(undefined);
        counterStoreMock.consolidateGuestCounters.mockResolvedValue(undefined);
        isNativePlatformMock.mockReturnValue(false);
        networkGetStatusMock.mockResolvedValue({ connected: true, connectionType: 'wifi' });
    });

    it('keeps a prior session command when another user logs in', async () => {
        const userACommand = buildCommand({
            id: 'user-a-command',
            queuedByUserId: 'user-a',
            payload: { title: 'User A offline counter' },
        });

        await SyncQueueService.addCommand(userACommand);

        const authStore = useAuthStore();
        await authStore.logout(false);
        await authStore.login({ email: 'user-b@test.com', password: 'password123' });
        await SyncManager.processQueue();

        expect(await SyncQueueService.getQueue()).toEqual([userACommand]);
        expect(apiFetchMock).not.toHaveBeenCalled();
    });

    it('replays a prior session command when the same user logs back in', async () => {
        await SyncQueueService.addCommand(
            buildCommand({
                id: 'user-a-command',
                queuedByUserId: 'user-a',
                payload: { title: 'User A offline counter' },
            }),
        );
        apiFetchMock.mockResolvedValue({ success: true });

        const authStore = useAuthStore();
        await authStore.logout(false);
        await authStore.login({ email: 'user-a@test.com', password: 'password123' });
        await SyncManager.processQueue();

        expect(apiFetchMock).toHaveBeenCalledTimes(1);
        expect(await SyncQueueService.getQueue()).toEqual([]);
    });
});
