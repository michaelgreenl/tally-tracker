import apiFetch from '@/api';
import { Preferences } from '@capacitor/preferences';

import type { AuthResponse } from '@/types/shared/responses';
import type { ClientUser } from '@/types/shared/models';
import type { AuthRequest, UpdateUserRequest } from '@/types/shared/requests';

const USER_KEY = 'auth_user_profile';
const TOKEN_KEY = 'auth_token';

export const AuthService = {
    async getCachedUser(): Promise<ClientUser | null> {
        const { value } = await Preferences.get({ key: USER_KEY });
        return value ? JSON.parse(value) : null;
    },

    async cacheUser(userData: ClientUser | null) {
        if (userData) {
            await Preferences.set({ key: USER_KEY, value: JSON.stringify(userData) });
        } else {
            await Preferences.remove({ key: USER_KEY });
        }
    },

    async getToken() {
        const { value } = await Preferences.get({ key: TOKEN_KEY });
        return value;
    },

    async setToken(token: string) {
        await Preferences.set({ key: TOKEN_KEY, value: token });
    },

    async clearLocalAuth() {
        await Preferences.remove({ key: TOKEN_KEY });
        await Preferences.remove({ key: USER_KEY });
        localStorage.removeItem('AUTHORIZED');
    },

    async checkAuth() {
        return apiFetch<AuthResponse>('/users/check-auth', { method: 'GET' });
    },

    async login(data: AuthRequest) {
        return apiFetch<AuthResponse, AuthRequest>('/users/login', { method: 'POST', body: data });
    },

    async logout() {
        return apiFetch<AuthResponse>('/users/logout', { method: 'POST' });
    },

    async register(data: AuthRequest) {
        return apiFetch<AuthResponse, AuthRequest>('/users', { method: 'POST', body: data });
    },

    async updateUser(data: UpdateUserRequest) {
        return apiFetch<AuthResponse, UpdateUserRequest>('/users', { method: 'PUT', body: data });
    },
};
