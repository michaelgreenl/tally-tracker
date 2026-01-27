import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { ApiError } from '@/utils/errors';

export interface ApiRequestOptions<T = any> extends Omit<RequestInit, 'body'> {
    body?: T;
}

const isDev = import.meta.env.DEV;
const isNative = Capacitor.isNativePlatform();
const API_URL = isDev ? '' : import.meta.env.VITE_API_URL;

async function apiFetch<ResT = unknown, ReqT = any>(
    endpoint: string,
    options: ApiRequestOptions<ReqT> = {},
): Promise<ResT> {
    const { body, headers = {}, ...restOptions } = options;

    const isFormData = body instanceof FormData;
    const reqHeaders: Record<string, string> = {
        ...(headers as Record<string, string>),
    };

    if (!isFormData && !reqHeaders['Content-Type']) {
        reqHeaders['Content-Type'] = 'application/json';
    }

    if (isNative) {
        const { value: token } = await Preferences.get({ key: 'auth_token' });
        if (token) {
            reqHeaders['Authorization'] = `Bearer ${token}`;
        }
    }

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 10000);

    try {
        const res = await fetch(`${API_URL}${endpoint}`, {
            credentials: 'include',
            ...restOptions,
            headers: reqHeaders,
            body: isFormData ? body : body ? JSON.stringify(body) : undefined,
        });

        clearTimeout(id);

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new ApiError(errorData.message || 'An API error occurred', res.status, errorData);
        }

        if (res.status === 204) {
            return {} as ResT;
        }

        const data = await res.json();
        console.log(`[API] ${endpoint} Response:`, data);
        return data;
    } catch (error: any) {
        clearTimeout(id);

        if (error.name === 'AbortError') throw new ApiError('Network timeout', 408);

        if (error instanceof ApiError) throw error;

        throw new ApiError(error.message || 'Network Error', 0);
    }
}

export default apiFetch;
