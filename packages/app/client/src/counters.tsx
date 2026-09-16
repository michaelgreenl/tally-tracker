import * as Crypto from 'expo-crypto';
import { addCounterAmount, counterValueSchema, counterIncrementSchema, counterMetricSchema } from '@tally/core/client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { ApiError, getErrorMessage, REQUEST_FAILED_MESSAGE } from './api';
import { CounterService } from './services/counter.service';
import { SyncManager } from './services/sync-manager';
import { SyncQueue } from './services/sync-queue';
import { connectSocket, disconnectSocket, subscribeToCounterUpdates } from './socket';
import { useSession } from './session';

import type { ClientCounter, HexColor, UpdateCounterRequest } from '@tally/core/client';
import type { PropsWithChildren } from 'react';
import type { SyncStatus } from './services/sync-manager';
import type { MutationCommand } from './services/sync-queue';

type ActionResult = { success: true } | { success: false; message: string };

type CounterContextValue = {
    counters: ClientCounter[];
    loading: boolean;
    syncError: boolean;
    eligibleCount: number;
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
    const pendingIds = new Set(pending.filter((item) => item.queuedByUserId === userId).map((item) => item.entityId));
    const localById = new Map(migratedLocal.map((counter) => [counter.id, counter]));

    return {
        counters: [
            ...availableRemoteCounters.flatMap((counter) =>
                pendingIds.has(counter.id) ? localById.get(counter.id) || [] : counter,
            ),
            ...migratedLocal.filter((counter) => !remoteIds.has(counter.id)),
        ],
        guestCounters,
        syncError: remoteCounters === null,
    };
};

export function CounterProvider({ children }: PropsWithChildren) {
    const session = useSession();
    const [counters, setCounters] = useState<ClientCounter[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncError, setSyncError] = useState(false);
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
    const [refreshKey, setRefreshKey] = useState(0);
    const countersRef = useRef<ClientCounter[]>([]);
    const previousUserId = useRef<string | null>(null);

    const replaceCounters = useCallback(async (next: ClientCounter[]) => {
        countersRef.current = next;
        setCounters(next);
        await CounterService.persist(next);
    }, []);

    const applyRemoteUpdate = useCallback(
        async (updatedCounter: ClientCounter) => {
            const index = countersRef.current.findIndex((counter) => counter.id === updatedCounter.id);

            const next = [...countersRef.current];
            if (index === -1) next.push(updatedCounter);
            else next[index] = { ...next[index], ...updatedCounter };
            await replaceCounters(next);
        },
        [replaceCounters],
    );

    useEffect(() => {
        SyncManager.init(setSyncStatus);
        const refresh = () => setRefreshKey((key) => key + 1);
        const unsubscribe = subscribeToCounterUpdates((counter) => void applyRemoteUpdate(counter), refresh);
        const appState = AppState.addEventListener('change', (state) => {
            if (state === 'active') refresh();
        });

        return () => {
            unsubscribe();
            appState.remove();
            disconnectSocket();
            SyncManager.dispose();
        };
    }, [applyRemoteUpdate]);

    useEffect(() => {
        if (!session.ready) return;

        const userId = session.user?.id || null;
        const priorUserId = previousUserId.current;
        previousUserId.current = userId;
        let active = true;

        void (async () => {
            setLoading(true);
            setSyncError(false);

            try {
                const order = await CounterService.getOrder(userId || 'guest');
                if (!userId) {
                    disconnectSocket();
                    if (priorUserId) await CounterService.clearLocal();

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
                    remoteCounters = await CounterService.fetchRemote();
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

                if (!active) return;
                setSyncError(reconciled.syncError);
                await replaceCounters(orderCounters(reconciled.counters, order));
                if (reconciled.guestCounters.length) await CounterService.consolidate(reconciled.guestCounters);
                connectSocket();
                await SyncManager.processQueue();
            } catch (error: unknown) {
                if (active) setSyncError(true);
                console.warn('Counter initialization failed', error);
            } finally {
                if (active) setLoading(false);
            }
        })();

        return () => {
            active = false;
        };
    }, [replaceCounters, session.ready, session.user?.id, refreshKey]);

    async function createCounter(title: string, color: HexColor, metric = ''): Promise<ActionResult> {
        const cleanTitle = title.trim();
        if (!cleanTitle) return fail('Counter title is required');
        if (!counterMetricSchema.safeParse(metric).success) return fail('Metric must be 80 characters or less.');
        if (!session.isAuthenticated && isGuestCounterLimitReached(countersRef.current)) {
            return fail(GUEST_COUNTER_LIMIT_MESSAGE);
        }

        const counter: ClientCounter = {
            id: Crypto.randomUUID(),
            title: cleanTitle,
            color,
            count: 0,
            metric: metric.trim() || null,
            increment: 1,
            userId: session.user?.id || 'guest',
            type: 'PERSONAL',
            inviteCode: null,
        };

        try {
            await replaceCounters([...countersRef.current, counter]);
            if (session.isAuthenticated) await CounterService.create(counter);
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
            await replaceCounters(countersRef.current.map((item) => (item.id === counterId ? updated : item)));
            if (session.isAuthenticated) await CounterService.increment(updated, amount);
            return ok();
        } catch (error: unknown) {
            return fail(getErrorMessage(error, 'Failed to update counter'));
        }
    }

    async function updateCounter(counterId: string, updates: UpdateCounterRequest): Promise<ActionResult> {
        const existing = countersRef.current.find((counter) => counter.id === counterId);
        if (!existing) return fail('Counter not found');

        const title = updates.title?.trim();
        if (updates.title !== undefined && !title) return fail('Counter title is required');
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
            await replaceCounters(
                countersRef.current.map((counter) =>
                    counter.id === counterId ? { ...counter, ...cleanUpdates } : counter,
                ),
            );
            if (session.isAuthenticated) await CounterService.update(counterId, cleanUpdates);
            return ok();
        } catch (error: unknown) {
            return fail(getErrorMessage(error, 'Failed to update counter'));
        }
    }

    async function deleteCounter(counter: ClientCounter): Promise<ActionResult> {
        try {
            await replaceCounters(countersRef.current.filter((item) => item.id !== counter.id));
            if (session.isAuthenticated) await CounterService.delete(counter);
            return ok();
        } catch (error: unknown) {
            return fail(getErrorMessage(error, 'Failed to delete counter'));
        }
    }

    async function shareCounter(counterId: string) {
        if (!session.isPremium) return { success: false as const, message: 'Sharing requires premium access.' };
        try {
            const response = await CounterService.share(counterId);
            const inviteCode = response.data?.counter?.inviteCode;
            if (!response.success || !inviteCode) {
                return { success: false as const, message: REQUEST_FAILED_MESSAGE };
            }
            await replaceCounters(
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
                countersRef.current = localCounters;
                setCounters(localCounters);
            }

            const userId = session.user?.id;
            if (session.user?.tier === 'BASIC' && userId && hasJoinedSharedCounter(countersRef.current, userId)) {
                return fail(BASIC_JOIN_LIMIT_MESSAGE);
            }

            const response = await CounterService.join(code);
            const counter = response.data?.counter;
            if (!response.success || !counter) return fail(response.message || 'Failed to join counter');
            if (!countersRef.current.some((item) => item.id === counter.id)) {
                await replaceCounters([...countersRef.current, counter]);
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
                syncError: syncError || syncStatus === 'error',
                eligibleCount: counters.filter(isGuestEligible).length,
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
