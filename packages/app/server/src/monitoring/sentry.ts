import * as Sentry from '@sentry/node';

import type { ErrorRequestHandler, Request } from 'express';

type SentryRequest = {
    cookies?: unknown;
    headers?: Record<string, string>;
    query_string?: unknown;
    url?: string;
};

type EventWithRequest = {
    request?: SentryRequest;
};

const DISABLED_VALUE = 'false';
const SENSITIVE_HEADERS = new Set(['authorization', 'cookie', 'set-cookie', 'x-api-key']);

const sanitizeUrl = (url: string | undefined): string | undefined => {
    if (!url) return url;

    try {
        const parsed = new URL(url, 'http://localhost');
        return `${parsed.origin}${parsed.pathname}`;
    } catch {
        return url.split('?')[0];
    }
};

const sanitizeHeaders = (headers: Record<string, string> | undefined): Record<string, string> | undefined => {
    if (!headers) return headers;

    return Object.fromEntries(Object.entries(headers).filter(([key]) => !SENSITIVE_HEADERS.has(key.toLowerCase())));
};

const sanitizeEvent = <T extends EventWithRequest>(event: T): T => {
    if (!event.request) return event;

    event.request = {
        ...event.request,
        cookies: undefined,
        headers: sanitizeHeaders(event.request.headers),
        query_string: undefined,
        url: sanitizeUrl(event.request.url),
    } as T['request'];

    return event;
};

export const isSentryEnabled = () => {
    return process.env.SENTRY_ENABLED !== DISABLED_VALUE && Boolean(process.env.SENTRY_DSN);
};

export const initSentry = () => {
    if (!isSentryEnabled() || Sentry.isInitialized()) return;

    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
        release: process.env.SENTRY_RELEASE || undefined,
        dist: process.env.SENTRY_DIST || undefined,
        sendDefaultPii: false,
        beforeSend: sanitizeEvent,
    });
};

export const getSentryErrorHandlers = (): ErrorRequestHandler[] => {
    if (!isSentryEnabled()) return [];

    return [Sentry.expressErrorHandler() as unknown as ErrorRequestHandler];
};

export const captureServerError = (
    error: unknown,
    context: {
        req?: Request;
        source: string;
    },
) => {
    if (!isSentryEnabled() || !Sentry.isInitialized()) return;

    Sentry.withScope((scope) => {
        scope.setTag('source', context.source);

        if (context.req) {
            scope.setContext('request_summary', {
                method: context.req.method,
                path: context.req.path,
            });
        }

        Sentry.captureException(error);
    });
};
