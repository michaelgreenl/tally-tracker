import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { buildCommand } from '../../../../tests/e2e/fixtures/counter.fixture';

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

describe('sync queue session isolation', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        preferencesStore.clear();
        SyncManager.isSyncing = false;

        authServiceMock.cacheUser.mockResolvedValue(undefined);
        authServiceMock.clearLocalAuth.mockResolvedValue(undefined);
        authServiceMock.login.mockResolvedValue({
            success: true,
            data: {
                user: {
                    id: 'user-b',
                    email: 'user-b@test.com',
                    tier: 'BASIC',
                },
                accessToken: 'user-b-access-token',
                refreshToken: 'user-b-refresh-token',
            },
        });
        authServiceMock.setAccessToken.mockResolvedValue(undefined);
        authServiceMock.setRefreshToken.mockResolvedValue(undefined);
        counterStoreMock.clearState.mockResolvedValue(undefined);
        counterStoreMock.consolidateGuestCounters.mockResolvedValue(undefined);
        isNativePlatformMock.mockReturnValue(false);
        networkGetStatusMock.mockResolvedValue({ connected: true, connectionType: 'wifi' });
    });

    it('does not replay a prior session command after logout and another login', async () => {
        await SyncQueueService.addCommand(
            buildCommand({
                id: 'user-a-command',
                payload: { title: 'User A offline counter' },
            }),
        );

        const authStore = useAuthStore();
        await authStore.logout(false);
        await authStore.login({ email: 'user-b@test.com', password: 'password123' });
        await SyncManager.processQueue();

        expect(await SyncQueueService.getQueue()).toEqual([]);
        expect(apiFetchMock).not.toHaveBeenCalled();
    });
});
