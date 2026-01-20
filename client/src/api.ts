import type { ApiResponse } from '@/types/shared/responses';

const API_URL = import.meta.env.VITE_API_URL;

export interface ApiRequestOptions<T = any> extends Omit<RequestInit, 'body'> {
    body?: T;
}

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

    return response.json();
}

export default apiFetch;
