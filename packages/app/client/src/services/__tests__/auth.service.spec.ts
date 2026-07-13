import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Preferences } from '@capacitor/preferences';

const { apiFetchMock, isNativePlatformMock } = vi.hoisted(() => ({
    apiFetchMock: vi.fn(),
    isNativePlatformMock: vi.fn(),
}));

vi.mock('@/api', () => ({
    default: apiFetchMock,
}));

vi.mock('@capacitor/core', () => ({
    Capacitor: {
        isNativePlatform: isNativePlatformMock,
    },
}));

vi.mock('@capacitor/preferences', () => ({
    Preferences: {
        get: vi.fn(),
        remove: vi.fn(),
        set: vi.fn(),
    },
}));

import { AuthService } from '../auth.service';

beforeEach(() => {
    apiFetchMock.mockReset();
    isNativePlatformMock.mockReset();
    vi.mocked(Preferences.get).mockReset();
    vi.mocked(Preferences.remove).mockReset();
    vi.mocked(Preferences.set).mockReset();
    apiFetchMock.mockResolvedValue({ success: true });
});

describe('AuthService.logout', () => {
    it('sends the stored refresh token when logging out from native platforms', async () => {
        isNativePlatformMock.mockReturnValue(true);
        vi.mocked(Preferences.get).mockResolvedValue({ value: '2faf6705-a661-42e9-9bd8-54155697cc2a' });

        await AuthService.logout();

        expect(Preferences.get).toHaveBeenCalledWith({ key: 'refresh_token' });
        expect(apiFetchMock).toHaveBeenCalledWith('/users/logout', {
            method: 'POST',
            body: { refreshToken: '2faf6705-a661-42e9-9bd8-54155697cc2a' },
        });
    });

    it('uses cookie-based logout without reading preferences on web', async () => {
        isNativePlatformMock.mockReturnValue(false);

        await AuthService.logout();

        expect(Preferences.get).not.toHaveBeenCalled();
        expect(apiFetchMock).toHaveBeenCalledWith('/users/logout', { method: 'POST' });
    });
});

describe('AuthService.deleteAccount', () => {
    it('sends DELETE to the account endpoint', async () => {
        await AuthService.deleteAccount();

        expect(apiFetchMock).toHaveBeenCalledOnce();
        expect(apiFetchMock).toHaveBeenCalledWith('/users', { method: 'DELETE' });
    });
});
