import { UNAUTHORIZED } from '@tally/utils';
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { Capacitor } from '@capacitor/core';
import router from '@/router';
import { connectSocket, disconnectSocket } from '@/socket';
import { useCounterStore } from '@/stores/counterStore';
import { AuthService } from '@/services/auth.service';
import { SyncManager } from '@/services/sync/manager';
import { ApiError, getErrorMessage } from '@/utils/errors';
import { ok, fail } from '@/utils/result';

import type { StoreResponse } from '@/types/index';
import type { AuthRequest, UpdateUserRequest, ClientUser } from '@tally/core';

export const useAuthStore = defineStore('auth', () => {
    const user = ref<ClientUser | null>(null);
    const isAuthenticated = computed(() => !!user.value);
    const isPremium = computed(() => user.value?.tier === 'PREMIUM');
    const checkingAuth = ref(false);

    /**
     * Cold-start auth flow. Called by the router guard when the AUTHORIZED flag
     * exists but the store isn't hydrated yet (e.g., page refresh, app reopen).
     *
     * Loads cached user for instant UI, then validates with the server.
     * apiFetch handles 401 + refresh transparently — if we still get a 401 here,
     * the refresh token is also expired and the session is over.
     * On network failure, trusts the cache so the app remains usable offline.
     */
    async function initializeAuth(): Promise<StoreResponse> {
        checkingAuth.value = true;

        const cached = await AuthService.getCachedUser();
        if (cached) user.value = cached;

        // Quick bail if no tokens exist at all
        const accessToken = await AuthService.getAccessToken();
        const refreshToken = await AuthService.getRefreshToken();
        if (!accessToken && !refreshToken) {
            user.value = null;
            checkingAuth.value = false;
            return fail('No tokens found');
        }

        try {
            const res = await AuthService.checkAuth();

            if (res.success && res.data?.user) {
                user.value = res.data.user;
                await AuthService.cacheUser(user.value);
                connectSocket();
                return ok();
            }

            return fail('Auth check failed');
        } catch (error: unknown) {
            console.error('Auth check error:', error);

            let status = 0;
            if (error instanceof ApiError) status = error.status || 0;

            // 401 here means refresh also failed — session is truly expired
            if (status === UNAUTHORIZED) {
                console.warn('Session expired. Logging out.');
                await logout(false);
                return fail('Session expired');
            }

            // Network error — trust cached profile so app works offline
            console.warn('Network error during auth check. Trusting cached profile.');
            if (user.value) return ok();

            return fail('Network error');
        } finally {
            checkingAuth.value = false;
        }
    }

    async function login(data: AuthRequest): Promise<StoreResponse> {
        try {
            // Native clients always use refresh tokens
            if (Capacitor.isNativePlatform()) {
                data.rememberMe = true;
            }

            const res = await AuthService.login(data);

            if (res.success && res.data?.user) {
                user.value = res.data.user;
                await AuthService.cacheUser(user.value);

                if (res.data.accessToken) await AuthService.setAccessToken(res.data.accessToken);
                if (res.data.refreshToken) await AuthService.setRefreshToken(res.data.refreshToken);

                // Persisted flag checked by the router guard to trigger initializeAuth on cold start
                localStorage.setItem('AUTHORIZED', 'true');

                const counterStore = useCounterStore();
                await counterStore.consolidateGuestCounters();
                connectSocket();
                await SyncManager.processQueue();

                return ok();
            }

            return fail('Login Failed');
        } catch (error: unknown) {
            return fail(getErrorMessage(error, 'Login Failed'));
        }
    }

    async function logout(notifyServer = true): Promise<StoreResponse> {
        try {
            if (notifyServer) await AuthService.logout();
        } catch (error: unknown) {
            console.warn('Server logout failed', error);
        } finally {
            disconnectSocket();
            user.value = null;
            await AuthService.clearLocalAuth();
            const counterStore = useCounterStore();
            await counterStore.clearState();
            router.push('/login');
        }

        return ok();
    }

    async function register(data: AuthRequest): Promise<StoreResponse> {
        try {
            if (!data.email) return fail('Registration requires email as input');

            const res = await AuthService.register(data);
            if (res.success) return ok();

            return fail('Registration failed');
        } catch (error: unknown) {
            const message = getErrorMessage(error, 'Registration failed');
            console.error('Registration failed:', message);
            return fail(message);
        }
    }

    async function updateUser(data: UpdateUserRequest): Promise<StoreResponse> {
        try {
            const res = await AuthService.updateUser(data);

            if (res.success) {
                const { password: _, ...updates } = data;
                user.value = { ...user.value, ...updates } as ClientUser;
                await AuthService.cacheUser(user.value);

                return ok();
            }

            return fail('Failed to update user');
        } catch (error: unknown) {
            const message = getErrorMessage(error, 'Failed to update user');
            console.error('Failed to update user: ', message);
            return fail(message);
        }
    }

    return {
        user,
        isAuthenticated,
        isPremium,
        checkingAuth,
        initializeAuth,
        register,
        login,
        logout,
        updateUser,
    };
});
