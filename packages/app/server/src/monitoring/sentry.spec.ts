import * as Sentry from '@sentry/node';
import { afterEach, expect, it, vi } from 'vitest';

import { initSentry } from './sentry.js';

const { init } = vi.hoisted(() => ({ init: vi.fn() }));
vi.mock('@sentry/node', async (importOriginal) => ({
    ...(await importOriginal<typeof Sentry>()),
    init,
    isInitialized: () => false,
}));

afterEach(() => vi.unstubAllEnvs());

it.each([true, false])('strips private data from the SDK pipeline (request: %s)', async (hasRequest) => {
    vi.stubEnv('SENTRY_DSN', 'https://public@example.com/1');
    initSentry();
    const envelopes: unknown[] = [];
    let sentEvent: Sentry.Event | undefined;
    const client = new Sentry.NodeClient({
        ...init.mock.calls[0][0],
        integrations: [Sentry.requestDataIntegration()],
        transport: () => ({
            send: async (envelope) => {
                envelopes.push(envelope);
                sentEvent = envelope[1].find(([header]) => header.type === 'event')?.[1] as Sentry.Event;
                return { statusCode: 200 };
            },
            flush: async () => true,
        }),
    });
    client.init();
    client.captureEvent({
        sdkProcessingMetadata: hasRequest
            ? {
                  normalizedRequest: {
                      method: 'POST',
                      url: 'https://private-user@example.com/users?email=private-email',
                      data: {
                          password: 'private-password',
                          code: 'private-code',
                          refreshToken: 'private-token',
                          title: 'private-counter',
                      },
                      headers: {
                          authorization: 'private-token',
                          cookie: 'private-cookie',
                          'x-custom-secret': 'private-header',
                      },
                  },
              }
            : undefined,
        message: 'private-message',
        logentry: { message: 'private-log' },
        user: { email: 'private-email' },
        extra: { body: 'private-body' },
        breadcrumbs: [{ category: 'console', message: 'private-code' }],
        exception: {
            values: [
                {
                    type: 'Error',
                    value: 'private-password',
                    stacktrace: { frames: [{ filename: 'user.controller.ts', lineno: 12 }] },
                },
            ],
        },
        tags: { source: 'user.post' },
    });
    await client.flush(1000);
    await client.close();
    expect(envelopes).toHaveLength(1);
    expect(JSON.stringify(envelopes)).not.toContain('private-');
    expect(sentEvent?.exception?.values?.[0]).toMatchObject({
        type: 'Error',
        stacktrace: { frames: [{ filename: 'user.controller.ts', lineno: 12 }] },
    });
    expect(sentEvent?.tags?.source).toBe('user.post');
});
