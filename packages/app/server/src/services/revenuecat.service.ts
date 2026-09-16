import { z } from 'zod';
import * as userRepository from '../db/repositories/user.repository.js';

const date = z.iso.datetime({ offset: true }).transform((value) => new Date(value));
const purchaseSchema = z.object({ is_sandbox: z.boolean(), purchase_date: date });
const customerSchema = z.object({
    request_date_ms: z.number().int().nonnegative().max(8.64e15),
    subscriber: z.object({
        entitlements: z.record(
            z.string(),
            z.object({
                expires_date: date.nullable(),
                grace_period_expires_date: date.nullish(),
                product_identifier: z.string(),
                purchase_date: date,
            }),
        ),
        subscriptions: z.record(z.string(), purchaseSchema),
        non_subscriptions: z.record(z.string(), z.array(purchaseSchema)),
    }),
});

export async function fetchPremiumEntitlement(userId: string) {
    const apiKey = process.env.REVENUECAT_SECRET_API_KEY;
    if (!apiKey) throw new Error('RevenueCat is not configured.');

    const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`RevenueCat lookup failed with status ${response.status}.`);

    const { subscriber, request_date_ms } = customerSchema.parse(await response.json());
    const entitlement = subscriber.entitlements[process.env.REVENUECAT_ENTITLEMENT_ID || 'premium'];
    const billingCheckedAt = new Date(request_date_ms);
    if (!entitlement)
        return { tier: 'BASIC' as const, premiumExpiresAt: null, billingCheckedAt, billingSandbox: false };

    const purchase =
        subscriber.subscriptions[entitlement.product_identifier] ||
        subscriber.non_subscriptions[entitlement.product_identifier]?.find(
            (item) => item.purchase_date.getTime() === entitlement.purchase_date.getTime(),
        );
    if (!purchase) throw new Error('RevenueCat entitlement has no matching purchase.');

    const premiumExpiresAt = entitlement.expires_date
        ? new Date(Math.max(entitlement.expires_date.getTime(), entitlement.grace_period_expires_date?.getTime() || 0))
        : null;
    const allowed = !purchase.is_sandbox || process.env.REVENUECAT_ALLOW_SANDBOX === 'true';
    const active = allowed && (!premiumExpiresAt || premiumExpiresAt.getTime() > Date.now());
    return {
        tier: active ? ('PREMIUM' as const) : ('BASIC' as const),
        premiumExpiresAt,
        billingCheckedAt,
        billingSandbox: purchase.is_sandbox,
    };
}

export async function syncRevenueCatCustomer(userId: string) {
    const user = await userRepository.getUserAuthById(userId);
    if (!user) return null;
    const entitlement = await fetchPremiumEntitlement(user.id);
    await userRepository.updateBillingEntitlement(user.id, entitlement);
    return userRepository.getUserTierById(user.id);
}
