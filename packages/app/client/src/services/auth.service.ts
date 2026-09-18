import AsyncStorage from '@react-native-async-storage/async-storage';

import apiFetch from '../api';
import { tokenStorage } from './token-storage';
import { CounterStorage } from './counter-storage';
import { SyncQueue } from './sync-queue';
import { assertSession, getSessionScope, SessionChangedError, writeSession } from './session-scope';
import type { SessionScope } from './session-scope';

import type {
    AuthRequest,
    AuthResponse,
    ClientUser,
    EmailAddressRequest,
    EmailOtpRequest,
    PasswordResetRequest,
    RefreshRequest,
} from '@tally/core/client';

export const USER_KEY = 'auth_user_profile';
let pendingLogout: Promise<unknown> = Promise.resolve();

export const AuthService = {
    waitForLogout: () => pendingLogout,
    async getCachedUser(): Promise<ClientUser | null> {
        const value = await AsyncStorage.getItem(USER_KEY);
        return value ? (JSON.parse(value) as ClientUser) : null;
    },

    cacheUser(user: ClientUser | null, scope = getSessionScope()) {
        return writeSession(scope, () =>
            user ? AsyncStorage.setItem(USER_KEY, JSON.stringify(user)) : AsyncStorage.removeItem(USER_KEY),
        );
    },

    getAccessToken: tokenStorage.getAccessToken,
    setAccessToken: tokenStorage.setAccessToken,
    getRefreshToken: tokenStorage.getRefreshToken,
    setRefreshToken: tokenStorage.setRefreshToken,

    clearLocalAuth(scope = getSessionScope()) {
        return writeSession(scope, async () => {
            try {
                await AsyncStorage.removeItem(USER_KEY);
            } finally {
                await tokenStorage.clear();
            }
        });
    },

    saveLogin(data: NonNullable<AuthResponse['data']>, scope: SessionScope) {
        return writeSession(scope, async () => {
            await tokenStorage.clear();
            if (data.accessToken) await tokenStorage.setAccessToken(data.accessToken);
            if (data.refreshToken) await tokenStorage.setRefreshToken(data.refreshToken);
            await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
        });
    },

    checkAuth() {
        return apiFetch<AuthResponse>('/users/check-auth', { method: 'GET' });
    },

    async login(data: AuthRequest) {
        const scope = getSessionScope();
        // A late logout response must not clear the next login's cookies.
        await pendingLogout;
        assertSession(scope);
        return apiFetch<AuthResponse, AuthRequest>('/users/login', {
            method: 'POST',
            body: data,
            requiresAuth: false,
            sessionScope: scope,
        });
    },

    logout(scope = getSessionScope(), userId: string | null = null) {
        const result = (async () => {
            const [access, refresh] = await Promise.allSettled([
                tokenStorage.getAccessToken(),
                tokenStorage.getRefreshToken(),
            ]);
            let localFailed = false;
            try {
                await this.clearLocalAuth(scope);
            } catch {
                localFailed = true;
            }
            const accessToken = access.status === 'fulfilled' ? access.value : null;
            const refreshToken = refresh.status === 'fulfilled' ? refresh.value : null;
            const body: RefreshRequest | undefined = refreshToken ? { refreshToken } : undefined;
            // Remote revocation must still run if local storage fails.
            const response = await apiFetch<AuthResponse, RefreshRequest>('/users/logout', {
                method: 'POST',
                body,
                requiresAuth: false,
                sessionScope: null,
                headers: {
                    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                    ...(userId ? { 'X-Account-Id': userId } : {}),
                },
            }).catch(() => null);
            if (localFailed) throw new Error('Could not clear this device. Restart and try again.');
            if (!response?.success || access.status === 'rejected' || refresh.status === 'rejected') {
                throw new Error('Signed out here. Other devices may still be signed in.');
            }
            return response;
        })();
        pendingLogout = result.catch(() => undefined);
        return result;
    },

    deleteAccount() {
        return apiFetch<AuthResponse>('/users', { method: 'DELETE' });
    },

    async clearDeletedAccount(userId: string, scope: SessionScope) {
        const results = await Promise.allSettled([
            this.clearLocalAuth(scope),
            writeSession(null, () => CounterStorage.removeAccount(userId)),
            SyncQueue.removeAccount(userId),
        ]);
        if (results.some((result) => result.status === 'rejected' && !(result.reason instanceof SessionChangedError))) {
            throw new Error('Account deleted. Could not clear all device data.');
        }
    },

    register(data: AuthRequest) {
        return apiFetch<AuthResponse, AuthRequest>('/users', { method: 'POST', body: data, requiresAuth: false });
    },

    requestEmailVerification(data: EmailAddressRequest) {
        return apiFetch<AuthResponse, EmailAddressRequest>('/users/verify-email/request', {
            method: 'POST',
            body: data,
            requiresAuth: false,
        });
    },

    verifyEmail(data: EmailOtpRequest) {
        return apiFetch<AuthResponse, EmailOtpRequest>('/users/verify-email', {
            method: 'POST',
            body: data,
            requiresAuth: false,
        });
    },

    requestPasswordReset(data: EmailAddressRequest) {
        return apiFetch<AuthResponse, EmailAddressRequest>('/users/reset-password/request', {
            method: 'POST',
            body: data,
            requiresAuth: false,
        });
    },

    verifyPasswordResetCode(data: EmailOtpRequest) {
        return apiFetch<AuthResponse, EmailOtpRequest>('/users/reset-password/verify', {
            method: 'POST',
            body: data,
            requiresAuth: false,
        });
    },

    resetPassword(data: PasswordResetRequest) {
        return apiFetch<AuthResponse, PasswordResetRequest>('/users/reset-password', {
            method: 'POST',
            body: data,
            requiresAuth: false,
        });
    },
};
