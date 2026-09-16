import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPremiumEntitlement } from '../../src/services/revenuecat.service.js';
import { buildRevenueCatCustomer } from '../fixtures/revenuecat.fixture.js';

const now = new Date('2026-09-16T20:00:00Z');
const past = '2026-09-16T19:00:00Z';
const future = '2026-09-16T21:00:00Z';

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
    vi.stubEnv('REVENUECAT_SECRET_API_KEY', 'test-server-key');
    vi.stubEnv('REVENUECAT_ENTITLEMENT_ID', 'premium');
    vi.stubEnv('REVENUECAT_ALLOW_SANDBOX', 'false');
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

describe('RevenueCat entitlement verification', () => {
    it.each([
        { name: 'paid subscription', expiresAt: future, graceUntil: null, tier: 'PREMIUM', expiry: future },
        { name: 'lifetime purchase', expiresAt: null, graceUntil: null, tier: 'PREMIUM', expiry: null },
        { name: 'expired subscription', expiresAt: past, graceUntil: null, tier: 'BASIC', expiry: past },
        {
            name: 'expiration boundary',
            expiresAt: now.toISOString(),
            graceUntil: null,
            tier: 'BASIC',
            expiry: now.toISOString(),
        },
        { name: 'active billing grace period', expiresAt: past, graceUntil: future, tier: 'PREMIUM', expiry: future },
        { name: 'expired billing grace period', expiresAt: past, graceUntil: past, tier: 'BASIC', expiry: past },
    ])('handles $name', async ({ expiresAt, graceUntil, tier, expiry }) => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(Response.json(buildRevenueCatCustomer({ expiresAt, graceUntil }))),
        );

        expect(await fetchPremiumEntitlement('account-id')).toEqual({
            tier,
            premiumExpiresAt: expiry ? new Date(expiry) : null,
            billingCheckedAt: now,
            billingSandbox: false,
        });
    });

    it.each([false, true])('requires explicit permission for sandbox purchases (allowed: %s)', async (allow) => {
        vi.stubEnv('REVENUECAT_ALLOW_SANDBOX', String(allow));
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(buildRevenueCatCustomer({ sandbox: true }))));
        expect(await fetchPremiumEntitlement('account-id')).toMatchObject({
            tier: allow ? 'PREMIUM' : 'BASIC',
            billingSandbox: true,
        });
    });

    it('does not grant premium for a different entitlement', async () => {
        const customer = buildRevenueCatCustomer();
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                Response.json({
                    ...customer,
                    subscriber: {
                        ...customer.subscriber,
                        entitlements: { unrelated: customer.subscriber.entitlements.premium },
                    },
                }),
            ),
        );
        expect(await fetchPremiumEntitlement('account-id')).toMatchObject({ tier: 'BASIC', premiumExpiresAt: null });
    });

    it('rejects malformed provider data instead of treating a missing expiration as lifetime access', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                Response.json({
                    request_date_ms: now.getTime(),
                    subscriber: {
                        entitlements: { premium: { product_identifier: 'lifetime' } },
                        subscriptions: {},
                        non_subscriptions: {},
                    },
                }),
            ),
        );
        await expect(fetchPremiumEntitlement('account-id')).rejects.toThrow();
    });
});
