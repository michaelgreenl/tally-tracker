import * as Sentry from '@sentry/react-native';

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
        beforeBreadcrumb: () => null,
        beforeSend: sanitizeEvent,
    });
};

export const withSentry = Sentry.wrap;
