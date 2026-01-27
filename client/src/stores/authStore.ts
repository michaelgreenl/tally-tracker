import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import apiFetch from '@/api';
import router from '@/router';
import { useCounterStore } from '@/stores/counterStore';
import { Preferences } from '@capacitor/preferences';
import { ApiError } from '@/utils/errors';

import type { AuthResponse } from '@/types/shared/responses';
import type { StoreResponse } from '@/types/index';
import type { AuthRequest, UpdateUserRequest } from '@/types/shared/requests';
import type { ClientUser } from '@/types/shared/models';

const USER_KEY = 'auth_user_profile';
const TOKEN_KEY = 'auth_token';

export const useAuthStore = defineStore('auth', () => {
    const user = ref<ClientUser | null>(null);
    const isAuthenticated = computed(() => !!user.value);
    const checkingAuth = ref(false);

    async function cacheUser(userData: ClientUser | null) {
        if (userData) {
            await Preferences.set({ key: USER_KEY, value: JSON.stringify(userData) });
        } else {
            await Preferences.remove({ key: USER_KEY });
        }
    }

    async function loadCachedUser() {
        const { value } = await Preferences.get({ key: USER_KEY });

        if (value) {
            user.value = JSON.parse(value);
        }
    }

    async function initializeAuth(): Promise<StoreResponse> {
        checkingAuth.value = true;

        await loadCachedUser();

        try {
            const res = await apiFetch<AuthResponse>('/users/check-auth', {
                method: 'GET',
            });

            if (res.success && res.data?.user) {
                user.value = res.data.user;
                await cacheUser(user.value);

                if (res.data?.token) {
                    await Preferences.set({ key: TOKEN_KEY, value: res.data.token });
                }

                return { success: true };
            }

            return { success: false, message: 'Auth check failed' };
        } catch (error: any) {
            console.error('Auth check error:', error);

            let status = 0;
            if (error instanceof ApiError) status = error.status || 0;

            if (status === 401) {
                console.warn('Token expired. Logging out.');
                await logout(false);
                return { success: false, message: 'Session expired' };
            }

            console.warn('Network error during auth check. Trusting cached profile.');
            if (user.value) {
                return { success: true };
            } else {
                return { success: false, message: 'Network error during auth check. Trusting cached profile.' };
            }
        } finally {
            checkingAuth.value = false;
        }
    }

    async function login(data: AuthRequest): Promise<StoreResponse> {
        try {
            const res = await apiFetch<AuthResponse, AuthRequest>('/users/login', {
                method: 'POST',
                body: data,
            });

            if (res.success && res.data?.user) {
                user.value = res.data.user;
                await cacheUser(user.value);

                if (res.data?.token) {
                    await Preferences.set({ key: TOKEN_KEY, value: res.data.token });
                }

                localStorage.setItem('AUTHORIZED', 'true');

                const counterStore = useCounterStore();
                counterStore.consolidateGuestCounters();
                return { success: true };
            }

            return { success: false, message: 'Login Failed' };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }

    async function clearLocalAuth() {
        user.value = null;
        await Preferences.remove({ key: TOKEN_KEY });
        await Preferences.remove({ key: USER_KEY });
        localStorage.removeItem('AUTHORIZED');
    }

    async function logout(notifyServer = true): Promise<StoreResponse> {
        try {
            if (notifyServer) {
                await apiFetch<AuthResponse>('/users/logout', { method: 'POST' });
            }
        } catch (error: any) {
            console.warn('Server logout failed', error);
        } finally {
            await clearLocalAuth();
            router.push({ name: 'Login' });
        }
        return { success: true };
    }

    async function register(data: AuthRequest): Promise<StoreResponse> {
        try {
            if (!data.email && !data.phone)
                return { success: false, message: 'Registration requires phone or email as input' };

            const res = await apiFetch<AuthResponse, AuthRequest>('/users', {
                method: 'POST',
                body: data,
            });

            if (res.success) return { success: true };

            return { success: false, message: 'Registration failed' };
        } catch (error: any) {
            console.error('Registration failed:', error.message);
            return { success: false, message: error.message };
        }
    }

    async function updateUser(data: UpdateUserRequest): Promise<StoreResponse> {
        try {
            const res = await apiFetch<AuthResponse, UpdateUserRequest>('/users', {
                method: 'PUT',
                body: data,
            });

            if (res.success) {
                const { password: _, ...updates } = data;

                user.value = { ...user.value, ...updates } as ClientUser;
                await cacheUser(user.value);
                return { success: true };
            }

            return { success: false, message: 'Failed to update user' };
        } catch (error: any) {
            console.error('Failed to update user: ', error.message);
            return { success: false, message: error.message };
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
