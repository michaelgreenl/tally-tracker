import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';

import { billingApiKey, BillingService } from './billing.service';
import { assertSession, getSessionScope } from '../session/session-scope';

import type { ClientUser } from '@tally/core/client';

export function usePurchaseSync(userId: string | undefined, refreshUser: () => Promise<ClientUser>) {
    const refreshPurchases = useCallback(async () => {
        const scope = getSessionScope();
        if (!scope.userId) throw new Error('Sign in to verify purchases.');
        await BillingService.sync();
        assertSession(scope);
        return refreshUser();
    }, [refreshUser]);

    useEffect(() => {
        if (!userId || !billingApiKey()) return;
        let active = true;
        let refreshing = false;
        let unsubscribe: (() => void) | undefined;
        const refresh = async () => {
            if (!active || refreshing) return;
            refreshing = true;
            try {
                await refreshPurchases();
            } catch {
                // Keep the last verified profile offline. Explicit purchase/restore actions report failures.
            } finally {
                refreshing = false;
            }
        };
        void BillingService.subscribe(userId, () => void refresh())
            .then((remove) => {
                if (active) {
                    unsubscribe = remove;
                    void refresh();
                } else remove();
            })
            .catch(() => undefined);
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') void refresh();
        });
        return () => {
            active = false;
            unsubscribe?.();
            subscription.remove();
        };
    }, [userId, refreshPurchases]);

    return refreshPurchases;
}
