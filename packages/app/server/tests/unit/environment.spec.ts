import { describe, expect, it } from 'vitest';

import { validateEnvironment } from '../../src/config/environment.js';

const production = {
    NODE_ENV: 'production',
    POSTGRES_URL: 'postgresql://fixture:private-password@db.example.com/tally',
    JWT_SECRET: 'jwt-fixture-secret-with-at-least-32-characters',
    EMAIL_OTP_SECRET: 'otp-fixture-secret-with-at-least-32-characters',
    RESEND_API_KEY: 're_fixture-only',
    EMAIL_FROM: 'Tally <noreply@example.com>',
    FRONTEND_URL: 'https://tally.example.com',
};

describe('startup configuration', () => {
    it('keeps local development and test setup independent of production services', () => {
        for (const NODE_ENV of [undefined, 'development', 'test']) {
            expect(() => validateEnvironment({ NODE_ENV })).not.toThrow();
        }
    });

    it('accepts configured production services with billing enabled or disabled', () => {
        expect(() => validateEnvironment(production)).not.toThrow();
        expect(() =>
            validateEnvironment({
                ...production,
                PORT: '3000',
                EMAIL_FROM: 'noreply@example.com',
                REVENUECAT_SECRET_API_KEY: 'sk_fixture-only',
                REVENUECAT_WEBHOOK_SECRET: 'webhook-fixture-secret-with-at-least-32-characters',
                REVENUECAT_ALLOW_SANDBOX: 'false',
            }),
        ).not.toThrow();
    });

    it.each([
        ['POSTGRES_URL', undefined],
        ['POSTGRES_URL', 'mysql://fixture:private-password@db.example.com/tally'],
        ['JWT_SECRET', 'short-private-secret'],
        ['EMAIL_OTP_SECRET', production.JWT_SECRET],
        ['RESEND_API_KEY', ''],
        ['EMAIL_FROM', 'Tally <invalid>'],
        ['EMAIL_FROM', 'Tally\r\n<noreply@example.com>'],
        ['FRONTEND_URL', 'http://tally.example.com'],
        ['PORT', '70000'],
        ['REVENUECAT_ALLOW_SANDBOX', 'yes'],
        ['NODE_ENV', 'prodution'],
    ])('rejects invalid %s without exposing its value', (field, value) => {
        let message = '';
        try {
            validateEnvironment({ ...production, [field!]: value });
        } catch (error) {
            message = (error as Error).message;
        }
        expect(message).toContain(field);
        if (value) expect(message).not.toContain(value);
    });

    it('requires both server billing credentials when either is configured', () => {
        expect(() => validateEnvironment({ ...production, REVENUECAT_SECRET_API_KEY: 'sk_fixture' })).toThrow(
            'REVENUECAT_WEBHOOK_SECRET',
        );
        expect(() => validateEnvironment({ ...production, REVENUECAT_WEBHOOK_SECRET: 'w'.repeat(32) })).toThrow(
            'REVENUECAT_SECRET_API_KEY',
        );
        expect(() =>
            validateEnvironment({
                ...production,
                REVENUECAT_SECRET_API_KEY: 'sk_fixture',
                REVENUECAT_WEBHOOK_SECRET: 'short',
            }),
        ).toThrow('REVENUECAT_WEBHOOK_SECRET');
    });
});
