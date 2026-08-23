import { beforeEach, describe, expect, it, vi } from 'vitest';

import { restoreSession } from './session';

const { authService } = vi.hoisted(() => ({
    authService: {
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
}));

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('expo-router', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock('./services/auth.service', () => ({ AuthService: authService }));

describe('restoreSession', () => {
    beforeEach(() => {
        for (const mock of Object.values(authService)) mock.mockReset();
        authService.getCachedUser.mockResolvedValue({ id: 'user-1', email: 'user@example.com', tier: 'BASIC' });
        authService.getAccessToken.mockResolvedValue(null);
        authService.getRefreshToken.mockResolvedValue(null);
        authService.clearLocalAuth.mockResolvedValue(undefined);
    });

    it('rejects a cached native user when no session token remains', async () => {
        await expect(restoreSession()).resolves.toBeNull();
        expect(authService.clearLocalAuth).toHaveBeenCalledOnce();
        expect(authService.checkAuth).not.toHaveBeenCalled();
    });

    it('does not trust a cached native user when secure storage fails', async () => {
        authService.getAccessToken.mockRejectedValue(new Error('Keychain unavailable'));

        await expect(restoreSession()).resolves.toBeNull();
        expect(authService.checkAuth).not.toHaveBeenCalled();
    });
});
