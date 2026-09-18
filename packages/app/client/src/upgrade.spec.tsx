// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { Linking } from 'react-native';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import UpgradeScreen from './app/upgrade';

import type { Root } from 'react-dom/client';

const { billing, session } = vi.hoisted(() => ({
    billing: { load: vi.fn(), purchase: vi.fn(), restore: vi.fn() },
    session: {
        user: { id: 'account-a', tier: 'BASIC', emailVerified: true },
        isAuthenticated: true,
        isPremium: false,
        refreshPurchases: vi.fn(),
    },
}));

// Use real React state and press controls; native decoration is outside this checkout-state test.
vi.mock('react-native', () => vi.importActual<typeof import('react-native')>('react-native-web'));
vi.mock('react-native-svg', () => ({ default: 'svg', Path: 'path' }));
vi.mock('react-native-safe-area-context', async () => ({ SafeAreaView: (await import('react-native')).View }));
vi.mock('expo-router', () => ({
    useRouter: () => ({}),
    useLocalSearchParams: () => ({}),
    Link: ({ children }: { children: unknown }) => children,
}));
vi.mock('expo-router/head', () => ({ default: () => null }));
vi.mock('./components/auth-form.module.css', () => ({ unstable_styles: {} }));
vi.mock('./components/snackbar', () => ({ Snackbar: () => null }));
vi.mock('./session', () => ({ useSession: () => session }));
vi.mock('./services/billing.service', () => ({
    BillingService: billing,
    billingApiKey: () => 'test_example',
    purchaseNotice: () => null,
}));

let root: Root;
let container: HTMLDivElement;

beforeEach(async () => {
    vi.resetAllMocks();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    session.isPremium = false;
    session.user.tier = 'BASIC';
    session.user.emailVerified = true;
    billing.load.mockResolvedValue({
        packages: { yearly: { product: { priceString: '$10.00' } } },
        hasSubscription: false,
        managementURL: null,
    });
    billing.purchase.mockResolvedValue({});
    billing.restore.mockResolvedValue({});
    session.refreshPurchases.mockRejectedValue(new Error('Verification unavailable'));
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

it('keeps checkout available after a failed restore but blocks duplicate purchases after checkout', async () => {
    await act(async () => root.render(createElement(UpgradeScreen)));
    const purchase = container.querySelector<HTMLButtonElement>('[data-testid="upgrade-purchase"]')!;
    const restore = container.querySelector<HTMLButtonElement>('[data-testid="upgrade-restore"]')!;

    await act(async () => restore.click());
    expect(purchase.disabled).toBe(false);

    await act(async () => purchase.click());
    expect(purchase.disabled).toBe(true);

    await act(async () => restore.click());
    expect(purchase.disabled).toBe(true);
    await act(async () => purchase.click());
    expect(billing.purchase).toHaveBeenCalledTimes(1);
});

it('requires verified email for checkout while leaving restoration available', async () => {
    session.user.emailVerified = false;
    await act(async () => root.render(createElement(UpgradeScreen)));
    const purchase = container.querySelector<HTMLButtonElement>('[data-testid="upgrade-purchase"]')!;
    const restore = container.querySelector<HTMLButtonElement>('[data-testid="upgrade-restore"]')!;
    await act(async () => purchase.click());
    expect(purchase.disabled).toBe(true);
    expect(billing.purchase).not.toHaveBeenCalled();
    await act(async () => restore.click());
    expect(billing.restore).toHaveBeenCalledWith('account-a');
    session.user.emailVerified = true;
    await act(async () => root.render(createElement(UpgradeScreen)));
    expect(purchase.disabled).toBe(false);
});

it.each([
    {
        plan: 'store subscription',
        hasSubscription: true,
        managementURL: 'https://apps.apple.com/account/subscriptions',
    },
    { plan: 'test subscription', hasSubscription: true, managementURL: null },
    { plan: 'lifetime purchase', hasSubscription: false, managementURL: null },
])('offers cancellation, not restoration, for an active $plan', async ({ hasSubscription, managementURL }) => {
    session.isPremium = true;
    session.user.tier = 'PREMIUM';
    billing.load.mockResolvedValue({ packages: {}, hasSubscription, managementURL });
    const openURL = vi.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await act(async () => root.render(createElement(UpgradeScreen)));

    expect(container.querySelector('[data-testid="upgrade-restore"]')).toBeNull();
    const cancel = container.querySelector<HTMLButtonElement>('[data-testid="upgrade-manage"]');
    if (!hasSubscription) {
        expect(cancel).toBeNull();
        return;
    }
    expect(cancel?.disabled).toBe(!managementURL);
    await act(async () => cancel!.click());
    if (managementURL) expect(openURL).toHaveBeenCalledWith(managementURL);
    else expect(openURL).not.toHaveBeenCalled();
});

it('loads subscription management when a restored purchase activates Premium', async () => {
    const managementURL = 'https://play.google.com/store/account/subscriptions';
    await act(async () => root.render(createElement(UpgradeScreen)));
    billing.load.mockResolvedValue({ packages: {}, hasSubscription: true, managementURL });
    session.refreshPurchases.mockImplementation(async () => {
        session.isPremium = true;
        session.user.tier = 'PREMIUM';
        root.render(createElement(UpgradeScreen));
        return session.user;
    });
    const openURL = vi.spyOn(Linking, 'openURL').mockResolvedValue(undefined);

    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="upgrade-restore"]')!.click());
    expect(billing.restore).toHaveBeenCalledWith('account-a');
    const cancel = container.querySelector<HTMLButtonElement>('[data-testid="upgrade-manage"]');
    expect(cancel?.disabled).toBe(false);
    await act(async () => cancel!.click());
    expect(openURL).toHaveBeenCalledWith(managementURL);
});
