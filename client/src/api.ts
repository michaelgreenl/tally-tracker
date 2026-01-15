// api.ts
const API_URL = import.meta.env.VITE_API_URL;

export interface ApiError {
    message: string;
    [key: string]: unknown;
}

export interface ApiResponse<T = unknown> {
    data: T;
    success: boolean;
    message?: string;
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
    body?: any;
}

async function apiFetch<T = unknown>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
    const { body, headers = {}, ...restOptions } = options;

    const isFormData = body instanceof FormData;
    const reqHeaders: Record<string, string> = {
        ...(headers as Record<string, string>),
    };

    if (!isFormData && !reqHeaders['Content-Type']) {
        reqHeaders['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...restOptions,
        headers: reqHeaders,
        body: isFormData ? body : body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        const error: ApiError = {
            message: errorData.message || 'An API error occurred',
            ...errorData,
        };

        throw error;
    }

    return response.json();
}

export default apiFetch;
