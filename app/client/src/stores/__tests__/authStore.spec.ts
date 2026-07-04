import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const { authServiceMock, connectSocketMock, counterStoreMock, disconnectSocketMock, localStorageMock, routerPushMock } =
    vi.hoisted(() => ({
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
        localStorageMock: {
            getItem: vi.fn(),
            removeItem: vi.fn(),
            setItem: vi.fn(),
        },
        routerPushMock: vi.fn(),
    }));

vi.stubGlobal('localStorage', {
    getItem: localStorageMock.getItem,
    removeItem: localStorageMock.removeItem,
    setItem: localStorageMock.setItem,
});

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

describe('authStore socket lifecycle', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();

        authServiceMock.cacheUser.mockResolvedValue(undefined);
        authServiceMock.clearLocalAuth.mockResolvedValue(undefined);
        authServiceMock.logout.mockResolvedValue({ success: true });
        authServiceMock.setAccessToken.mockResolvedValue(undefined);
        authServiceMock.setRefreshToken.mockResolvedValue(undefined);
        counterStoreMock.clearState.mockResolvedValue(undefined);
        counterStoreMock.consolidateGuestCounters.mockResolvedValue(undefined);
    });

    it('connects the socket after login stores the authenticated session', async () => {
        authServiceMock.login.mockResolvedValue({
            success: true,
            data: {
                user,
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
            },
        });

        const store = useAuthStore();

        const result = await store.login({ email: 'test@test.com', password: 'password123' });

        expect(result.success).toBe(true);
        expect(authServiceMock.setAccessToken).toHaveBeenCalledWith('access-token');
        expect(authServiceMock.setRefreshToken).toHaveBeenCalledWith('refresh-token');
        expect(counterStoreMock.consolidateGuestCounters).toHaveBeenCalledTimes(1);
        expect(connectSocketMock).toHaveBeenCalledTimes(1);
    });

    it('connects the socket after cold-start auth is verified by the server', async () => {
        authServiceMock.getCachedUser.mockResolvedValue(null);
        authServiceMock.getAccessToken.mockResolvedValue('access-token');
        authServiceMock.getRefreshToken.mockResolvedValue(null);
        authServiceMock.checkAuth.mockResolvedValue({
            success: true,
            data: { user },
        });

        const store = useAuthStore();

        const result = await store.initializeAuth();

        expect(result.success).toBe(true);
        expect(authServiceMock.cacheUser).toHaveBeenCalledWith(user);
        expect(connectSocketMock).toHaveBeenCalledTimes(1);
    });

    it('does not connect the socket when offline auth only trusts the cached user', async () => {
        authServiceMock.getCachedUser.mockResolvedValue(user);
        authServiceMock.getAccessToken.mockResolvedValue('access-token');
        authServiceMock.getRefreshToken.mockResolvedValue(null);
        authServiceMock.checkAuth.mockRejectedValue(new Error('Network error'));

        const store = useAuthStore();

        const result = await store.initializeAuth();

        expect(result.success).toBe(true);
        expect(connectSocketMock).not.toHaveBeenCalled();
    });

    it('disconnects the socket when logging out', async () => {
        const store = useAuthStore();

        const result = await store.logout();

        expect(result.success).toBe(true);
        expect(authServiceMock.logout).toHaveBeenCalledTimes(1);
        expect(disconnectSocketMock).toHaveBeenCalledTimes(1);
        expect(authServiceMock.clearLocalAuth).toHaveBeenCalledTimes(1);
        expect(counterStoreMock.clearState).toHaveBeenCalledTimes(1);
        expect(routerPushMock).toHaveBeenCalledWith('/login');
    });
});
