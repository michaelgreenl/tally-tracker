import { Platform } from 'react-native';

import apiFetch from '../api';

import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';

type Purchases = typeof import('react-native-purchases').default;

export function billingApiKey() {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return '';
    const testKey = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
    if (__DEV__ && testKey?.startsWith('test_')) return testKey;
    const key =
        Platform.OS === 'ios'
            ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
            : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
    return key?.startsWith(Platform.OS === 'ios' ? 'appl_' : 'goog_') ? key : '';
}

// Keep identification and store operations together: an account switch cannot interrupt a purchase.
let pending: Promise<unknown> = Promise.resolve();
function withCustomer<T>(userId: string, action: (purchases: Purchases) => Promise<T>): Promise<T> {
    const request = pending.then(async () => {
        const apiKey = billingApiKey();
        if (!userId || !apiKey) throw new Error('Purchases are unavailable.');
        const { default: purchases } = await import('react-native-purchases');
        if (!(await purchases.isConfigured())) {
            purchases.configure({ apiKey, appUserID: userId });
        } else if ((await purchases.getAppUserID()) !== userId) {
            await purchases.logIn(userId);
        }
        return action(purchases);
    });
    pending = request.catch(() => undefined);
    return request;
}

export const BillingService = {
    load(userId: string) {
        return withCustomer(userId, async (purchases) => {
            const [offerings, customer] = await Promise.all([purchases.getOfferings(), purchases.getCustomerInfo()]);
            return {
                packages: {
                    monthly: offerings.current?.monthly ?? null,
                    yearly: offerings.current?.annual ?? null,
                    lifetime: offerings.current?.lifetime ?? null,
                },
                managementURL: customer.managementURL,
            };
        });
    },
    purchase(userId: string, product: PurchasesPackage) {
        return withCustomer(userId, (purchases) => purchases.purchasePackage(product));
    },
    restore(userId: string) {
        return withCustomer(userId, (purchases) => purchases.restorePurchases());
    },
    async sync() {
        const result = await apiFetch<{ success: boolean }>('/billing/sync', { method: 'POST' });
        if (!result.success) throw new Error('Could not verify purchases.');
    },
    subscribe(userId: string, onChange: (customer: CustomerInfo) => void) {
        return withCustomer(userId, async (purchases) => {
            purchases.addCustomerInfoUpdateListener(onChange);
            return () => purchases.removeCustomerInfoUpdateListener(onChange);
        });
    },
};

export function purchaseNotice(error: unknown, fallback = 'Purchase failed. Try again.'): string | null {
    if (typeof error === 'object' && error !== null) {
        if ('userCancelled' in error && error.userCancelled === true) return null;
        if ('code' in error) {
            // RevenueCat's stable purchase error codes; do not expose provider diagnostics in the UI.
            if (String(error.code) === '1') return null;
            if (String(error.code) === '20') return 'Payment awaiting approval.';
            if (['7', '13'].includes(String(error.code)))
                return 'Sign in to the Tally account that owns this purchase.';
            if (String(error.code) === '6') return 'Already purchased. Try Restore purchases.';
        }
    }
    return fallback;
}
