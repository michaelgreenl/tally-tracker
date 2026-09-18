import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../../src/app.js';
import prisma from '../../src/db/prisma.js';
import jwt from '../../src/util/jwt.util.js';
import { buildRevenueCatCustomer } from '../fixtures/revenuecat.fixture.js';

const secret = 'test-only-revenuecat-webhook-secret';

beforeEach(() => {
    app.set('io', { to: () => ({ emit() {} }) });
    vi.stubEnv('REVENUECAT_SECRET_API_KEY', 'test-server-key');
    vi.stubEnv('REVENUECAT_WEBHOOK_SECRET', secret);
    vi.stubEnv('REVENUECAT_ENTITLEMENT_ID', 'premium');
    vi.stubEnv('REVENUECAT_ALLOW_SANDBOX', 'false');
});

afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

async function account() {
    const user = await prisma.user.create({
        data: { email: `${randomUUID()}@example.invalid`, password: 'test-only' },
    });
    const authorization = `Bearer ${jwt.sign({ id: user.id, email: user.email, sessionVersion: user.sessionVersion })}`;
    const counter = await prisma.counter.create({ data: { title: 'Billing access check', userId: user.id } });
    return { user, authorization, counter };
}

const notify = (event: Record<string, unknown>) =>
    request(app)
        .post('/billing/revenuecat')
        .set('Authorization', `Bearer ${secret}`)
        .send({ event: { id: randomUUID(), type: 'RENEWAL', ...event } });

