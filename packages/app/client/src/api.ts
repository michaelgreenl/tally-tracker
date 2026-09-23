import { OK_NO_CONTENT, REQUEST_TIMEOUT, SERVER_ERROR, UNAUTHORIZED } from '@tally/core/client';
import { Platform } from 'react-native';

import { tokenStorage } from './session/token-storage';
import { assertSession, getSessionScope, SessionChangedError, writeSession } from './session/session-scope';
import type { SessionScope } from './session/session-scope';

import type { AuthResponse } from '@tally/core/client';

export interface ApiRequestOptions<T = unknown> extends Omit<RequestInit, 'body'> {
    body?: T;
    requiresAuth?: boolean;
    // Logout uses captured credentials after the local session has ended.
    sessionScope?: SessionScope | null;
}

export const REQUEST_FAILED_MESSAGE = 'Something happened. Try again later.';

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

let refreshRequest: { scope: SessionScope; promise: Promise<boolean> } | null = null;
let unauthorizedHandler: (() => void | Promise<void>) | undefined;

export const setUnauthorizedHandler = (handler: () => void | Promise<void>) => {
    unauthorizedHandler = handler;
    return () => {
        if (unauthorizedHandler === handler) unauthorizedHandler = undefined;
    };
};

async function executeRefresh(scope: SessionScope): Promise<boolean> {
    try {
        const refreshToken = isNative ? await tokenStorage.getRefreshToken() : null;
        if (isNative && !refreshToken) return false;

        const result = await apiFetch<AuthResponse>('/users/refresh', {
            method: 'POST',
            requiresAuth: false,
            sessionScope: scope,
            headers: scope.userId ? { 'X-Account-Id': scope.userId } : {},
            body: refreshToken ? { refreshToken } : undefined,
        });

        if (!result.success) throw new Error('Invalid refresh response');

        if (isNative) {
            if (!result.data?.accessToken || !result.data.refreshToken) throw new Error('Missing refreshed tokens');
            const { accessToken, refreshToken } = result.data;
            await writeSession(scope, async () => {
                await tokenStorage.setAccessToken(accessToken);
                await tokenStorage.setRefreshToken(refreshToken);
            });
        }

        return true;
    } catch (error: unknown) {
        assertSession(scope);
        if (error instanceof ApiError && error.status === UNAUTHORIZED) return false;
        // Keep the session and queued mutations when refresh is temporarily unavailable.
        throw new ApiError('Session refresh unavailable. Please try again.', SERVER_ERROR, error);
    }
}

async function attemptRefresh(scope: SessionScope): Promise<boolean> {
    assertSession(scope);
    if (!refreshRequest || refreshRequest.scope !== scope) {
        const promise = executeRefresh(scope);
        refreshRequest = { scope, promise };
        void promise
            .finally(() => {
                if (refreshRequest?.promise === promise) refreshRequest = null;
            })
            .catch(() => undefined);
    }

    return refreshRequest.promise;
}

async function apiFetch<ResT = unknown, ReqT = unknown>(
    endpoint: string,
    options: ApiRequestOptions<ReqT> = {},
    isRetry = false,
): Promise<ResT> {
    const {
        body,
        headers = {},
        requiresAuth = true,
        sessionScope = getSessionScope(),
        signal,
        ...restOptions
    } = options;
    if (sessionScope) assertSession(sessionScope);
    const isFormData = body instanceof FormData;
    const requestHeaders: Record<string, string> = { ...(headers as Record<string, string>) };

    if (!isFormData && !requestHeaders['Content-Type']) requestHeaders['Content-Type'] = 'application/json';

    if (isNative && requiresAuth) {
        const accessToken = await tokenStorage.getAccessToken();
        if (accessToken) requestHeaders.Authorization = `Bearer ${accessToken}`;
    }
    if (requiresAuth && sessionScope?.userId) requestHeaders['X-Account-Id'] = sessionScope.userId;

    if (sessionScope) assertSession(sessionScope);
    const controller = new AbortController();
    const abort = () => controller.abort();
    sessionScope?.signal.addEventListener('abort', abort);
    signal?.addEventListener('abort', abort);
    if (signal?.aborted) controller.abort();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
        const send = () => {
            if (sessionScope) assertSession(sessionScope);
            return fetch(`${API_URL}${endpoint}`, {
                credentials: isNative ? 'omit' : 'include',
                ...restOptions,
                headers: requestHeaders,
                body: isFormData ? body : body ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });
        };
        // Serialize cookie changes across tabs. Release before a 401 can request its own refresh lock.
        const changesCookies =
            ['/users/login', '/users/google', '/users/refresh', '/users/logout'].includes(endpoint) ||
            (endpoint === '/users' && options.method === 'DELETE');
        const response =
            !isNative && changesCookies && typeof navigator !== 'undefined' && navigator.locks
                ? await navigator.locks.request('tally-auth', { signal: controller.signal }, send)
                : await send();
        if (sessionScope) assertSession(sessionScope);

        if (!response.ok) {
            if (
                requiresAuth &&
                sessionScope &&
                response.status === UNAUTHORIZED &&
                !isRetry &&
                (await attemptRefresh(sessionScope))
            ) {
                return apiFetch<ResT, ReqT>(endpoint, { ...options, sessionScope }, true);
            }

            if (requiresAuth && response.status === UNAUTHORIZED) {
                if (sessionScope) assertSession(sessionScope);
                await unauthorizedHandler?.();
            }

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
        const result = (await response.json()) as ResT;
        if (sessionScope) assertSession(sessionScope);
        return result;
    } catch (error: unknown) {
        if (sessionScope) assertSession(sessionScope);
        if (error instanceof SessionChangedError) throw error;
        if (typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError') {
            throw new ApiError('Network timeout', REQUEST_TIMEOUT);
        }

        if (error instanceof ApiError) throw error;
        throw new ApiError(REQUEST_FAILED_MESSAGE, 0, error);
    } finally {
        clearTimeout(timeout);
        sessionScope?.signal.removeEventListener('abort', abort);
        signal?.removeEventListener('abort', abort);
    }
}

export default apiFetch;
