import { UNAUTHORIZED } from '@tally/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ApiError } from '@/utils/errors';

const {
    authServiceMock,
    connectSocketMock,
    counterStoreMock,
    disconnectSocketMock,
    localStorageMock,
    localStorageValues,
    routerPushMock,
    syncManagerMock,
} = vi.hoisted(() => ({
    authServiceMock: {
        cacheUser: vi.fn(),
        checkAuth: vi.fn(),
        clearLocalAuth: vi.fn(),
        deleteAccount: vi.fn(),
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
    localStorageMock: {
        getItem: vi.fn(),
        removeItem: vi.fn(),
        setItem: vi.fn(),
    },
    localStorageValues: new Map<string, string>(),
    routerPushMock: vi.fn(),
    syncManagerMock: {
        processQueue: vi.fn(),
    },
}));

vi.stubGlobal('localStorage', localStorageMock);

vi.mock('@capacitor/core', () => ({
    Capacitor: {
        isNativePlatform: vi.fn(() => false),
    },
}));

vi.mock('@/router', () => ({
    default: {
        push: routerPushMock,
    },
}));

vi.mock('@/services/auth.service', () => ({
    AuthService: authServiceMock,
}));

vi.mock('@/services/sync/manager', () => ({
    SyncManager: syncManagerMock,
}));

vi.mock('@/socket', () => ({
    connectSocket: connectSocketMock,
    disconnectSocket: disconnectSocketMock,
}));

vi.mock('@/stores/counterStore', () => ({
    useCounterStore: () => counterStoreMock,
}));

import { useAuthStore } from '../authStore';

const user = {
    id: 'user-123',
    email: 'test@test.com',
    tier: 'PREMIUM' as const,
};

describe('authStore', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        for (const mock of Object.values(authServiceMock)) mock.mockReset();
        connectSocketMock.mockReset();
        disconnectSocketMock.mockReset();
        counterStoreMock.clearState.mockReset();
        counterStoreMock.consolidateGuestCounters.mockReset();
        routerPushMock.mockReset();
        syncManagerMock.processQueue.mockReset();
        localStorageMock.getItem.mockReset();
        localStorageMock.removeItem.mockReset();
        localStorageMock.setItem.mockReset();
        localStorageValues.clear();

        localStorageMock.getItem.mockImplementation((key: string) => localStorageValues.get(key) ?? null);
        localStorageMock.removeItem.mockImplementation((key: string) => {
            localStorageValues.delete(key);
        });
        localStorageMock.setItem.mockImplementation((key: string, value: string) => {
            localStorageValues.set(key, value);
        });
        authServiceMock.cacheUser.mockResolvedValue(undefined);
        authServiceMock.checkAuth.mockResolvedValue({ success: false });
        authServiceMock.clearLocalAuth.mockImplementation(async () => {
            localStorage.removeItem('AUTHORIZED');
        });
        authServiceMock.deleteAccount.mockResolvedValue({ success: true });
        authServiceMock.getAccessToken.mockResolvedValue(null);
        authServiceMock.getCachedUser.mockResolvedValue(null);
        authServiceMock.getRefreshToken.mockResolvedValue(null);
        authServiceMock.logout.mockResolvedValue({ success: true });
        authServiceMock.setAccessToken.mockResolvedValue(undefined);
        authServiceMock.setRefreshToken.mockResolvedValue(undefined);
        counterStoreMock.clearState.mockResolvedValue(undefined);
        counterStoreMock.consolidateGuestCounters.mockResolvedValue(undefined);
        syncManagerMock.processQueue.mockResolvedValue(undefined);
    });

    it('stores the authenticated session and connects the socket after login', async () => {
        authServiceMock.login.mockResolvedValue({
            success: true,
            data: {
                user,
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
            },
        });
        const store = useAuthStore();
        expect(store.user).toBeNull();
        expect(store.isAuthenticated).toBe(false);
        expect(localStorage.getItem('AUTHORIZED')).toBeNull();

        const result = await store.login({ email: 'test@test.com', password: 'password123' });

        expect(result.success).toBe(true);
        expect(store.user).toEqual(user);
        expect(store.isAuthenticated).toBe(true);
        expect(store.checkingAuth).toBe(false);
        expect(localStorage.getItem('AUTHORIZED')).toBe('true');
        expect(authServiceMock.cacheUser).toHaveBeenCalledWith(user);
        expect(authServiceMock.setAccessToken).toHaveBeenCalledWith('access-token');
        expect(authServiceMock.setRefreshToken).toHaveBeenCalledWith('refresh-token');
        expect(counterStoreMock.consolidateGuestCounters).toHaveBeenCalledTimes(1);
        expect(connectSocketMock).toHaveBeenCalledTimes(1);
        expect(syncManagerMock.processQueue).toHaveBeenCalledTimes(1);
    });

    it('exposes checking state and authenticates after cold-start verification', async () => {
        localStorage.setItem('AUTHORIZED', 'true');
        authServiceMock.getAccessToken.mockResolvedValue('access-token');
        let resolveCheck: (value: { success: true; data: { user: typeof user } }) => void = () => undefined;
        authServiceMock.checkAuth.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveCheck = resolve;
                }),
        );
        const store = useAuthStore();

        const initialization = store.initializeAuth();
        await vi.waitFor(() => expect(authServiceMock.checkAuth).toHaveBeenCalledTimes(1));
        expect(store.checkingAuth).toBe(true);
        expect(store.isAuthenticated).toBe(false);

        resolveCheck({ success: true, data: { user } });
        const result = await initialization;

        expect(result.success).toBe(true);
        expect(store.user).toEqual(user);
        expect(store.isAuthenticated).toBe(true);
        expect(store.checkingAuth).toBe(false);
        expect(localStorage.getItem('AUTHORIZED')).toBe('true');
        expect(authServiceMock.cacheUser).toHaveBeenCalledWith(user);
        expect(connectSocketMock).toHaveBeenCalledTimes(1);
    });

    it('trusts the cached user while offline without connecting the socket', async () => {
        localStorage.setItem('AUTHORIZED', 'true');
        authServiceMock.getCachedUser.mockResolvedValue(user);
        authServiceMock.getAccessToken.mockResolvedValue('access-token');
        authServiceMock.checkAuth.mockRejectedValue(new Error('Network error'));
        const store = useAuthStore();

        const result = await store.initializeAuth();

        expect(result.success).toBe(true);
        expect(store.user).toEqual(user);
        expect(store.isAuthenticated).toBe(true);
        expect(store.checkingAuth).toBe(false);
        expect(localStorage.getItem('AUTHORIZED')).toBe('true');
        expect(connectSocketMock).not.toHaveBeenCalled();
    });

    it('rejects cached authentication when no session tokens exist', async () => {
        authServiceMock.getCachedUser.mockResolvedValue(user);
        const store = useAuthStore();

        const result = await store.initializeAuth();

        expect(result).toEqual({ success: false, message: 'No tokens found' });
        expect(store.user).toBeNull();
        expect(store.isAuthenticated).toBe(false);
        expect(store.checkingAuth).toBe(false);
        expect(connectSocketMock).not.toHaveBeenCalled();
    });

    it('clears an expired cached session after server verification returns 401', async () => {
        localStorage.setItem('AUTHORIZED', 'true');
        authServiceMock.getCachedUser.mockResolvedValue(user);
        authServiceMock.getAccessToken.mockResolvedValue('expired-access-token');
        authServiceMock.checkAuth.mockRejectedValue(new ApiError('Unauthorized', UNAUTHORIZED));
        const store = useAuthStore();

        const result = await store.initializeAuth();

        expect(result).toEqual({ success: false, message: 'Session expired' });
        expect(store.user).toBeNull();
        expect(store.isAuthenticated).toBe(false);
        expect(store.checkingAuth).toBe(false);
        expect(localStorage.getItem('AUTHORIZED')).toBeNull();
        expect(disconnectSocketMock).toHaveBeenCalledTimes(1);
        expect(authServiceMock.logout).not.toHaveBeenCalled();
        expect(authServiceMock.clearLocalAuth).toHaveBeenCalledTimes(1);
        expect(counterStoreMock.clearState).toHaveBeenCalledTimes(1);
    });

    it('clears a populated authenticated session when logging out', async () => {
        const store = useAuthStore();
        store.user = user;
        localStorage.setItem('AUTHORIZED', 'true');

        const result = await store.logout();

        expect(result.success).toBe(true);
        expect(store.user).toBeNull();
        expect(store.isAuthenticated).toBe(false);
        expect(store.checkingAuth).toBe(false);
        expect(localStorage.getItem('AUTHORIZED')).toBeNull();
        expect(authServiceMock.logout).toHaveBeenCalledTimes(1);
        expect(disconnectSocketMock).toHaveBeenCalledTimes(1);
        expect(authServiceMock.clearLocalAuth).toHaveBeenCalledTimes(1);
        expect(counterStoreMock.clearState).toHaveBeenCalledTimes(1);
        expect(routerPushMock).toHaveBeenCalledWith('/login');
    });

    it('deletes the account and clears a populated local session', async () => {
        const store = useAuthStore();
        store.user = user;
        localStorage.setItem('AUTHORIZED', 'true');

        const result = await store.deleteAccount();

        expect(result.success).toBe(true);
        expect(store.user).toBeNull();
        expect(store.isAuthenticated).toBe(false);
        expect(store.checkingAuth).toBe(false);
        expect(localStorage.getItem('AUTHORIZED')).toBeNull();
        expect(authServiceMock.deleteAccount).toHaveBeenCalledTimes(1);
        expect(disconnectSocketMock).toHaveBeenCalledTimes(1);
        expect(authServiceMock.clearLocalAuth).toHaveBeenCalledTimes(1);
        expect(counterStoreMock.clearState).toHaveBeenCalledTimes(1);
        expect(routerPushMock).toHaveBeenCalledWith('/login');
    });

    it('keeps a populated local session when account deletion fails', async () => {
        authServiceMock.deleteAccount.mockRejectedValue(new Error('Delete failed'));
        const store = useAuthStore();
        store.user = user;
        localStorage.setItem('AUTHORIZED', 'true');

        const result = await store.deleteAccount();

        expect(result.success).toBe(false);
        expect(result.message).toBe('Delete failed');
        expect(store.user).toEqual(user);
        expect(store.isAuthenticated).toBe(true);
        expect(store.checkingAuth).toBe(false);
        expect(localStorage.getItem('AUTHORIZED')).toBe('true');
        expect(disconnectSocketMock).not.toHaveBeenCalled();
        expect(authServiceMock.clearLocalAuth).not.toHaveBeenCalled();
        expect(counterStoreMock.clearState).not.toHaveBeenCalled();
        expect(routerPushMock).not.toHaveBeenCalled();
    });
});
