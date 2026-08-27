import { OK, UNAUTHORIZED } from '@tally/core/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import apiFetch, { ApiError, setUnauthorizedHandler } from './api';

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
vi.mock('./services/token-storage', () => ({ tokenStorage }));

const jsonResponse = (body: unknown, status = OK) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

describe('apiFetch', () => {
    beforeEach(() => {
        vi.useRealTimers();
        tokens.clear();
        tokens.set('access', 'expired-access-token');
        tokens.set('refresh', 'stored-refresh-token');
        fetchMock.mockReset();
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
                credentials: 'include',
                headers: {
                    Authorization: 'Bearer expired-access-token',
                    'Content-Type': 'application/json',
                },
                method: 'POST',
            }),
        );
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

    it('maps fetch failures to network errors', async () => {
        fetchMock.mockRejectedValue(new Error('Connection refused'));

        await expect(apiFetch('/counters')).rejects.toEqual(new ApiError('Connection refused', 0));
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
