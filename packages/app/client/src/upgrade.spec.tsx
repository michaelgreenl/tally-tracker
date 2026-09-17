// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import UpgradeScreen from './app/upgrade';

import type { Root } from 'react-dom/client';

const { billing, session } = vi.hoisted(() => ({
    billing: { load: vi.fn(), purchase: vi.fn(), restore: vi.fn() },
    session: {
        user: { id: 'account-a', tier: 'BASIC' },
        isAuthenticated: true,
        isPremium: false,
        refreshPurchases: vi.fn(),
    },
}));

// Use real React state and press controls; native decoration is outside this checkout-state test.
vi.mock('react-native', () => vi.importActual<typeof import('react-native')>('react-native-web'));
vi.mock('react-native-svg', () => ({ default: 'svg', Path: 'path' }));
vi.mock('react-native-safe-area-context', async () => ({ SafeAreaView: (await import('react-native')).View }));
vi.mock('expo-router', () => ({ useRouter: () => ({}), Link: ({ children }: { children: unknown }) => children }));
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
    billing.load.mockResolvedValue({ packages: { yearly: { product: { priceString: '$10.00' } } } });
    billing.purchase.mockResolvedValue({});
    billing.restore.mockResolvedValue({});
    session.refreshPurchases.mockRejectedValue(new Error('Verification unavailable'));
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(createElement(UpgradeScreen)));
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

it('keeps checkout available after a failed restore but blocks duplicate purchases after checkout', async () => {
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
