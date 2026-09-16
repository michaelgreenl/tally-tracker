// @vitest-environment jsdom
import { act, createElement, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { SessionProvider, useSession } from './session';

import type { ClientUser } from '@tally/core/client';
import type { Root } from 'react-dom/client';

const { auth, billing, apiKey, appState, router } = vi.hoisted(() => ({
    auth: {
        getCachedUser: vi.fn(),
        getAccessToken: vi.fn(),
        getRefreshToken: vi.fn(),
        checkAuth: vi.fn(),
        cacheUser: vi.fn(),
        clearLocalAuth: vi.fn(),
        login: vi.fn(),
        logout: vi.fn(),
        setAccessToken: vi.fn(),
        setRefreshToken: vi.fn(),
    },
    billing: { sync: vi.fn(), subscribe: vi.fn() },
    apiKey: vi.fn(),
    appState: { addEventListener: vi.fn() },
    router: { replace: vi.fn() },
}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' }, AppState: appState }));
vi.mock('expo-router', () => ({ useRouter: () => router }));
vi.mock('./api', () => ({
    ApiError: Error,
    getErrorMessage: (_error: unknown, message: string) => message,
    setUnauthorizedHandler: () => () => undefined,
}));
vi.mock('./services/auth.service', () => ({ AuthService: auth }));
vi.mock('./services/billing.service', () => ({ BillingService: billing, billingApiKey: apiKey }));

const basic = { id: 'account-a', email: 'a@example.com', tier: 'BASIC', emailVerified: true } as ClientUser;
const premium = { ...basic, tier: 'PREMIUM' } as ClientUser;
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
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    apiKey.mockReturnValue('');
    auth.getCachedUser.mockResolvedValue(basic);
    auth.getAccessToken.mockResolvedValue('access');
    auth.checkAuth.mockResolvedValue({ success: true, data: { user: basic } });
    root = createRoot(document.createElement('div'));
    await act(async () => root.render(createElement(SessionProvider, null, createElement(Probe))));
    auth.cacheUser.mockClear();
});

afterEach(async () => {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
});

it('applies verified Premium access and later removes it after server revocation', async () => {
    auth.checkAuth.mockResolvedValueOnce({ success: true, data: { user: premium } });
    await act(async () => {
        await session.refreshPurchases();
    });
    expect(session.isPremium).toBe(true);
    expect(auth.cacheUser).toHaveBeenLastCalledWith(premium);
    await act(async () => {
        await session.refreshPurchases();
    });
    expect(session.isPremium).toBe(false);
    expect(auth.cacheUser).toHaveBeenLastCalledWith(basic);
});

it('does not grant access when server verification fails', async () => {
    billing.sync.mockRejectedValue(new Error('Provider unavailable'));
    auth.checkAuth.mockClear();
    await act(async () => {
        await expect(session.refreshPurchases()).rejects.toThrow();
    });
    expect(session.isPremium).toBe(false);
    expect(auth.checkAuth).not.toHaveBeenCalled();
    expect(auth.cacheUser).not.toHaveBeenCalled();
});

it('refreshes through the server on customer changes and app foreground, then removes listeners at logout', async () => {
    await act(async () => root.unmount());
    const removeCustomer = vi.fn();
    const removeAppState = vi.fn();
    apiKey.mockReturnValue('test_example');
    billing.subscribe.mockResolvedValue(removeCustomer);
    appState.addEventListener.mockReturnValue({ remove: removeAppState });
    root = createRoot(document.createElement('div'));
    await act(async () => root.render(createElement(SessionProvider, null, createElement(Probe))));
    const onCustomer = billing.subscribe.mock.calls[0][1];
    const onAppState = appState.addEventListener.mock.calls[0][1];
    auth.checkAuth.mockResolvedValueOnce({ success: true, data: { user: premium } });
    await act(async () => onCustomer({}));
    expect(session.isPremium).toBe(true);
    await act(async () => onAppState('active'));
    expect(session.isPremium).toBe(false);
    await act(async () => {
        await session.logout();
    });
    expect(removeCustomer).toHaveBeenCalledOnce();
    expect(removeAppState).toHaveBeenCalledOnce();
});

it('does not apply an old account’s verification after logout and another login', async () => {
    let complete!: (response: unknown) => void;
    auth.checkAuth.mockReturnValueOnce(
        new Promise((resolve) => {
            complete = resolve;
        }),
    );
    const refresh = session.refreshPurchases();
    const rejected = expect(refresh).rejects.toThrow();
    await act(async () => {
        await session.logout();
    });
    const other = { ...basic, id: 'account-b' };
    auth.login.mockResolvedValue({ success: true, data: { user: other } });
    await act(async () => {
        await session.login({ email: 'b@example.com', password: 'Password1' });
    });
    auth.cacheUser.mockClear();
    await act(async () => {
        complete({ success: true, data: { user: premium } });
        await rejected;
    });
    expect(session.user).toEqual(other);
    expect(auth.cacheUser).not.toHaveBeenCalled();
});

it('repairs the profile cache if logout happens while verification is writing it', async () => {
    let finishCache!: () => void;
    auth.checkAuth.mockResolvedValueOnce({ success: true, data: { user: premium } });
    auth.cacheUser.mockReturnValueOnce(
        new Promise<void>((resolve) => {
            finishCache = resolve;
        }),
    );
    const refresh = session.refreshPurchases();
    const rejected = expect(refresh).rejects.toThrow();
    await vi.waitFor(() => expect(auth.cacheUser).toHaveBeenCalledWith(premium));
    await act(async () => {
        await session.logout();
    });
    await act(async () => {
        finishCache();
        await rejected;
    });
    expect(session.user).toBeNull();
    expect(auth.cacheUser).toHaveBeenLastCalledWith(null);
});
