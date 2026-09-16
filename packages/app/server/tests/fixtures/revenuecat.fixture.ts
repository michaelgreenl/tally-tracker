export function buildRevenueCatCustomer({
    expiresAt = new Date(Date.now() + 3_600_000).toISOString() as string | null,
    graceUntil = null as string | null,
    sandbox = false,
    requestTime = Date.now(),
} = {}) {
    const product = expiresAt === null ? 'tally_lifetime' : 'tally_monthly';
    const purchase = { is_sandbox: sandbox, purchase_date: '2026-09-01T00:00:00Z' };
    return {
        request_date_ms: requestTime,
        subscriber: {
            entitlements: {
                premium: {
                    product_identifier: product,
                    purchase_date: purchase.purchase_date,
                    expires_date: expiresAt,
                    grace_period_expires_date: graceUntil,
                },
            },
            subscriptions: expiresAt === null ? {} : { [product]: purchase },
            non_subscriptions: expiresAt === null ? { [product]: [purchase] } : {},
        },
    };
}
