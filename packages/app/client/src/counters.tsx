import * as Crypto from 'expo-crypto';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { getErrorMessage } from './api';
import { CounterService } from './services/counter.service';
import { SyncManager } from './services/sync-manager';
import { connectSocket, disconnectSocket, subscribeToCounterUpdates } from './socket';
import { useSession } from './session';

import type { ClientCounter, CounterTypeType as CounterType, HexColor, UpdateCounterRequest } from '@tally/core/client';
import type { PropsWithChildren } from 'react';

type ActionResult = { success: true } | { success: false; message: string };

type CounterContextValue = {
    counters: ClientCounter[];
    loading: boolean;
    syncError: boolean;
    eligibleCount: number;
    createCounter: (title: string, color: HexColor, type: CounterType) => Promise<ActionResult>;
    incrementCounter: (counterId: string, amount: number) => Promise<ActionResult>;
    updateCounter: (counterId: string, updates: UpdateCounterRequest) => Promise<ActionResult>;
    deleteCounter: (counter: ClientCounter) => Promise<ActionResult>;
    joinCounter: (inviteCode: string) => Promise<ActionResult>;
};

export const GUEST_COUNTER_CAP = 3;
export const GUEST_COUNTER_LIMIT_MESSAGE = 'Guest counter limit reached';
export const BASIC_JOIN_LIMIT_MESSAGE = 'Basic accounts can only join one shared counter.';

const CounterContext = createContext<CounterContextValue | null>(null);
const ok = (): ActionResult => ({ success: true });
const fail = (message: string): ActionResult => ({ success: false, message });
const isGuestEligible = (counter: ClientCounter) => counter.type !== 'SHARED';

export const isGuestCounterLimitReached = (counters: readonly ClientCounter[]) =>
    counters.filter(isGuestEligible).length >= GUEST_COUNTER_CAP;

export const hasJoinedSharedCounter = (counters: readonly ClientCounter[], userId: string) =>
    counters.some((counter) => counter.type === 'SHARED' && counter.userId !== userId);

export const reconcileAuthenticatedCounters = (
    localCounters: readonly ClientCounter[],
    remoteCounters: readonly ClientCounter[] | null,
    userId: string,
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

    return {
        counters: [...availableRemoteCounters, ...migratedLocal.filter((counter) => !remoteIds.has(counter.id))],
        guestCounters,
        syncError: remoteCounters === null,
    };
};

const inviteCode = () => {
    const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from(Crypto.getRandomBytes(8), (byte) => alphabet[byte % alphabet.length]).join('');
};

export function CounterProvider({ children }: PropsWithChildren) {
    const session = useSession();
    const [counters, setCounters] = useState<ClientCounter[]>([]);
    const [loading, setLoading] = useState(false);
    const [syncError, setSyncError] = useState(false);
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
            if (index === -1) return;

            const next = [...countersRef.current];
            next[index] = { ...next[index], ...updatedCounter };
            await replaceCounters(next);
        },
        [replaceCounters],
    );

    useEffect(() => {
        SyncManager.init();
        const unsubscribe = subscribeToCounterUpdates((counter) => void applyRemoteUpdate(counter));

        return () => {
            unsubscribe();
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
                if (!userId) {
                    disconnectSocket();
                    if (priorUserId) await CounterService.clearLocal();

                    const localCounters = (await CounterService.getAllLocal()).filter(
                        (counter) => counter.userId === 'guest',
                    );
                    if (active) await replaceCounters(localCounters);
                    return;
                }

                const localCounters = await CounterService.getAllLocal();

                let remoteCounters: ClientCounter[] | null = null;
                try {
                    remoteCounters = (await CounterService.fetchRemote()) || [];
                } catch {
                    // Keep the local snapshot available while offline.
                }

                const reconciled = reconcileAuthenticatedCounters(localCounters, remoteCounters, userId);

                if (!active) return;
                setSyncError(reconciled.syncError);
                await replaceCounters(reconciled.counters);
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
    }, [replaceCounters, session.ready, session.user?.id]);

    async function createCounter(title: string, color: HexColor, type: CounterType): Promise<ActionResult> {
        const cleanTitle = title.trim();
        if (!cleanTitle) return fail('Counter title is required');
        if (!session.isAuthenticated && isGuestCounterLimitReached(countersRef.current)) {
            return fail(GUEST_COUNTER_LIMIT_MESSAGE);
        }
        if (type === 'SHARED' && !session.isPremium) return fail('Sharing requires premium access');

        const counter: ClientCounter = {
            id: Crypto.randomUUID(),
            title: cleanTitle,
            color,
            count: 0,
            userId: session.user?.id || 'guest',
            type,
            inviteCode: type === 'SHARED' ? inviteCode() : null,
        };

        try {
            await replaceCounters([...countersRef.current, counter]);
            if (session.isAuthenticated) await CounterService.create(counter);
            return ok();
        } catch (error: unknown) {
            return fail(getErrorMessage(error, 'Failed to create counter'));
        }
    }

    async function incrementCounter(counterId: string, amount: number): Promise<ActionResult> {
        const counter = countersRef.current.find((item) => item.id === counterId);
        if (!counter) return fail('Counter not found');

        const updated = { ...counter, count: counter.count + amount };
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
        const cleanUpdates = { ...updates, ...(title ? { title } : {}) };

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
                loading,
                syncError,
                eligibleCount: counters.filter(isGuestEligible).length,
                createCounter,
                incrementCounter,
                updateCounter,
                deleteCounter,
                joinCounter,
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
