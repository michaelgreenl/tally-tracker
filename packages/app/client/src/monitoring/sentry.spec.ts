import { beforeEach, describe, expect, it, vi } from 'vitest';

import { initSentry, sanitizeEvent } from './sentry';

const { getClient, init } = vi.hoisted(() => ({ getClient: vi.fn(), init: vi.fn(), wrap: vi.fn() }));

vi.mock('@sentry/react-native', () => ({ getClient, init, wrap: vi.fn() }));

describe('Sentry monitoring', () => {
    beforeEach(() => {
        vi.unstubAllEnvs();
        getClient.mockReset();
        init.mockReset();
    });

    it('removes request credentials and query values from events', () => {
        const event = sanitizeEvent({
            request: {
                cookies: { session: 'secret' },
                headers: { Authorization: 'secret', Accept: 'application/json', Cookie: 'secret' },
                query_string: 'token=secret',
                url: 'https://example.com/counters?token=secret',
            },
        });

        expect(event.request).toEqual({
            cookies: undefined,
            headers: { Accept: 'application/json' },
            query_string: undefined,
            url: 'https://example.com/counters',
        });
    });

    it('initializes only when a DSN is configured', () => {
        initSentry();
        expect(init).not.toHaveBeenCalled();

        vi.stubEnv('EXPO_PUBLIC_SENTRY_DSN', 'https://public@example.com/1');
        initSentry();

        expect(init).toHaveBeenCalledWith(
            expect.objectContaining({
                dsn: 'https://public@example.com/1',
                sendDefaultPii: false,
                enableCaptureFailedRequests: false,
            }),
        );
    });
});
