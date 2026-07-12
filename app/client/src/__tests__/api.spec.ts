import { FORBIDDEN, OK, OK_NO_CONTENT, REQUEST_TIMEOUT, UNAUTHORIZED } from '@tally/utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { auth, mockFetch, platform, preferenceValues, preferences } = vi.hoisted(() => ({
    auth: {
        logout: vi.fn(),
    },
    mockFetch: vi.fn(),
    platform: {
        native: false,
        name: 'web',
    },
    preferenceValues: new Map<string, string>(),
    preferences: {
        get: vi.fn(),
        set: vi.fn(),
    },
}));

vi.mock('@capacitor/core', () => ({
    Capacitor: {
        isNativePlatform: () => platform.native,
        getPlatform: () => platform.name,
    },
}));

vi.mock('@capacitor/preferences', () => ({
    Preferences: preferences,
}));

vi.mock('@/stores/authStore', () => ({
    useAuthStore: vi.fn(() => auth),
}));

const jsonResponse = (body: unknown, status = OK): Response =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

interface LoadApiOptions {
    native?: boolean;
    name?: string;
}

const loadApi = async (options: LoadApiOptions = {}) => {
    const native = options.native ?? false;
    const name = options.name ?? (native ? 'ios' : 'web');
    platform.native = native;
    platform.name = name;
    vi.resetModules();
    return (await import('@/api')).default;
};

