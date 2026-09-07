import { OK_NO_CONTENT, REQUEST_TIMEOUT, UNAUTHORIZED } from '@tally/core/client';
import { Platform } from 'react-native';

import { tokenStorage } from './services/token-storage';

import type { AuthResponse } from '@tally/core/client';

export interface ApiRequestOptions<T = unknown> extends Omit<RequestInit, 'body'> {
    body?: T;
    requiresAuth?: boolean;
}

export class ApiError extends Error {
    success = false;

    constructor(
        message: string,
        public status?: number,
        public data?: unknown,
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

export const getErrorMessage = (error: unknown, fallback = 'Unknown error') =>
    error instanceof Error && error.message ? error.message : fallback;

const isNative = Platform.OS !== 'web';
const defaultLocal = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
export const API_URL = process.env.EXPO_PUBLIC_API_URL || defaultLocal;

let refreshPromise: Promise<boolean> | null = null;
let unauthorizedHandler: (() => void | Promise<void>) | undefined;

export const setUnauthorizedHandler = (handler: () => void | Promise<void>) => {
    unauthorizedHandler = handler;
    return () => {
        if (unauthorizedHandler === handler) unauthorizedHandler = undefined;
    };
};

async function executeRefresh(): Promise<boolean> {
    try {
        const headers = { 'Content-Type': 'application/json' };
        let body: string | undefined;

        if (isNative) {
            const refreshToken = await tokenStorage.getRefreshToken();
            if (!refreshToken) return false;
            body = JSON.stringify({ refreshToken });
        }

        const response = await fetch(`${API_URL}/users/refresh`, {
            method: 'POST',
            credentials: 'include',
            headers,
            body,
        });

        if (!response.ok) return false;

        const result = (await response.json()) as AuthResponse;
        if (isNative && result.data) {
            const writes = [];
            if (result.data.accessToken) writes.push(tokenStorage.setAccessToken(result.data.accessToken));
            if (result.data.refreshToken) writes.push(tokenStorage.setRefreshToken(result.data.refreshToken));
            await Promise.all(writes);
        }

        return true;
    } catch {
        return false;
    }
}

async function attemptRefresh(): Promise<boolean> {
    if (!refreshPromise) {
        refreshPromise = executeRefresh().finally(() => {
            refreshPromise = null;
        });
    }

    return refreshPromise;
}

async function apiFetch<ResT = unknown, ReqT = unknown>(
    endpoint: string,
    options: ApiRequestOptions<ReqT> = {},
    isRetry = false,
): Promise<ResT> {
    const { body, headers = {}, requiresAuth = true, ...restOptions } = options;
    const isFormData = body instanceof FormData;
    const requestHeaders: Record<string, string> = { ...(headers as Record<string, string>) };

    if (!isFormData && !requestHeaders['Content-Type']) requestHeaders['Content-Type'] = 'application/json';

    if (isNative && requiresAuth) {
        const accessToken = await tokenStorage.getAccessToken();
        if (accessToken) requestHeaders.Authorization = `Bearer ${accessToken}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            credentials: 'include',
            ...restOptions,
            headers: requestHeaders,
            body: isFormData ? body : body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
        });

        if (!response.ok) {
            if (requiresAuth && response.status === UNAUTHORIZED && !isRetry && (await attemptRefresh())) {
                return apiFetch<ResT, ReqT>(endpoint, options, true);
            }

            if (requiresAuth && response.status === UNAUTHORIZED) await unauthorizedHandler?.();

            const errorData = (await response.json().catch(() => ({}))) as Record<string, unknown> & {
                message?: string;
            };
            throw new ApiError(errorData.message || 'An API error occurred', response.status, errorData);
        }

        if (response.status === OK_NO_CONTENT) return {} as ResT;
        return (await response.json()) as ResT;
    } catch (error: unknown) {
        if (typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError') {
            throw new ApiError('Network timeout', REQUEST_TIMEOUT);
        }

        if (error instanceof ApiError) throw error;
        throw new ApiError(getErrorMessage(error, 'Network Error'), 0);
    } finally {
        clearTimeout(timeout);
    }
}

export default apiFetch;
