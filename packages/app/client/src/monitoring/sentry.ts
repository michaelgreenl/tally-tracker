import * as Sentry from '@sentry/react-native';

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

export const sanitizeEvent = <T extends Sentry.Event>(event: T): T => {
    if (!event.request) return event;

    event.request = {
        ...event.request,
        cookies: undefined,
        headers: sanitizeHeaders(event.request.headers),
        query_string: undefined,
        url: sanitizeUrl(event.request.url),
    };

    return event;
};

export const isSentryEnabled = () =>
    process.env.EXPO_PUBLIC_SENTRY_ENABLED !== DISABLED_VALUE && Boolean(process.env.EXPO_PUBLIC_SENTRY_DSN);

export const initSentry = () => {
    if (!isSentryEnabled() || Sentry.getClient()) return;

    Sentry.init({
        dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
        environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT || 'development',
        release: process.env.EXPO_PUBLIC_SENTRY_RELEASE || undefined,
        dist: process.env.EXPO_PUBLIC_SENTRY_DIST || undefined,
        sendDefaultPii: false,
        attachStacktrace: true,
        enableCaptureFailedRequests: false,
        beforeSend: sanitizeEvent,
    });
};

export const withSentry = Sentry.wrap;
