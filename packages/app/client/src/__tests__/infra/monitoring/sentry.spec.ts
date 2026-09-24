import { beforeEach, describe, expect, it, vi } from 'vitest';

import { initSentry } from '../../../infra/monitoring/sentry';

const { getClient, init } = vi.hoisted(() => ({ getClient: vi.fn(), init: vi.fn(), wrap: vi.fn() }));

vi.mock('@sentry/react-native', () => ({ getClient, init, wrap: vi.fn() }));

describe('Sentry monitoring', () => {
    beforeEach(() => {
        vi.unstubAllEnvs();
        getClient.mockReset();
        init.mockReset();
    });

    it.each([true, false])('removes private diagnostics through the configured filter (request: %s)', (hasRequest) => {
        vi.stubEnv('EXPO_PUBLIC_SENTRY_DSN', 'https://public@example.com/1');
        initSentry();
        const event = init.mock.calls[0][0].beforeSend({
            request: hasRequest
                ? {
                      method: 'POST',
                      data: { password: 'private-password', code: 'private-code', title: 'private-counter' },
                      cookies: { session: 'secret' },
                      headers: { Authorization: 'secret', Accept: 'application/json', Cookie: 'secret' },
                      query_string: 'token=secret',
                      url: 'https://secret@example.com/counters?token=secret#secret',
                  }
                : undefined,
            message: 'private-message',
            logentry: { message: 'private-log' },
            user: { email: 'private-email' },
            extra: { refreshToken: 'private-refresh' },
            breadcrumbs: [{ category: 'console', message: 'private-code' }],
            exception: {
                values: [
                    {
                        type: 'Error',
                        value: 'private-password',
                        stacktrace: { frames: [{ filename: 'app.js', lineno: 12 }] },
                    },
                ],
            },
        });

        expect(JSON.stringify(event)).not.toMatch(/secret|private-/);
        if (hasRequest) expect(event.request).toMatchObject({ method: 'POST', url: 'https://example.com/counters' });
        expect(event.exception.values[0]).toMatchObject({
            type: 'Error',
            stacktrace: { frames: [{ filename: 'app.js', lineno: 12 }] },
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
