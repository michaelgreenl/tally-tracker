import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import apiFetch from '../api';
import { billingApiKey, BillingService, purchaseNotice } from './billing.service';

import type { PurchasesPackage } from 'react-native-purchases';

const { platform, sdk } = vi.hoisted(() => ({
    platform: { OS: 'ios' },
    sdk: {
        isConfigured: vi.fn(),
        configure: vi.fn(),
        getAppUserID: vi.fn(),
        logIn: vi.fn(),
        getOfferings: vi.fn(),
        getCustomerInfo: vi.fn(),
        purchasePackage: vi.fn(),
        restorePurchases: vi.fn(),
        addCustomerInfoUpdateListener: vi.fn(),
        removeCustomerInfoUpdateListener: vi.fn(),
    },
}));

vi.mock('react-native', () => ({ Platform: platform }));
vi.mock('react-native-purchases', () => ({ default: sdk }));
vi.mock('../api', () => ({ default: vi.fn() }));

const annual = { identifier: '$rc_annual', product: { priceString: '€10,00' } } as PurchasesPackage;

beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('__DEV__', true);
    vi.stubEnv('EXPO_PUBLIC_REVENUECAT_TEST_API_KEY', 'test_example');
    vi.stubEnv('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', '');
    vi.stubEnv('EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY', '');
    platform.OS = 'ios';
    sdk.isConfigured.mockResolvedValue(false);
    sdk.getOfferings.mockResolvedValue({ current: { annual } });
    sdk.getCustomerInfo.mockResolvedValue({ managementURL: null });
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

it('keeps Test Store out of release builds and all native purchase keys out of the web', async () => {
    expect(billingApiKey()).toBe('test_example');
    vi.stubGlobal('__DEV__', false);
    expect(billingApiKey()).toBe('');
    vi.stubEnv('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'test_misconfigured');
    expect(billingApiKey()).toBe('');
    vi.stubEnv('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'appl_live');
    expect(billingApiKey()).toBe('appl_live');
    platform.OS = 'android';
    vi.stubEnv('EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY', 'goog_live');
    expect(billingApiKey()).toBe('goog_live');
    platform.OS = 'web';
    await expect(BillingService.restore('account-a')).rejects.toThrow();
    expect(sdk.restorePurchases).not.toHaveBeenCalled();
});

it('requires an account and uses the exact current store package, not a client price', async () => {
    await expect(BillingService.load('')).rejects.toThrow();
    expect(sdk.configure).not.toHaveBeenCalled();
    const result = await BillingService.load('account-a');
    await BillingService.purchase('account-a', result.packages.yearly!);
    expect(sdk.configure).toHaveBeenCalledWith({ apiKey: 'test_example', appUserID: 'account-a' });
    expect(result.packages).toEqual({ monthly: null, yearly: annual, lifetime: null });
    expect(sdk.purchasePackage).toHaveBeenCalledWith(annual);
    expect(sdk.restorePurchases).not.toHaveBeenCalled();
});

it('does not switch SDK identity during checkout and releases the queue after a cancellation', async () => {
    sdk.isConfigured.mockResolvedValue(true);
    sdk.getAppUserID.mockResolvedValue('account-a');
    let cancel!: (error: unknown) => void;
    sdk.purchasePackage.mockReturnValue(
        new Promise((_resolve, reject) => {
            cancel = reject;
        }),
    );
    const purchase = BillingService.purchase('account-a', annual);
    const canceled = expect(purchase).rejects.toMatchObject({ code: '1' });
    const restore = BillingService.restore('account-b');
    await vi.waitFor(() => expect(sdk.purchasePackage).toHaveBeenCalledOnce());
    expect(sdk.logIn).not.toHaveBeenCalled();
    expect(sdk.restorePurchases).not.toHaveBeenCalled();
    cancel({ code: '1' });
    await canceled;
    await restore;
    expect(sdk.logIn).toHaveBeenCalledWith('account-b');
    expect(sdk.logIn.mock.invocationCallOrder[0]).toBeLessThan(sdk.restorePurchases.mock.invocationCallOrder[0]);
});

it('sends no client entitlement proof and rejects failed server verification', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ success: false }).mockResolvedValueOnce({ success: true });
    await expect(BillingService.sync()).rejects.toThrow();
    await expect(BillingService.sync()).resolves.toBeUndefined();
    expect(apiFetch).toHaveBeenCalledWith('/billing/sync', { method: 'POST' });
});

it('removes the exact customer listener on cleanup', async () => {
    const listener = vi.fn();
    const remove = await BillingService.subscribe('account-a', listener);
    expect(sdk.addCustomerInfoUpdateListener).toHaveBeenCalledWith(listener);
    remove();
    expect(sdk.removeCustomerInfoUpdateListener).toHaveBeenCalledWith(listener);
});

it('treats cancellation silently and does not leak store diagnostics', () => {
    expect(purchaseNotice({ code: '1', message: 'internal' })).toBeNull();
    expect(purchaseNotice({ userCancelled: true })).toBeNull();
    expect(purchaseNotice({ code: '20' })).not.toBe(purchaseNotice(new Error('internal')));
    expect(purchaseNotice({ code: '42', message: 'private provider diagnostics' })).not.toContain(
        'private provider diagnostics',
    );
});
