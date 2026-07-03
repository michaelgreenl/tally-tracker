import { FORBIDDEN, OK, OK_NO_CONTENT, REQUEST_TIMEOUT, UNAUTHORIZED } from '@tally/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { auth } = vi.hoisted(() => ({
    auth: {
        logout: vi.fn(),
    },
}));

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
    useAuthStore: vi.fn(() => auth),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('apiFetch', () => {
    let apiFetch: typeof import('@/api').default;

    beforeEach(async () => {
        mockFetch.mockReset();
        auth.logout.mockReset();
        auth.logout.mockResolvedValue({ success: true });
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

            const res = await apiFetch('/test');
            expect(res).toEqual({ success: true, data: { id: '123' } });
        });

        it('should return replayed idempotent mutation response bodies', async () => {
            const replayedResponse = {
                success: true,
                message: 'Counter updated successfully',
                data: { counter: { id: 'counter-123', title: 'Saved Title' } },
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: OK,
                json: () => Promise.resolve(replayedResponse),
            });

            const res = await apiFetch('/counters/update/counter-123', {
                method: 'PUT',
                headers: { 'X-Idempotency-Key': 'already-completed' },
                body: { title: 'Saved Title' },
            });

            expect(res).toEqual(replayedResponse);
        });

        it('should return empty object on 204', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true, status: OK_NO_CONTENT });

            const res = await apiFetch('/test');
            expect(res).toEqual({});
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
        it('should throw ApiError on non-401 response without logging out', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: FORBIDDEN,
                json: () => Promise.resolve({ message: 'Forbidden' }),
            });

            await expect(apiFetch('/test')).rejects.toMatchObject({
                name: 'ApiError',
                status: FORBIDDEN,
            });
            expect(auth.logout).not.toHaveBeenCalled();
        });

        it('should log out after a 401 when refresh fails', async () => {
            mockFetch
                .mockResolvedValueOnce({
                    ok: false,
                    status: UNAUTHORIZED,
                    json: () => Promise.resolve({ message: 'Unauthorized' }),
                })
                .mockResolvedValueOnce({
                    ok: false,
                    status: UNAUTHORIZED,
                });

            await expect(apiFetch('/test')).rejects.toMatchObject({
                name: 'ApiError',
                status: UNAUTHORIZED,
            });
            expect(auth.logout).toHaveBeenCalledTimes(1);
            expect(auth.logout).toHaveBeenCalledWith(false);
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
