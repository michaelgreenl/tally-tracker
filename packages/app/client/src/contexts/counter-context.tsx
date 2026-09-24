import * as Crypto from 'expo-crypto';
import {
    addCounterAmount,
    counterTitleSchema,
    counterValueSchema,
    counterIncrementSchema,
    counterMetricSchema,
} from '@tally/core/client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { ApiError, getErrorMessage, REQUEST_FAILED_MESSAGE } from '../infra/http/api';
import { CounterService } from '../services/counters/counter.service';
import { SyncManager } from '../infra/sync/sync-manager';
import { SyncQueue } from '../infra/sync/sync-queue';
import { WidgetSync } from '../infra/widgets/widget-sync';
import { assertSession, getSessionScope, SessionChangedError, writeSession } from '../services/session/session-scope';
import { connectSocket, disconnectSocket, subscribeToCounterUpdates } from '../infra/socket/socket';
import { useSession } from './session-context';

import {
    GUEST_COUNTER_LIMIT_MESSAGE,
    isGuestEligible,
    isGuestCounterLimitReached,
    orderCounters,
    reconcileAuthenticatedCounters,
} from '../utils/counter-rules';

import type { ClientCounter, HexColor, UpdateCounterRequest } from '@tally/core/client';
import type { PropsWithChildren } from 'react';
import type { SyncStatus } from '../infra/sync/sync-manager';

type ActionResult = { success: true } | { success: false; message: string };

type CounterContextValue = {
    counters: ClientCounter[];
    loading: boolean;
    refreshing: boolean;
    syncError: boolean;
    failedCounterIds: ReadonlySet<string>;
    eligibleCount: number;
    refreshCounters: () => void;
    createCounter: (title: string, color: HexColor, metric?: string) => Promise<ActionResult>;
    shareCounter: (
        counterId: string,
    ) => Promise<{ success: true; inviteCode: string } | { success: false; message: string }>;
    incrementCounter: (counterId: string, amount: number) => Promise<ActionResult>;
    updateCounter: (counterId: string, updates: UpdateCounterRequest) => Promise<ActionResult>;
    deleteCounter: (counter: ClientCounter) => Promise<ActionResult>;
    joinCounter: (inviteCode: string) => Promise<ActionResult>;
    reorderCounters: (ids: string[]) => Promise<ActionResult>;
};

const CounterContext = createContext<CounterContextValue | null>(null);
const ok = (): ActionResult => ({ success: true });
const fail = (message: string): ActionResult => ({ success: false, message });

export function CounterProvider({ children }: PropsWithChildren) {
    const { sessionId } = useSession();
    return <AccountCounters key={sessionId}>{children}</AccountCounters>;
}

