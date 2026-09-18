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

import { ApiError, getErrorMessage, REQUEST_FAILED_MESSAGE } from './api';
import { CounterService } from './services/counter.service';
import { SyncManager } from './services/sync-manager';
import { SyncQueue } from './services/sync-queue';
import { assertSession, getSessionScope, SessionChangedError, writeSession } from './services/session-scope';
import { connectSocket, disconnectSocket, subscribeToCounterUpdates } from './socket';
import { useSession } from './session';

import type {
    ClientCounter,
    CreateCounterRequest,
    HexColor,
    IncrementCounterRequest,
    UpdateCounterRequest,
} from '@tally/core/client';
import type { PropsWithChildren } from 'react';
import type { SyncStatus } from './services/sync-manager';
import type { MutationCommand } from './services/sync-queue';

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

export const GUEST_COUNTER_CAP = 3;
export const GUEST_COUNTER_LIMIT_MESSAGE = 'Counter limit reached';
export const BASIC_JOIN_LIMIT_MESSAGE = 'Basic accounts can only join one shared counter.';

const CounterContext = createContext<CounterContextValue | null>(null);
const ok = (): ActionResult => ({ success: true });
const fail = (message: string): ActionResult => ({ success: false, message });
const isGuestEligible = (counter: ClientCounter) => counter.type !== 'SHARED';

export const isGuestCounterLimitReached = (counters: readonly ClientCounter[]) =>
    counters.filter(isGuestEligible).length >= GUEST_COUNTER_CAP;

export const hasJoinedSharedCounter = (counters: readonly ClientCounter[], userId: string) =>
    counters.some((counter) => counter.type === 'SHARED' && counter.userId !== userId);

export function orderCounters(counters: readonly ClientCounter[], ids: readonly string[]) {
    const positions = new Map(ids.map((id, index) => [id, index]));
    return [...counters].sort((a, b) => (positions.get(a.id) ?? ids.length) - (positions.get(b.id) ?? ids.length));
}

