import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import apiFetch from '@/api';
import router from '@/router';

import type { ApiResponse, AuthResponse } from '@/types/shared/responses';
import type { StoreResponse } from '@/types/index';
import type { AuthRequest, UpdateUserRequest } from '@/types/shared/requests';
import type { ClientUser } from '@/types/shared/models';

export const useAuthStore = defineStore('auth', () => {
    const user = ref<ClientUser | null>(null);
    const initLoading = ref(true);
    const isAuthenticated = computed(() => !!user.value);

    async function initializeAuth(): Promise<StoreResponse> {
        try {
            const res = await apiFetch<AuthResponse>('/users/check-auth', {
                method: 'GET',
            });

            if (res.success) {
                user.value = { ...res.data?.user } as ClientUser;
                localStorage.setItem('AUTHORIZED', 'true');
                return { success: true };
            } else {
                user.value = null;
                localStorage.setItem('AUTHORIZED', 'false');
                return { success: false, message: 'User not authenticated' };
            }
        } catch (error: any) {
            user.value = null;
            console.error('Auth check failed:', error.message);
            return { success: false, message: error.message };
        } finally {
            initLoading.value = false;
        }
    }

    async function register(data: AuthRequest): Promise<StoreResponse> {
        try {
            if (!data.email && !data.phone)
                return { success: false, message: 'Registration requires phone or email as input' };

            const res = await apiFetch<AuthResponse, AuthRequest>('/users/auth', {
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

    async function login(data: AuthRequest): Promise<StoreResponse> {
        try {
            if (!data.email && !data.phone)
                return { success: false, message: 'Login requires phone or email as input' };

            const res = await apiFetch<AuthResponse, AuthRequest>('/users/login', {
                method: 'POST',
                body: data,
            });

            if (res.success) {
                user.value = { ...res.data?.user } as ClientUser;

                localStorage.setItem('AUTHORIZED', 'true');
                return { success: true };
            }

            return { success: false, message: 'Login Failed' };
        } catch (error: any) {
            console.error('Login failed:', error.message);
            return { success: false, message: error.message };
        }
    }

    async function logout(): Promise<StoreResponse> {
        try {
            const res = await apiFetch<AuthResponse>('/users/logout', { method: 'POST' });

            if (res.success) return { success: true };

            return { success: false, message: 'Login failed' };
        } catch (error: any) {
            console.error('Logout failed:', error.message);
            return { success: false, message: error.message };
        } finally {
            localStorage.setItem('AUTHORIZED', 'false');
            user.value = null;
            router.push({ name: 'Login' });
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
        initializeAuth,
        initLoading,
        register,
        login,
        logout,
        updateUser,
    };
});