describe('RevenueCat billing integration', () => {
    it('grants access after verification, keeps access after cancellation, and removes it after refund', async () => {
        const { user, authorization, counter } = await account();
        const customer = buildRevenueCatCustomer();
        const upstream = vi.fn().mockResolvedValue(Response.json(customer));
        vi.stubGlobal('fetch', upstream);

        await request(app).post(`/counters/${counter.id}/share`).set('Authorization', authorization).expect(403);
        await request(app).post('/billing/sync').set('Authorization', authorization).expect(200);
        expect(await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({
            tier: 'PREMIUM',
            premiumExpiresAt: new Date(customer.subscriber.entitlements.premium.expires_date!),
        });
        await request(app).post(`/counters/${counter.id}/share`).set('Authorization', authorization).expect(200);

        upstream.mockResolvedValue(
            Response.json(buildRevenueCatCustomer({ requestTime: customer.request_date_ms + 1 })),
        );
        await notify({ type: 'CANCELLATION', app_user_id: user.id }).expect(200);
        const active = await request(app).get('/users/check-auth').set('Authorization', authorization).expect(200);
        expect(active.body.data.user.tier).toBe('PREMIUM');

        upstream.mockResolvedValue(
            Response.json({
                request_date_ms: customer.request_date_ms + 2,
                subscriber: { entitlements: {}, subscriptions: {}, non_subscriptions: {} },
            }),
        );
        await notify({ type: 'CANCELLATION', app_user_id: user.id, cancel_reason: 'CUSTOMER_SUPPORT' }).expect(200);
        await request(app).post(`/counters/${counter.id}/share`).set('Authorization', authorization).expect(403);
        const refunded = await request(app).get('/users/check-auth').set('Authorization', authorization).expect(200);
        expect(refunded.body.data.user.tier).toBe('BASIC');
    });

    it('rejects forged events and client-supplied account IDs without granting another account access', async () => {
        const owner = await account();
        const other = await account();
        const upstream = vi.fn().mockResolvedValue(Response.json(buildRevenueCatCustomer({ expiresAt: null })));
        vi.stubGlobal('fetch', upstream);
        await request(app).post('/billing/sync').expect(401);
        await request(app)
            .post('/billing/revenuecat')
            .send({ event: { id: 'forged', type: 'INITIAL_PURCHASE', app_user_id: other.user.id } })
            .expect(401);
        await request(app)
            .post('/billing/sync')
            .set('Authorization', owner.authorization)
            .send({ app_user_id: other.user.id, tier: 'PREMIUM' })
            .expect(422);
        expect(await prisma.user.findUniqueOrThrow({ where: { id: other.user.id } })).toMatchObject({
            tier: 'BASIC',
            billingCheckedAt: null,
        });
        expect(upstream).not.toHaveBeenCalled();

        const restored = await request(app).post('/billing/sync').set('Authorization', owner.authorization).expect(200);
        expect(restored.body.data.tier).toBe('PREMIUM');
        expect(upstream).toHaveBeenCalledWith(
            `https://api.revenuecat.com/v1/subscribers/${owner.user.id}`,
            expect.objectContaining({
                headers: { Authorization: 'Bearer test-server-key', Accept: 'application/json' },
            }),
        );
        expect(await prisma.user.findUniqueOrThrow({ where: { id: other.user.id } })).toMatchObject({ tier: 'BASIC' });
    });

    it('ignores old snapshots and preserves access when RevenueCat is unavailable', async () => {
        const { user, authorization } = await account();
        const verifiedAt = new Date();
        await prisma.user.update({ where: { id: user.id }, data: { tier: 'PREMIUM', billingCheckedAt: verifiedAt } });
        const upstream = vi.fn().mockResolvedValue(
            Response.json({
                request_date_ms: verifiedAt.getTime() - 1,
                subscriber: { entitlements: {}, subscriptions: {}, non_subscriptions: {} },
            }),
        );
        vi.stubGlobal('fetch', upstream);
        await notify({ app_user_id: user.id }).expect(200);
        expect(await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({
            tier: 'PREMIUM',
            billingCheckedAt: verifiedAt,
        });

        upstream.mockRejectedValue(new TypeError('Network unavailable'));
        await notify({ app_user_id: user.id }).expect(503);
        await request(app).post('/billing/sync').set('Authorization', authorization).expect(503);
        expect(await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({
            tier: 'PREMIUM',
            billingCheckedAt: verifiedAt,
        });
    });

    it('expires cached access and rejects cached sandbox grants without waiting for a webhook', async () => {
        const { user, authorization, counter } = await account();
        await prisma.user.update({
            where: { id: user.id },
            data: { tier: 'PREMIUM', premiumExpiresAt: new Date(Date.now() - 1000) },
        });
        const expired = await request(app).get('/users/check-auth').set('Authorization', authorization).expect(200);
        expect(expired.body.data.user.tier).toBe('BASIC');
        await request(app).post(`/counters/${counter.id}/share`).set('Authorization', authorization).expect(403);

        await prisma.user.update({ where: { id: user.id }, data: { premiumExpiresAt: null, billingSandbox: true } });
        vi.stubEnv('REVENUECAT_ALLOW_SANDBOX', 'true');
        await request(app).post(`/counters/${counter.id}/share`).set('Authorization', authorization).expect(200);
        vi.stubEnv('REVENUECAT_ALLOW_SANDBOX', 'false');
        await request(app).post(`/counters/${counter.id}/share`).set('Authorization', authorization).expect(403);
    });

    it('refreshes both accounts after a purchase transfer and safely repeats the notification', async () => {
        const previous = await account();
        const current = await account();
        await prisma.user.update({ where: { id: previous.user.id }, data: { tier: 'PREMIUM' } });
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: string) =>
                Response.json(
                    url.endsWith(previous.user.id)
                        ? {
                              request_date_ms: Date.now(),
                              subscriber: { entitlements: {}, subscriptions: {}, non_subscriptions: {} },
                          }
                        : buildRevenueCatCustomer({ expiresAt: null }),
                ),
            ),
        );
        const transfer = {
            id: randomUUID(),
            type: 'TRANSFER',
            transferred_from: [previous.user.id],
            transferred_to: [current.user.id],
        };
        await notify(transfer).expect(200);
        await notify(transfer).expect(200);
        await request(app)
            .post(`/counters/${previous.counter.id}/share`)
            .set('Authorization', previous.authorization)
            .expect(403);
        await request(app)
            .post(`/counters/${current.counter.id}/share`)
            .set('Authorization', current.authorization)
            .expect(200);
        expect(await prisma.user.findUniqueOrThrow({ where: { id: current.user.id } })).toMatchObject({
            tier: 'PREMIUM',
            premiumExpiresAt: null,
        });
    });

    it('acknowledges dashboard tests and deleted accounts without creating new customer data', async () => {
        const upstream = vi.fn();
        vi.stubGlobal('fetch', upstream);
        await notify({ type: 'TEST' }).expect(200);
        await notify({ app_user_id: randomUUID(), aliases: ['$RCAnonymousID:test'] }).expect(200);
        expect(upstream).not.toHaveBeenCalled();
        expect(await prisma.user.count()).toBe(0);
    });
});
