import { OK, UNAUTHORIZED } from '@tally/core/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import apiFetch, { ApiError, REQUEST_FAILED_MESSAGE, setUnauthorizedHandler } from '../../../infra/http/api';
import { changeSession, SessionChangedError, writeSession } from '../../../services/session/session-scope';

const { fetchMock, tokens, tokenStorage } = vi.hoisted(() => ({
    fetchMock: vi.fn(),
    tokens: new Map<string, string>(),
    tokenStorage: {
        getAccessToken: vi.fn(),
        setAccessToken: vi.fn(),
        getRefreshToken: vi.fn(),
        setRefreshToken: vi.fn(),
        clear: vi.fn(),
    },
}));

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('../../../infra/storage/token-storage', () => ({ tokenStorage }));

const jsonResponse = (body: unknown, status = OK) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

describe('apiFetch', () => {
    beforeEach(() => {
        changeSession();
        vi.useRealTimers();
        tokens.clear();
        tokens.set('access', 'expired-access-token');
        tokens.set('refresh', 'stored-refresh-token');
        fetchMock.mockReset();
        for (const mock of Object.values(tokenStorage)) mock.mockReset();
        vi.stubGlobal('fetch', fetchMock);
        tokenStorage.getAccessToken.mockImplementation(async () => tokens.get('access') ?? null);
        tokenStorage.getRefreshToken.mockImplementation(async () => tokens.get('refresh') ?? null);
        tokenStorage.setAccessToken.mockImplementation(async (token: string) => tokens.set('access', token));
        tokenStorage.setRefreshToken.mockImplementation(async (token: string) => tokens.set('refresh', token));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it('sends native credentials and JSON bodies', async () => {
        fetchMock.mockResolvedValue(jsonResponse({ success: true }));

        await apiFetch('/counters', { method: 'POST', body: { title: 'Walks' } });

        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('/counters'),
            expect.objectContaining({
                body: '{"title":"Walks"}',
                credentials: 'omit',
                headers: {
                    Authorization: 'Bearer expired-access-token',
                    'Content-Type': 'application/json',
                },
                method: 'POST',
            }),
        );
    });

    it('does not sign out the new account when an old refresh-token read completes empty', async () => {
        changeSession('account-a');
        const unauthorized = vi.fn();
        const clearHandler = setUnauthorizedHandler(unauthorized);
        let finish!: (value: null) => void;
        tokenStorage.getRefreshToken.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    finish = resolve;
                }),
        );
        fetchMock.mockResolvedValueOnce(jsonResponse({}, UNAUTHORIZED));
        const pending = apiFetch('/counters');
        const rejected = expect(pending).rejects.toBeInstanceOf(SessionChangedError);
        try {
            await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
            changeSession('account-b');
            finish(null);
            await rejected;
            expect(unauthorized).not.toHaveBeenCalled();
        } finally {
            clearHandler();
        }
    });

    it('returns an empty result for a successful no-content response', async () => {
        fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

        await expect(apiFetch('/users', { method: 'DELETE' })).resolves.toEqual({});
    });

    it('stores rotated native tokens before retrying with the new access token', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse({ message: 'Unauthorized' }, UNAUTHORIZED))
            .mockResolvedValueOnce(
                jsonResponse({
                    success: true,
                    data: { accessToken: 'fresh-access-token', refreshToken: 'fresh-refresh-token' },
                }),
            )
            .mockResolvedValueOnce(jsonResponse({ success: true, data: { id: 'counter-1' } }));

        await expect(apiFetch('/counters')).resolves.toEqual({ success: true, data: { id: 'counter-1' } });
        expect(fetchMock.mock.calls[1]?.[1]).toEqual(
            expect.objectContaining({ body: '{"refreshToken":"stored-refresh-token"}' }),
        );
        expect(fetchMock.mock.calls[2]?.[1]).toEqual(
            expect.objectContaining({
                headers: expect.objectContaining({ Authorization: 'Bearer fresh-access-token' }),
            }),
        );
        expect(tokens).toEqual(
            new Map([
                ['access', 'fresh-access-token'],
                ['refresh', 'fresh-refresh-token'],
            ]),
        );
    });

    it('deduplicates refresh requests from concurrent unauthorized responses', async () => {
        let releaseRefresh: (response: Response) => void = () => undefined;
        const refreshResponse = new Promise<Response>((resolve) => {
            releaseRefresh = resolve;
        });
        let refreshCalls = 0;

        fetchMock.mockImplementation(async (url: string, options: RequestInit) => {
            if (url.endsWith('/users/refresh')) {
                refreshCalls += 1;
                return refreshResponse;
            }

            const authorization = (options.headers as Record<string, string>).Authorization;
            return authorization === 'Bearer expired-access-token'
                ? jsonResponse({ message: 'Unauthorized' }, UNAUTHORIZED)
                : jsonResponse({ success: true });
        });

        const requests = [apiFetch('/counters'), apiFetch('/users/check-auth')];
        await vi.waitFor(() => expect(refreshCalls).toBe(1));
        releaseRefresh(
            jsonResponse({
                success: true,
                data: { accessToken: 'fresh-access-token', refreshToken: 'fresh-refresh-token' },
            }),
        );

        await expect(Promise.all(requests)).resolves.toEqual([{ success: true }, { success: true }]);
        expect(refreshCalls).toBe(1);
    });

    it('does not let an old refresh replace the next account or retry its request', async () => {
        changeSession('account-a');
        let finish!: (response: Response) => void;
        fetchMock.mockResolvedValueOnce(jsonResponse({}, 401)).mockImplementationOnce(
            () =>
                new Promise<Response>((resolve) => {
                    finish = resolve;
                }),
        );
        const pending = expect(apiFetch('/counters')).rejects.toBeInstanceOf(SessionChangedError);
        await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
        const next = changeSession('account-b');
        await writeSession(next, async () => {
            tokens.set('access', 'b-access');
            tokens.set('refresh', 'b-refresh');
        });
        finish(jsonResponse({ success: true, data: { accessToken: 'a-access', refreshToken: 'a-refresh' } }));
        await pending;
        expect(tokens).toEqual(
            new Map([
                ['access', 'b-access'],
                ['refresh', 'b-refresh'],
            ]),
        );
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('ignores a late unauthorized response after another account logs in', async () => {
        const unauthorized = vi.fn();
        const remove = setUnauthorizedHandler(unauthorized);
        let finish!: (response: Response) => void;
        fetchMock.mockImplementationOnce(
            () =>
                new Promise<Response>((resolve) => {
                    finish = resolve;
                }),
        );
        const pending = expect(apiFetch('/counters')).rejects.toBeInstanceOf(SessionChangedError);
        await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
        changeSession('account-b');
        finish(jsonResponse({}, 401));
        await pending;
        expect(unauthorized).not.toHaveBeenCalled();
        expect(fetchMock).toHaveBeenCalledOnce();
        remove();
    });

    it('reports an unauthorized response after refresh fails', async () => {
        const unauthorized = vi.fn();
        const removeHandler = setUnauthorizedHandler(unauthorized);
        fetchMock
            .mockResolvedValueOnce(jsonResponse({ message: 'Unauthorized' }, UNAUTHORIZED))
            .mockResolvedValueOnce(jsonResponse({ message: 'Refresh rejected' }, UNAUTHORIZED));

        await expect(apiFetch('/counters')).rejects.toMatchObject({ status: UNAUTHORIZED });
        expect(unauthorized).toHaveBeenCalledOnce();
        removeHandler();
    });

    it.each(['connection loss', 'server error', 'rate limit', 'invalid response', 'missing tokens'])(
        'preserves the session and allows recovery after refresh encounters %s',
        async (failure) => {
            const storedTokens = new Map(tokens);
            const removeHandler = setUnauthorizedHandler(() => tokens.clear());
            fetchMock
                .mockResolvedValue(jsonResponse({ message: 'Unauthorized' }, UNAUTHORIZED))
                .mockResolvedValueOnce(jsonResponse({ message: 'Unauthorized' }, UNAUTHORIZED));
            if (failure === 'connection loss') {
                fetchMock.mockRejectedValueOnce(new Error('Connection refused'));
            } else {
                fetchMock.mockResolvedValueOnce(
                    jsonResponse(
                        failure === 'missing tokens' ? { success: true, data: { accessToken: 'partial-token' } } : {},
                        failure === 'server error' ? 503 : failure === 'rate limit' ? 429 : OK,
                    ),
                );
            }

            try {
                await expect(apiFetch('/users/check-auth')).rejects.toMatchObject({ status: 500 });
                expect(tokens).toEqual(storedTokens);

                fetchMock
                    .mockResolvedValueOnce(jsonResponse({ message: 'Unauthorized' }, UNAUTHORIZED))
                    .mockResolvedValueOnce(
                        jsonResponse({
                            success: true,
                            data: { accessToken: 'fresh-access-token', refreshToken: 'fresh-refresh-token' },
                        }),
                    )
                    .mockResolvedValueOnce(jsonResponse({ success: true }));

                await expect(apiFetch('/users/check-auth')).resolves.toEqual({ success: true });
                expect(tokens.get('refresh')).toBe('fresh-refresh-token');
            } finally {
                removeHandler();
            }
        },
    );

    it.each(['/users/login', '/users/google'])(
        'returns %s errors without expiring the current session',
        async (endpoint) => {
            const unauthorized = vi.fn();
            const removeHandler = setUnauthorizedHandler(unauthorized);
            fetchMock.mockResolvedValue(jsonResponse({ message: 'Incorrect password.' }, UNAUTHORIZED));

            await expect(apiFetch(endpoint, { requiresAuth: false })).rejects.toEqual(
                new ApiError('Incorrect password.', UNAUTHORIZED, { message: 'Incorrect password.' }),
            );
            expect(unauthorized).not.toHaveBeenCalled();
            expect(fetchMock).toHaveBeenCalledOnce();
            removeHandler();
        },
    );

    it('does not retain an unauthorized callback after its owner removes it', async () => {
        const unauthorized = vi.fn();
        const removeHandler = setUnauthorizedHandler(unauthorized);
        removeHandler();
        fetchMock
            .mockResolvedValueOnce(jsonResponse({ message: 'Unauthorized' }, UNAUTHORIZED))
            .mockResolvedValueOnce(jsonResponse({ message: 'Refresh rejected' }, UNAUTHORIZED));

        await expect(apiFetch('/counters')).rejects.toMatchObject({ status: UNAUTHORIZED });
        expect(unauthorized).not.toHaveBeenCalled();
    });

    it('does not clear the session for non-authentication errors', async () => {
        const unauthorized = vi.fn();
        const removeHandler = setUnauthorizedHandler(unauthorized);
        fetchMock.mockResolvedValue(jsonResponse({ message: 'Forbidden' }, 403));

        await expect(apiFetch('/counters')).rejects.toEqual(new ApiError('Forbidden', 403, { message: 'Forbidden' }));
        expect(unauthorized).not.toHaveBeenCalled();
        removeHandler();
    });

    it.each([
        [503, { message: 'Database connection refused' }],
        [404, null],
        [400, { message: { internal: 'Invalid response' } }],
    ] as const)('hides unexpected response details from the public message (%s)', async (status, data) => {
        fetchMock.mockResolvedValue(jsonResponse(data, status));

        await expect(apiFetch('/counters')).rejects.toEqual(new ApiError(REQUEST_FAILED_MESSAGE, status, data));
    });

    it('uses the friendly fallback when an error response is not JSON', async () => {
        fetchMock.mockResolvedValue(new Response('<html>Not found</html>', { status: 404 }));

        await expect(apiFetch('/counters')).rejects.toEqual(new ApiError(REQUEST_FAILED_MESSAGE, 404, null));
    });

    it('keeps network diagnostics out of the public message', async () => {
        const error = new Error('Connection refused');
        fetchMock.mockRejectedValue(error);

        await expect(apiFetch('/counters')).rejects.toEqual(new ApiError(REQUEST_FAILED_MESSAGE, 0, error));
    });

    it('aborts requests after ten seconds', async () => {
        vi.useFakeTimers();
        fetchMock.mockImplementation(
            (_url: string, options: RequestInit) =>
                new Promise((_resolve, reject) => {
                    options.signal?.addEventListener('abort', () =>
                        reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })),
                    );
                }),
        );

        const request = expect(apiFetch('/counters')).rejects.toMatchObject({
            message: 'Network timeout',
            status: 408,
        });
        await vi.advanceTimersByTimeAsync(10_000);

        await request;
    });
});
