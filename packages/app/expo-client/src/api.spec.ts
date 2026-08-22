import { OK, UNAUTHORIZED } from '@tally/core/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import apiFetch from './api';

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
});
