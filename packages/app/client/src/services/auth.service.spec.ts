import { beforeEach, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';

import apiFetch from '../api';
import { AuthService, USER_KEY } from './auth.service';
import { changeSession } from './session-scope';
import { tokenStorage } from './token-storage';

vi.mock('../api', () => ({ default: vi.fn() }));
vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { removeItem: vi.fn(), setItem: vi.fn() } }));
vi.mock('./token-storage', () => ({
    tokenStorage: {
        getAccessToken: vi.fn(),
        getRefreshToken: vi.fn(),
        setAccessToken: vi.fn(),
        setRefreshToken: vi.fn(),
        clear: vi.fn(),
    },
}));

beforeEach(() => {
    changeSession();
    vi.resetAllMocks();
    vi.mocked(apiFetch).mockResolvedValue({ success: true });
});

it('clears local credentials even when reading the keychain fails', async () => {
    vi.mocked(tokenStorage.getAccessToken).mockRejectedValue(new Error('Keychain unavailable'));
    await expect(AuthService.logout()).rejects.toThrow();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(USER_KEY);
    expect(tokenStorage.clear).toHaveBeenCalledOnce();
});

it('still removes keychain credentials when profile removal fails', async () => {
    vi.mocked(AsyncStorage.removeItem).mockRejectedValueOnce(new Error('Storage unavailable'));
    await expect(AuthService.logout()).rejects.toThrow();
    expect(tokenStorage.clear).toHaveBeenCalledOnce();
    expect(apiFetch).toHaveBeenCalledWith('/users/logout', expect.anything());
});

it.each([
    { request: { email: 'next@example.com', password: 'Password1' }, endpoint: '/users/login' },
    { request: { idToken: 'google-token' }, endpoint: '/users/google' },
    { request: { authorizationCode: 'apple-code', nonce: 'apple-nonce' }, endpoint: '/users/apple' },
])('holds $endpoint until the old logout finishes, after clearing local storage', async ({ request, endpoint }) => {
    let finish!: () => void;
    vi.mocked(apiFetch).mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                finish = () => resolve({ success: true });
            }),
    );
    const logout = AuthService.logout();
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    expect(tokenStorage.clear).toHaveBeenCalledOnce();
    const login = AuthService.login(request);
    await Promise.resolve();
    expect(apiFetch).toHaveBeenCalledTimes(1);
    finish();
    await Promise.all([logout, login]);
    expect(apiFetch).toHaveBeenLastCalledWith(
        endpoint,
        expect.objectContaining({ body: request, requiresAuth: false }),
    );
});

it('does not let a partially failed old credential write finish after a new login', async () => {
    const stored: Record<string, string> = {};
    let finish!: () => void;
    vi.mocked(tokenStorage.setAccessToken).mockImplementation(async (token) => {
        if (token === 'a')
            await new Promise<void>((resolve) => {
                finish = resolve;
            });
        stored.access = token;
    });
    vi.mocked(tokenStorage.setRefreshToken).mockImplementation(async (token) => {
        stored.refresh = token;
    });
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (_key, value) => {
        if (JSON.parse(value).id === 'a') throw new Error('Storage failed');
        stored.userId = JSON.parse(value).id;
    });
    const login = (id: string) => ({
        user: { id, email: `${id}@example.com`, tier: 'BASIC' as const, emailVerified: true },
        accessToken: id,
        refreshToken: id,
    });
    const old = AuthService.saveLogin(login('a'), changeSession('a'));
    const rejected = expect(old).rejects.toThrow();
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    const next = AuthService.saveLogin(login('b'), changeSession('b'));
    // Let an incorrectly released write barrier drain before the old store operation finishes.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    finish();
    await Promise.all([rejected, next]);
    expect(stored).toEqual({ access: 'b', refresh: 'b', userId: 'b' });
});
