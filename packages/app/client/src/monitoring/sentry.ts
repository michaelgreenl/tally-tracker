import * as Sentry from '@sentry/capacitor';
import { init as initSentryVue, vueIntegration } from '@sentry/vue';

import type { App } from 'vue';

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
        const parsed = new URL(url);
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

export const initSentry = (app: App<Element>) => {
    const dsn = import.meta.env.VITE_SENTRY_DSN;
    const enabled = import.meta.env.VITE_SENTRY_ENABLED !== DISABLED_VALUE && Boolean(dsn);

    if (!enabled) return;

    Sentry.init(
        {
            dsn,
            environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
            release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
            dist: import.meta.env.VITE_SENTRY_DIST || undefined,
            sendDefaultPii: false,
            attachStacktrace: true,
            enableCaptureFailedRequests: false,
            integrations: [
                vueIntegration({
                    app,
                    attachErrorHandler: true,
                    attachProps: false,
                }),
            ],
            beforeSend: sanitizeEvent,
        },
        initSentryVue,
    );
};