export const reconcileAuthenticatedCounters = (
    localCounters: readonly ClientCounter[],
    remoteCounters: readonly ClientCounter[] | null,
    userId: string,
    pending: readonly MutationCommand[] = [],
) => {
    const availableRemoteCounters = remoteCounters ?? [];
    const eligibleLocal = localCounters.filter(
        (counter) =>
            counter.userId === 'guest' ||
            counter.userId === userId ||
            counter.shares?.some((share) => share.userId === userId && share.status === 'ACCEPTED'),
    );
    const migratedLocal = eligibleLocal.map((counter) =>
        counter.userId === 'guest' ? { ...counter, userId } : counter,
    );
    const guestCounters = eligibleLocal
        .filter((counter) => counter.userId === 'guest')
        .map((counter) => ({ ...counter, userId }));
    const remoteIds = new Set(availableRemoteCounters.map((counter) => counter.id));
    const commands = pending.filter((item) => item.queuedByUserId === userId);
    const pendingIds = new Set(commands.map((item) => item.entityId));
    const removedIds = new Set(
        commands.filter((item) => item.type === 'DELETE' || item.type === 'REMOVE').map((item) => item.entityId),
    );
    const localById = new Map(migratedLocal.map((counter) => [counter.id, counter]));
    const recovered = new Map<string, ClientCounter>();
    // Logout can clear the display cache. The queue remains the source of unsent creations.
    for (const command of commands) {
        if (localById.has(command.entityId) || removedIds.has(command.entityId)) continue;
        if (command.type === 'CREATE') {
            const payload = command.payload as CreateCounterRequest;
            recovered.set(command.entityId, {
                ...payload,
                id: command.entityId,
                userId,
                type: 'PERSONAL',
                inviteCode: null,
                color: payload.color ?? null,
                count: payload.count ?? 0,
                metric: payload.metric ?? null,
                increment: payload.increment ?? 1,
            });
        }
        const counter = recovered.get(command.entityId);
        if (!counter) continue;
        if (command.type === 'UPDATE') Object.assign(counter, command.payload);
        if (command.type === 'INCREMENT')
            counter.count = addCounterAmount(counter.count, (command.payload as IncrementCounterRequest).amount);
    }
    for (const counter of recovered.values()) localById.set(counter.id, counter);

    return {
        counters: [
            ...availableRemoteCounters
                .filter((counter) => !removedIds.has(counter.id))
                .map((counter) => (pendingIds.has(counter.id) ? (localById.get(counter.id) ?? counter) : counter)),
            ...[...localById.values()].filter(
                (counter) =>
                    !removedIds.has(counter.id) &&
                    !remoteIds.has(counter.id) &&
                    (remoteCounters === null ||
                        pendingIds.has(counter.id) ||
                        guestCounters.some((guest) => guest.id === counter.id)),
            ),
        ],
        guestCounters,
        syncError: remoteCounters === null,
    };
};

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

    const replaceCounters = useCallback(
        async (next: ClientCounter[]) => {
            assertSession(scope);
            countersRef.current = next;
            setCounters(next);
            await writeSession(scope, () => CounterService.persist(next));
        },
        [scope],
    );

    const persistMutation = useCallback(
        async (next: ClientCounter[], enqueue?: () => Promise<void>) => {
            revision.current += 1;
            pendingWrites.current += 1;
            try {
                await Promise.all([replaceCounters(next), enqueue?.()]);
            } finally {
                pendingWrites.current -= 1;
                if (scope.userId && scope === getSessionScope()) requestRefresh();
            }
        },
        [replaceCounters, requestRefresh, scope],
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
        const fetchRevision = revision.current;
        let active = true;

        void (async () => {
            setLoading(true);
            setSyncError(false);

            try {
                const order = await CounterService.getOrder(userId || 'guest');
                if (!userId) {
                    disconnectSocket();
                    const localCounters = (await CounterService.getAllLocal()).filter(
                        (counter) => counter.userId === 'guest',
                    );
                    if (active) await replaceCounters(orderCounters(localCounters, order));
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
                    await persistMutation(next, () => CounterService.consolidate(reconciled.guestCounters, scope));
                } else {
                    await replaceCounters(next);
                }
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
    }, [replaceCounters, persistMutation, session.ready, session.user?.id, refreshKey, scope]);

    async function createCounter(title: string, color: HexColor, metric = ''): Promise<ActionResult> {
        const parsedTitle = counterTitleSchema.safeParse(title);
        if (!parsedTitle.success) return fail(parsedTitle.error.issues[0].message);
        if (!counterMetricSchema.safeParse(metric).success) return fail('Metric must be 80 characters or less.');
        if (!session.isAuthenticated && isGuestCounterLimitReached(countersRef.current)) {
            return fail(GUEST_COUNTER_LIMIT_MESSAGE);
        }

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
                [...countersRef.current, counter],
                session.isAuthenticated ? () => CounterService.create(counter, scope) : undefined,
            );
            return ok();
        } catch (error: unknown) {
            return fail(getErrorMessage(error, 'Failed to create counter'));
        }
    }

    async function reorderCounters(ids: string[]): Promise<ActionResult> {
        const next = orderCounters(countersRef.current, ids);
        try {
            await replaceCounters(next);
            await CounterService.persistOrder(
                session.user?.id || 'guest',
                next.map((counter) => counter.id),
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
        const count = addCounterAmount(counter.count, amount);
        if (!counterValueSchema.safeParse(count).success) return fail('This change exceeds the counter limit.');
        const updated = { ...counter, count };
        try {
            await persistMutation(
                countersRef.current.map((item) => (item.id === counterId ? updated : item)),
                session.isAuthenticated ? () => CounterService.increment(updated, amount, scope) : undefined,
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
                countersRef.current.map((counter) =>
                    counter.id === counterId ? { ...counter, ...cleanUpdates } : counter,
                ),
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
                countersRef.current.filter((item) => item.id !== counter.id),
                session.isAuthenticated ? () => CounterService.delete(counter, scope) : undefined,
            );
            return ok();
        } catch (error: unknown) {
            return fail(getErrorMessage(error, 'Failed to delete counter'));
        }
    }

    async function shareCounter(counterId: string) {
        if (!session.isPremium) return { success: false as const, message: 'Sharing requires premium access.' };
        try {
            const response = await CounterService.share(counterId, scope);
            const inviteCode = response.data?.counter?.inviteCode;
            if (!response.success || !inviteCode) {
                return { success: false as const, message: REQUEST_FAILED_MESSAGE };
            }
            await persistMutation(
                countersRef.current.map((counter) =>
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

            const userId = session.user?.id;
            if (session.user?.tier === 'BASIC' && userId && hasJoinedSharedCounter(countersRef.current, userId)) {
                return fail(BASIC_JOIN_LIMIT_MESSAGE);
            }

            const response = await CounterService.join(code, scope);
            const counter = response.data?.counter;
            if (!response.success || !counter) return fail(response.message || 'Failed to join counter');
            if (!countersRef.current.some((item) => item.id === counter.id)) {
                await persistMutation([...countersRef.current, counter]);
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
