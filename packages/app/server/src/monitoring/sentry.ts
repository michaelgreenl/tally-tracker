import * as Sentry from '@sentry/node';

import type { ErrorRequestHandler, Request } from 'express';

const DISABLED_VALUE = 'false';

const sanitizeUrl = (url: string | undefined): string | undefined => {
    if (!url) return url;

    try {
        const parsed = new URL(url, 'http://localhost');
        return `${parsed.origin}${parsed.pathname}`;
    } catch {
        return undefined;
    }
};

const sanitizeEvent = <T extends Sentry.Event>(event: T): T => {
    // Error messages, bodies, extras, and breadcrumbs can contain credentials or counter content.
    event.request = event.request ? { method: event.request.method, url: sanitizeUrl(event.request.url) } : undefined;
    event.extra = undefined;
    event.breadcrumbs = undefined;
    event.message = undefined;
    event.logentry = undefined;
    event.user = undefined;
    for (const exception of event.exception?.values ?? []) exception.value = undefined;
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
        integrations: [Sentry.httpIntegration({ maxIncomingRequestBodySize: 'none' })],
        beforeBreadcrumb: () => null,
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
