import { addCounterAmount } from '@tally/core/client';
import type { ClientCounter, CreateCounterRequest, IncrementCounterRequest } from '@tally/core/client';
import type { MutationCommand } from '../services/sync-queue';

export const GUEST_COUNTER_CAP = 3;
export const GUEST_COUNTER_LIMIT_MESSAGE = 'Counter limit reached';

export const isGuestEligible = (counter: ClientCounter) => counter.type !== 'SHARED';

export const isGuestCounterLimitReached = (counters: readonly ClientCounter[]) =>
    counters.filter(isGuestEligible).length >= GUEST_COUNTER_CAP;

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