function AccountCounters({ children }: PropsWithChildren) {
    const session = useSession();
    const [scope] = useState(getSessionScope);
    const [counters, setCounters] = useState<ClientCounter[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [syncError, setSyncError] = useState(false);
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
    const [failedCounterIds, setFailedCounterIds] = useState<ReadonlySet<string>>(new Set());
    const [refreshKey, setRefreshKey] = useState(0);
    const countersRef = useRef<ClientCounter[]>([]);
    const revision = useRef(0);
    const pendingWrites = useRef(0);
    const requestRefresh = useCallback(() => {
        revision.current += 1;
        setRefreshKey((key) => key + 1);
    }, []);

    function refreshCounters() {
        if (loading || refreshing) return;
        setRefreshing(true);
        requestRefresh();
    }

    const importWidgetChanges = useCallback(
        async (discardMissing = false) => {
            let next: ClientCounter[] | null;
            try {
                next = await WidgetSync.consume(scope, discardMissing);
            } catch (error) {
                if (!(error instanceof RangeError)) throw error;
                // Keep the failed state visible, but allow a decrement or deletion to resolve it.
                setSyncError(true);
                return;
            }
            assertSession(scope);
            if (next) {
                revision.current += 1;
                countersRef.current = next;
                setCounters(next);
            }
        },
        [scope],
    );

    const replaceCounters = useCallback(
        async (next: ClientCounter[]) => {
            assertSession(scope);
            countersRef.current = next;
            setCounters(next);
            await CounterService.persist(next);
            await WidgetSync.publish(next, scope);
        },
        [scope],
    );

    const persistMutation = useCallback(
        async (update: (current: ClientCounter[]) => ClientCounter[], enqueue?: () => Promise<void>) => {
            revision.current += 1;
            pendingWrites.current += 1;
            try {
                await writeSession(scope, async () => {
                    await importWidgetChanges();
                    const next = update(countersRef.current);
                    await Promise.all([replaceCounters(next), enqueue?.()]);
                });
            } finally {
                pendingWrites.current -= 1;
                if (scope.userId && scope === getSessionScope()) requestRefresh();
            }
        },
        [importWidgetChanges, replaceCounters, requestRefresh, scope],
    );

    useEffect(() => {
        SyncManager.init(setSyncStatus, requestRefresh);
        // Events invalidate a snapshot. Their payload can precede pending local writes.
        const unsubscribe = subscribeToCounterUpdates(requestRefresh, requestRefresh);
        const appState = AppState.addEventListener('change', (state) => {
            if (state === 'active') requestRefresh();
        });

        return () => {
            unsubscribe();
            appState.remove();
            disconnectSocket();
            SyncManager.dispose();
        };
    }, [requestRefresh]);

    useEffect(() => {
        if (syncStatus === 'syncing') return;
        let active = true;
        void SyncQueue.get()
            .then((queue) => {
                if (active && scope === getSessionScope()) {
                    setFailedCounterIds(
                        new Set(
                            queue
                                .filter((item) => item.queuedByUserId === scope.userId && item.rejected)
                                .map((item) => item.entityId),
                        ),
                    );
                }
            })
            .catch(() => {
                if (active) setSyncError(true);
            });
        return () => {
            active = false;
        };
    }, [scope, syncStatus, refreshKey]);

    useEffect(() => {
        if (!session.ready) return;

        const userId = session.user?.id || null;
        let active = true;

        void (async () => {
            setLoading(true);
            setSyncError(false);

            try {
                await writeSession(scope, () => importWidgetChanges());
                if (!active) return;
                const fetchRevision = revision.current;
                const order = await CounterService.getOrder(userId || 'guest');
                if (!userId) {
                    disconnectSocket();
                    await writeSession(scope, async () => {
                        if (!active || fetchRevision !== revision.current || pendingWrites.current > 0) return;
                        const localCounters = (await CounterService.getAllLocal()).filter(
                            (counter) => counter.userId === 'guest',
                        );
                        await replaceCounters(orderCounters(localCounters, order));
                        await importWidgetChanges(true);
                    });
                    return;
                }

                const beforeFetch = countersRef.current;
                const localCounters = await CounterService.getAllLocal();

                let remoteCounters: ClientCounter[] | null = null;
                try {
                    remoteCounters = await CounterService.fetchRemote(scope);
                } catch {
                    // Keep the local snapshot available while offline.
                }

                const pending = await SyncQueue.get();
                const reconciled = reconcileAuthenticatedCounters(
                    countersRef.current === beforeFetch ? localCounters : countersRef.current,
                    remoteCounters,
                    userId,
                    pending,
                );

                if (!active || fetchRevision !== revision.current || pendingWrites.current > 0) return;
                assertSession(scope);
                setSyncError(reconciled.syncError);
                // Refresh count/content without moving cards whenever server updatedAt ordering changes.
                const currentOrder = countersRef.current.map((counter) => counter.id);
                const next = orderCounters(reconciled.counters, currentOrder.length ? currentOrder : order);
                if (reconciled.guestCounters.length) {
                    await persistMutation(
                        () => next,
                        () => CounterService.consolidate(reconciled.guestCounters, scope),
                    );
                } else {
                    await writeSession(scope, async () => {
                        if (!active || fetchRevision !== revision.current || pendingWrites.current > 0) return;
                        await replaceCounters(next);
                    });
                }
                // A counter cache can be empty after an account switch. Import its saved widget
                // taps after fetching the counters; only a successful fetch can retire missing IDs.
                await writeSession(scope, () => importWidgetChanges(remoteCounters !== null));
                assertSession(scope);
                connectSocket();
                await SyncManager.processQueue();
            } catch (error: unknown) {
                if (error instanceof SessionChangedError) return;
                if (active) setSyncError(true);
                console.warn('Counter initialization failed');
            } finally {
                if (active) {
                    setLoading(false);
                    setRefreshing(false);
                }
            }
        })();

        return () => {
            active = false;
        };
    }, [importWidgetChanges, replaceCounters, persistMutation, session.ready, session.user?.id, refreshKey, scope]);

    async function createCounter(title: string, color: HexColor, metric = ''): Promise<ActionResult> {
        const parsedTitle = counterTitleSchema.safeParse(title);
        if (!parsedTitle.success) return fail(parsedTitle.error.issues[0].message);
        if (!counterMetricSchema.safeParse(metric).success) return fail('Metric must be 80 characters or less.');
        const counter: ClientCounter = {
            id: Crypto.randomUUID(),
            title: parsedTitle.data,
            color,
            count: 0,
            metric: metric.trim() || null,
            increment: 1,
            userId: session.user?.id || 'guest',
            type: 'PERSONAL',
            inviteCode: null,
        };

        try {
            await persistMutation(
                (current) => {
                    if (!session.isAuthenticated && isGuestCounterLimitReached(current)) {
                        throw new Error(GUEST_COUNTER_LIMIT_MESSAGE);
                    }
                    return [...current, counter];
                },
                session.isAuthenticated ? () => CounterService.create(counter, scope) : undefined,
            );
            return ok();
        } catch (error: unknown) {
            return fail(getErrorMessage(error, 'Failed to create counter'));
        }
    }

    async function reorderCounters(ids: string[]): Promise<ActionResult> {
        try {
            await persistMutation((current) => orderCounters(current, ids));
            await writeSession(scope, () =>
                CounterService.persistOrder(
                    session.user?.id || 'guest',
                    countersRef.current.map((counter) => counter.id),
                ),
            );
            return ok();
        } catch {
            return fail('Could not save the counter order. Please try again.');
        }
    }

    async function incrementCounter(counterId: string, amount: number): Promise<ActionResult> {
        const counter = countersRef.current.find((item) => item.id === counterId);
        if (!counter) return fail('Counter not found');

        if (!counterValueSchema.safeParse(amount).success) return fail('Enter a valid increment.');
        try {
            await persistMutation(
                (current) =>
                    current.map((item) => {
                        if (item.id !== counterId) return item;
                        const count = addCounterAmount(item.count, amount);
                        if (!counterValueSchema.safeParse(count).success)
                            throw new Error('This change exceeds the counter limit.');
                        return { ...item, count };
                    }),
                session.isAuthenticated ? () => CounterService.increment(counter, amount, scope) : undefined,
            );
            return ok();
        } catch (error: unknown) {
            return fail(getErrorMessage(error, 'Failed to update counter'));
        }
    }

    async function updateCounter(counterId: string, updates: UpdateCounterRequest): Promise<ActionResult> {
        const existing = countersRef.current.find((counter) => counter.id === counterId);
        if (!existing) return fail('Counter not found');

        const title = updates.title?.trim();
        if (title !== undefined) {
            const parsedTitle = counterTitleSchema.safeParse(title);
            if (!parsedTitle.success) return fail(parsedTitle.error.issues[0].message);
        }
        if (updates.increment !== undefined && !counterIncrementSchema.safeParse(updates.increment).success) {
            return fail('Enter a positive increment with up to 6 decimal places.');
        }
        if (updates.metric !== undefined && !counterMetricSchema.safeParse(updates.metric).success) {
            return fail('Metric must be 80 characters or less.');
        }
        const cleanUpdates = {
            ...updates,
            ...(title ? { title } : {}),
            ...(updates.metric !== undefined ? { metric: updates.metric?.trim() || null } : {}),
        };

        try {
            await persistMutation(
                (current) =>
                    current.map((counter) => (counter.id === counterId ? { ...counter, ...cleanUpdates } : counter)),
                session.isAuthenticated ? () => CounterService.update(counterId, cleanUpdates, scope) : undefined,
            );
            return ok();
        } catch (error: unknown) {
            return fail(getErrorMessage(error, 'Failed to update counter'));
        }
    }

    async function deleteCounter(counter: ClientCounter): Promise<ActionResult> {
        try {
            await persistMutation(
                (current) => current.filter((item) => item.id !== counter.id),
                session.isAuthenticated ? () => CounterService.delete(counter, scope) : undefined,
            );
            return ok();
        } catch (error: unknown) {
            return fail(getErrorMessage(error, 'Failed to delete counter'));
        }
    }

    async function shareCounter(counterId: string) {
        try {
            const response = await CounterService.share(counterId, scope);
            const inviteCode = response.data?.counter?.inviteCode;
            if (!response.success || !inviteCode) {
                return { success: false as const, message: REQUEST_FAILED_MESSAGE };
            }
            await persistMutation((current) =>
                current.map((counter) =>
                    counter.id === counterId ? { ...counter, type: 'SHARED', inviteCode } : counter,
                ),
            );
            return { success: true as const, inviteCode };
        } catch (error: unknown) {
            return {
                success: false as const,
                message: error instanceof ApiError ? error.message : REQUEST_FAILED_MESSAGE,
            };
        }
    }

    async function joinCounter(code: string): Promise<ActionResult> {
        setLoading(true);

        try {
            if (countersRef.current.length === 0) {
                const localCounters = await CounterService.getAllLocal();
                assertSession(scope);
                countersRef.current = localCounters;
                setCounters(localCounters);
            }

            const response = await CounterService.join(code, scope);
            const counter = response.data?.counter;
            if (!response.success || !counter) return fail(response.message || 'Failed to join counter');
            if (!countersRef.current.some((item) => item.id === counter.id)) {
                await persistMutation((current) => [...current, counter]);
            }
            return ok();
        } catch (error: unknown) {
            return fail(getErrorMessage(error, 'Network error'));
        } finally {
            setLoading(false);
        }
    }

    return (
        <CounterContext.Provider
            value={{
                counters,
                loading: loading || syncStatus === 'syncing',
                refreshing,
                syncError: syncError || syncStatus === 'error',
                failedCounterIds,
                eligibleCount: counters.filter(isGuestEligible).length,
                refreshCounters,
                createCounter,
                shareCounter,
                incrementCounter,
                updateCounter,
                deleteCounter,
                joinCounter,
                reorderCounters,
            }}
        >
            {children}
        </CounterContext.Provider>
    );
}

export function useCounters() {
    const counters = useContext(CounterContext);
    if (!counters) throw new Error('useCounters must be used inside CounterProvider');
    return counters;
}
