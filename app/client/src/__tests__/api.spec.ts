import { OK, OK_NO_CONTENT, BAD_REQUEST, UNAUTHORIZED, REQUEST_TIMEOUT } from '@packages/utils';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@capacitor/core', () => ({
    Capacitor: {
        isNativePlatform: () => false,
        getPlatform: () => 'web',
    },
}));

vi.mock('@capacitor/preferences', () => ({
    Preferences: {
        get: vi.fn(),
        set: vi.fn(),
    },
}));

vi.mock('@/stores/authStore', () => ({
    useAuthStore: vi.fn(() => ({
        logout: vi.fn(),
    })),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('apiFetch', () => {
    let apiFetch: typeof import('@/api').default;

    beforeEach(async () => {
        mockFetch.mockReset();
        vi.resetModules();
        const module = await import('@/api');
        apiFetch = module.default;
    });

    describe('successful requests', () => {
        it('should return parsed JSON on success', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: OK,
                json: () => Promise.resolve({ success: true, data: { id: '123' } }),
            });

            const result = await apiFetch('/test');
            expect(result).toEqual({ success: true, data: { id: '123' } });
        });

        it('should return empty object on 204', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true, status: OK_NO_CONTENT });
            const result = await apiFetch('/test');
            expect(result).toEqual({});
        });

        it('should set Content-Type and stringify body', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: OK,
                json: () => Promise.resolve({}),
            });

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

    describe('error handling', () => {
        it('should throw ApiError on non-ok response', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: BAD_REQUEST,
                json: () => Promise.resolve({ message: 'Bad request' }),
            });

            await expect(apiFetch('/test')).rejects.toMatchObject({
                name: 'ApiError',
                status: BAD_REQUEST,
            });
        });

        it('should throw ApiError with status 0 on network failure', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network failed'));

            await expect(apiFetch('/test')).rejects.toMatchObject({
                name: 'ApiError',
                status: 0,
            });
        });

        it('should throw ApiError with status 408 on abort', async () => {
            mockFetch.mockRejectedValueOnce(new DOMException('The operation was aborted', 'AbortError'));

            await expect(apiFetch('/test')).rejects.toMatchObject({
                name: 'ApiError',
                status: REQUEST_TIMEOUT,
            });
        });
    });
});
