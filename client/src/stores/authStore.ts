import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import apiFetch from '@/api';
import router from '@/router';

interface User {
    id: string;
    username: string;
}

interface AuthResponse {
    success: boolean;
    id?: string;
    username?: string;
    message?: string;
}

export const useAuthStore = defineStore('auth', () => {
    const user = ref<User | null>(null);
    const initLoading = ref(true);
    const isAuthenticated = computed(() => !!user.value);

    async function initializeAuth() {
        try {
            const userData = await apiFetch<AuthResponse>('/users/check-auth', {
                method: 'GET',
            });

            if (userData.success && userData.id && userData.username) {
                user.value = { id: userData.id, username: userData.username };
                localStorage.setItem('AUTHORIZED', 'true');
                initLoading.value = false;
            } else {
                user.value = null;
                localStorage.setItem('AUTHORIZED', 'false');
                initLoading.value = false;
            }
        } catch (error: any) {
            user.value = null;
            console.error('Auth check failed:', error.message);
        }
    }

    async function register(username: string, password: string): Promise<{ success: boolean; message?: string }> {
        try {
            await apiFetch('/users/auth', {
                method: 'POST',
                body: { username, password },
            });
            return { success: true };
        } catch (error: any) {
            console.error('Registration failed:', error.message);
            return { success: false, message: error.message };
        }
    }

    async function login(username: string, password: string): Promise<boolean> {
        try {
            const userData = await apiFetch<AuthResponse>('/users/login', {
                method: 'POST',
                body: { username, password },
            });

            if (userData.id && userData.username) {
                user.value = { id: userData.id, username: userData.username };
                localStorage.setItem('AUTHORIZED', 'true');
                return true;
            }
            return false;
        } catch (error: any) {
            console.error('Login failed:', error.message);
            return false;
        }
    }

    async function logout() {
        try {
            await apiFetch('/users/logout', { method: 'POST' });
        } catch (error) {
            console.error('Logout failed:', error);
        } finally {
            localStorage.setItem('AUTHORIZED', 'false');
            user.value = null;
            router.push({ name: 'Login' });
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
    };
});
