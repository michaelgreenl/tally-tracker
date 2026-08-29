import AsyncStorage from '@react-native-async-storage/async-storage';

import apiFetch from '../api';
import { tokenStorage } from './token-storage';

import type {
    AuthRequest,
    AuthResponse,
    ClientUser,
    EmailAddressRequest,
    EmailOtpRequest,
    PasswordResetRequest,
    RefreshRequest,
    UpdateUserRequest,
} from '@tally/core/client';

const USER_KEY = 'auth_user_profile';

export const AuthService = {
    async getCachedUser(): Promise<ClientUser | null> {
        const value = await AsyncStorage.getItem(USER_KEY);
        return value ? (JSON.parse(value) as ClientUser) : null;
    },

    async cacheUser(user: ClientUser | null) {
        if (user) return AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
        return AsyncStorage.removeItem(USER_KEY);
    },

    getAccessToken: tokenStorage.getAccessToken,
    setAccessToken: tokenStorage.setAccessToken,
    getRefreshToken: tokenStorage.getRefreshToken,
    setRefreshToken: tokenStorage.setRefreshToken,

    async clearLocalAuth() {
        await Promise.all([AsyncStorage.removeItem(USER_KEY), tokenStorage.clear()]);
    },

    checkAuth() {
        return apiFetch<AuthResponse>('/users/check-auth', { method: 'GET' });
    },

    login(data: AuthRequest) {
        return apiFetch<AuthResponse, AuthRequest>('/users/login', { method: 'POST', body: data });
    },

    async logout() {
        const refreshToken = await tokenStorage.getRefreshToken();
        const body: RefreshRequest | undefined = refreshToken ? { refreshToken } : undefined;
        return apiFetch<AuthResponse, RefreshRequest>('/users/logout', { method: 'POST', body });
    },

    deleteAccount() {
        return apiFetch<AuthResponse>('/users', { method: 'DELETE' });
    },

    register(data: AuthRequest) {
        return apiFetch<AuthResponse, AuthRequest>('/users', { method: 'POST', body: data });
    },

    requestEmailVerification(data: EmailAddressRequest) {
        return apiFetch<AuthResponse, EmailAddressRequest>('/users/verify-email/request', {
            method: 'POST',
            body: data,
        });
    },

    verifyEmail(data: EmailOtpRequest) {
        return apiFetch<AuthResponse, EmailOtpRequest>('/users/verify-email', { method: 'POST', body: data });
    },

    requestPasswordReset(data: EmailAddressRequest) {
        return apiFetch<AuthResponse, EmailAddressRequest>('/users/reset-password/request', {
            method: 'POST',
            body: data,
        });
    },

    resetPassword(data: PasswordResetRequest) {
        return apiFetch<AuthResponse, PasswordResetRequest>('/users/reset-password', { method: 'POST', body: data });
    },

    updateUser(data: UpdateUserRequest) {
        return apiFetch<AuthResponse, UpdateUserRequest>('/users', { method: 'PUT', body: data });
    },
};
