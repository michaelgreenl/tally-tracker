import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

import type { ApiResponse } from '@/types/shared/responses';

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
        const response = await fetch(`${API_URL}${endpoint}`, {
            credentials: 'include',
            ...restOptions,
            headers: reqHeaders,
            body: isFormData ? body : body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));

            const error: ApiResponse<never> = {
                success: false,
                message: errorData.message || 'An API error occurred',
            };

            throw error;
        }

        const data = await response.json();

        console.log(`[API] ${endpoint} Response:`, data);

        return data;
    } catch (error: any) {
        clearTimeout(id);

        if (error.name === 'AbortError') {
            throw new Error('Network timeout: Server took too long to respond.');
        }

        throw error;
    }
}

export default apiFetch;