describe('apiFetch', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', mockFetch);
        mockFetch.mockReset();
        auth.logout.mockReset();
        auth.logout.mockResolvedValue({ success: true });
        preferences.get.mockReset();
        preferences.get.mockImplementation(async ({ key }: { key: string }) => ({
            value: preferenceValues.get(key) ?? null,
        }));
        preferences.set.mockReset();
        preferences.set.mockImplementation(async ({ key, value }: { key: string; value: string }) => {
            preferenceValues.set(key, value);
        });
        preferenceValues.clear();
        platform.native = false;
        platform.name = 'web';
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    describe('successful requests', () => {
        it('returns parsed JSON on success', async () => {
            const apiFetch = await loadApi();
            mockFetch.mockResolvedValueOnce(jsonResponse({ success: true, data: { id: '123' } }));

            const res = await apiFetch('/test');

            expect(res).toEqual({ success: true, data: { id: '123' } });
        });

        it('returns an empty object on 204', async () => {
            const apiFetch = await loadApi();
            mockFetch.mockResolvedValueOnce(new Response(null, { status: OK_NO_CONTENT }));

            const res = await apiFetch('/test');

            expect(res).toEqual({});
        });

        it('sets Content-Type and stringifies the body', async () => {
            const apiFetch = await loadApi();
            mockFetch.mockResolvedValueOnce(jsonResponse({}));

            await apiFetch('/test', { method: 'POST', body: { foo: 'bar' } });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
                    body: '{"foo":"bar"}',
                }),
            );
        });
    });

    describe('authentication', () => {
        it('refreshes a successful 401 response and retries the original request', async () => {
            const apiFetch = await loadApi();
            mockFetch
                .mockResolvedValueOnce(jsonResponse({ message: 'Unauthorized' }, UNAUTHORIZED))
                .mockResolvedValueOnce(jsonResponse({ success: true }))
                .mockResolvedValueOnce(jsonResponse({ success: true, data: { id: '123' } }));

            const result = await apiFetch('/test');

            expect(result).toEqual({ success: true, data: { id: '123' } });
            expect(mockFetch).toHaveBeenCalledTimes(3);
            expect(mockFetch.mock.calls.map(([url]) => String(url))).toEqual(['/test', '/users/refresh', '/test']);
            expect(auth.logout).not.toHaveBeenCalled();
        });

        it('deduplicates refresh while concurrent 401 responses retry independently', async () => {
            const apiFetch = await loadApi();
            const endpointAttempts = new Map<string, number>();
            let resolveRefresh: (response: Response) => void = () => undefined;
            const refreshResponse = new Promise<Response>((resolve) => {
                resolveRefresh = resolve;
            });

            mockFetch.mockImplementation((input: RequestInfo | URL) => {
                const url = String(input);
                if (url === '/users/refresh') return refreshResponse;

                const attempts = (endpointAttempts.get(url) ?? 0) + 1;
                endpointAttempts.set(url, attempts);
                return Promise.resolve(
                    attempts === 1
                        ? jsonResponse({ message: 'Unauthorized' }, UNAUTHORIZED)
                        : jsonResponse({ success: true, data: { endpoint: url } }),
                );
            });

            const firstRequest = apiFetch('/first');
            const secondRequest = apiFetch('/second');

            await vi.waitFor(() => {
                expect(endpointAttempts).toEqual(
                    new Map([
                        ['/first', 1],
                        ['/second', 1],
                    ]),
                );
                expect(mockFetch.mock.calls.filter(([url]) => String(url) === '/users/refresh')).toHaveLength(1);
            });
            resolveRefresh(jsonResponse({ success: true }));

            await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([
                { success: true, data: { endpoint: '/first' } },
                { success: true, data: { endpoint: '/second' } },
            ]);
            expect(endpointAttempts).toEqual(
                new Map([
                    ['/first', 2],
                    ['/second', 2],
                ]),
            );
            expect(auth.logout).not.toHaveBeenCalled();
        });

        it('injects the stored access token for native requests', async () => {
            preferenceValues.set('access_token', 'native-access-token');
            const apiFetch = await loadApi({ native: true });
            mockFetch.mockResolvedValueOnce(jsonResponse({ success: true }));

            await apiFetch('/test');

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringMatching(/\/test$/),
                expect.objectContaining({
                    headers: expect.objectContaining({ Authorization: 'Bearer native-access-token' }),
                }),
            );
        });

        it('persists refreshed native tokens before retrying with the new bearer token', async () => {
            preferenceValues.set('access_token', 'expired-access-token');
            preferenceValues.set('refresh_token', 'stored-refresh-token');
            const apiFetch = await loadApi({ native: true });
            mockFetch
                .mockResolvedValueOnce(jsonResponse({ message: 'Unauthorized' }, UNAUTHORIZED))
                .mockResolvedValueOnce(
                    jsonResponse({
                        success: true,
                        data: {
                            accessToken: 'fresh-access-token',
                            refreshToken: 'fresh-refresh-token',
                        },
                    }),
                )
                .mockResolvedValueOnce(jsonResponse({ success: true }));

            await apiFetch('/test');

            expect(preferences.set).toHaveBeenCalledWith({ key: 'access_token', value: 'fresh-access-token' });
            expect(preferences.set).toHaveBeenCalledWith({ key: 'refresh_token', value: 'fresh-refresh-token' });
            expect(mockFetch.mock.calls[1]?.[1]).toEqual(
                expect.objectContaining({ body: '{"refreshToken":"stored-refresh-token"}' }),
            );
            expect(mockFetch.mock.calls[2]?.[1]).toEqual(
                expect.objectContaining({
                    headers: expect.objectContaining({ Authorization: 'Bearer fresh-access-token' }),
                }),
            );
        });
    });

    describe('error handling', () => {
        it('throws ApiError on a non-401 response without logging out', async () => {
            const apiFetch = await loadApi();
            mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'Forbidden' }, FORBIDDEN));

            await expect(apiFetch('/test')).rejects.toMatchObject({
                name: 'ApiError',
                status: FORBIDDEN,
            });
            expect(auth.logout).not.toHaveBeenCalled();
        });

        it('logs out after a 401 when refresh fails', async () => {
            const apiFetch = await loadApi();
            mockFetch
                .mockResolvedValueOnce(jsonResponse({ message: 'Unauthorized' }, UNAUTHORIZED))
                .mockResolvedValueOnce(new Response(null, { status: UNAUTHORIZED }));

            await expect(apiFetch('/test')).rejects.toMatchObject({
                name: 'ApiError',
                status: UNAUTHORIZED,
            });
            expect(auth.logout).toHaveBeenCalledTimes(1);
            expect(auth.logout).toHaveBeenCalledWith(false);
        });

        it('throws ApiError with status 0 on network failure', async () => {
            const apiFetch = await loadApi();
            mockFetch.mockRejectedValueOnce(new Error('Network failed'));

            await expect(apiFetch('/test')).rejects.toMatchObject({
                name: 'ApiError',
                status: 0,
            });
        });

        it('aborts a pending request after 10 seconds and reports a timeout', async () => {
            vi.useFakeTimers();
            const apiFetch = await loadApi();
            let requestSignal: AbortSignal | undefined;
            mockFetch.mockImplementationOnce((_input: RequestInfo | URL, init?: RequestInit) => {
                requestSignal = init?.signal ?? undefined;
                return new Promise((_resolve, reject) => {
                    requestSignal?.addEventListener(
                        'abort',
                        () => reject(new DOMException('The operation was aborted', 'AbortError')),
                        { once: true },
                    );
                });
            });

            const request = apiFetch('/test');
            const rejection = expect(request).rejects.toMatchObject({
                name: 'ApiError',
                status: REQUEST_TIMEOUT,
            });

            await vi.advanceTimersByTimeAsync(9_999);
            expect(requestSignal?.aborted).toBe(false);
            await vi.advanceTimersByTimeAsync(1);

            await rejection;
            expect(requestSignal?.aborted).toBe(true);
        });
    });
});
