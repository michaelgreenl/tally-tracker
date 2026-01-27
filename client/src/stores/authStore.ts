import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import router from '@/router';
import { useCounterStore } from '@/stores/counterStore';
import { AuthService } from '@/services/auth.service';
import { ApiError } from '@/utils/errors';
import { ok, fail } from '@/utils/result';

import type { StoreResponse } from '@/types/index';
import type { AuthRequest, UpdateUserRequest } from '@/types/shared/requests';
import type { ClientUser } from '@/types/shared/models';

const USER_KEY = 'auth_user_profile';
const TOKEN_KEY = 'auth_token';

export const useAuthStore = defineStore('auth', () => {
    const user = ref<ClientUser | null>(null);
    const isAuthenticated = computed(() => !!user.value);
    const checkingAuth = ref(false);

    async function initializeAuth(): Promise<StoreResponse> {
        checkingAuth.value = true;

        const cached = await AuthService.getCachedUser();
        if (cached) user.value = cached;

        const token = await AuthService.getToken();
        if (!token) {
            user.value = null;
            checkingAuth.value = false;
            return fail('No token found');
        }

        try {
            const res = await AuthService.checkAuth();

            if (res.success && res.data?.user) {
                user.value = res.data.user;
                await AuthService.cacheUser(user.value);

                if (res.data?.token) {
                    await AuthService.setToken(res.data.token);
                }

                return ok();
            }

            return fail('Auth check failed');
        } catch (error: any) {
            console.error('Auth check error:', error);

            let status = 0;
            if (error instanceof ApiError) status = error.status || 0;

            if (status === 401) {
                console.warn('Token expired. Logging out.');
                await logout(false);
                return fail('Session expired');
            }

            console.warn('Network error during auth check. Trusting cached profile.');
            if (user.value) return ok();

            return fail('Network error');
        } finally {
            checkingAuth.value = false;
        }
    }

    async function login(data: AuthRequest): Promise<StoreResponse> {
        try {
            const res = await AuthService.login(data);

            if (res.success && res.data?.user) {
                user.value = res.data.user;
                await AuthService.cacheUser(user.value);

                if (res.data?.token) await AuthService.setToken(res.data.token);
                localStorage.setItem('AUTHORIZED', 'true');

                const counterStore = useCounterStore();
                counterStore.consolidateGuestCounters();

                return ok();
            }

            return fail('Login Failed');
        } catch (error: any) {
            return fail(error.message);
        }
    }

    async function logout(notifyServer = true): Promise<StoreResponse> {
        try {
            if (notifyServer) await AuthService.logout();
        } catch (error: any) {
            console.warn('Server logout failed', error);
        } finally {
            user.value = null;
            await AuthService.clearLocalAuth();
            router.push({ name: 'Login' });
        }

        return ok();
    }

    async function register(data: AuthRequest): Promise<StoreResponse> {
        try {
            if (!data.email && !data.phone) return fail('Registration requires phone or email as input');

            const res = await AuthService.register(data);
            if (res.success) return ok();

            return fail('Registration failed');
        } catch (error: any) {
            console.error('Registration failed:', error.message);
            return fail(error.message);
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
        } catch (error: any) {
            console.error('Failed to update user: ', error.message);
            return fail(error.message);
        }
    }

    return {
        user,
        isAuthenticated,
        checkingAuth,
        initializeAuth,
        register,
        login,
        logout,
        updateUser,
    };
});
