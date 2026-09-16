import { OK_NO_CONTENT, REQUEST_TIMEOUT, SERVER_ERROR, UNAUTHORIZED } from '@tally/core/client';
import { Platform } from 'react-native';

import { tokenStorage } from './services/token-storage';

import type { AuthResponse } from '@tally/core/client';

export interface ApiRequestOptions<T = unknown> extends Omit<RequestInit, 'body'> {
    body?: T;
    requiresAuth?: boolean;
}

export const REQUEST_FAILED_MESSAGE = 'Something went wrong. Please try again later.';

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
export const API_URL = !isNative && __DEV__ ? '' : process.env.EXPO_PUBLIC_API_URL || defaultLocal;

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
        const refreshToken = isNative ? await tokenStorage.getRefreshToken() : null;
        if (isNative && !refreshToken) return false;

        const result = await apiFetch<AuthResponse>('/users/refresh', {
            method: 'POST',
            requiresAuth: false,
            body: refreshToken ? { refreshToken } : undefined,
        });

        if (!result.success) throw new Error('Invalid refresh response');

        if (isNative) {
            if (!result.data?.accessToken || !result.data.refreshToken) throw new Error('Missing refreshed tokens');
            await Promise.all([
                tokenStorage.setAccessToken(result.data.accessToken),
                tokenStorage.setRefreshToken(result.data.refreshToken),
            ]);
        }

        return true;
    } catch (error: unknown) {
        if (error instanceof ApiError && error.status === UNAUTHORIZED) return false;
        // Keep the session and queued mutations when refresh is temporarily unavailable.
        throw new ApiError('Session refresh unavailable. Please try again.', SERVER_ERROR, error);
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

            const errorData: unknown = await response.json().catch(() => null);
            const message =
                typeof errorData === 'object' &&
                errorData !== null &&
                'message' in errorData &&
                typeof errorData.message === 'string' &&
                errorData.message.trim();
            throw new ApiError(
                response.status < SERVER_ERROR && message ? message : REQUEST_FAILED_MESSAGE,
                response.status,
                errorData,
            );
        }

        if (response.status === OK_NO_CONTENT) return {} as ResT;
        return (await response.json()) as ResT;
    } catch (error: unknown) {
        if (typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError') {
            throw new ApiError('Network timeout', REQUEST_TIMEOUT);
        }

        if (error instanceof ApiError) throw error;
        throw new ApiError(REQUEST_FAILED_MESSAGE, 0, error);
    } finally {
        clearTimeout(timeout);
    }
}

export default apiFetch;
