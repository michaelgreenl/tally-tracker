import { NOT_FOUND } from '@tally/core/client';
import * as Network from 'expo-network';

import apiFetch, { ApiError } from '../api';
import { AuthService } from './auth.service';
import { SyncQueue } from './sync-queue';
import { pendingWidgetTaps } from './widget-sync';
import { assertSession, getSessionScope, SessionChangedError } from './session-scope';
import type { SessionScope } from './session-scope';

import type { MutationCommand } from './sync-queue';
import type {
    CounterResponse,
    CreateCounterRequest,
    IncrementCounterRequest,
    UpdateCounterRequest,
} from '@tally/core/client';

let networkSubscription: ReturnType<typeof Network.addNetworkStateListener> | null = null;
let activeSync: Promise<void> | null = null;
let activeScope: SessionScope | null = null;
export type SyncStatus = 'idle' | 'syncing' | 'error';
let onStatusChange: ((status: SyncStatus) => void) | null = null;
let onAcknowledged: (() => void) | undefined;

export const SyncManager = {
    syncRequested: false,

    init(listener: (status: SyncStatus) => void, acknowledged?: () => void) {
        onStatusChange = listener;
        onAcknowledged = acknowledged;
        listener(activeSync && activeScope === getSessionScope() ? 'syncing' : 'idle');
        if (networkSubscription) return;
        networkSubscription = Network.addNetworkStateListener((status) => {
            if (status.isConnected) void this.processQueue();
        });
    },

    dispose() {
        networkSubscription?.remove();
        networkSubscription = null;
        onStatusChange = null;
        onAcknowledged = undefined;
    },

    processQueue(): Promise<void> {
        const scope = getSessionScope();
        if (activeSync) {
            if (activeScope !== scope)
                return activeSync.then(() => {
                    if (scope === getSessionScope()) return this.processQueue();
                });
            this.syncRequested = true;
            return activeSync;
        }

        activeScope = scope;
        activeSync = (async () => {
            try {
                let drained: boolean;
                const attempted = new Set<string>();
                do {
                    this.syncRequested = false;
                    drained = await this.processQueuePass(attempted);
                    assertSession(scope);
                } while (this.syncRequested);
                onStatusChange?.(drained ? 'idle' : 'error');
            } catch (error: unknown) {
                if (error instanceof SessionChangedError) return;
                onStatusChange?.('error');
                console.warn('Counter sync failed');
            } finally {
                activeSync = null;
                this.syncRequested = false;
            }
        })();
        return activeSync;
    },

    async processQueuePass(attempted = new Set<string>()): Promise<boolean> {
        const scope = getSessionScope();
        const queue = await SyncQueue.get();
        if (queue.length === 0) return true;

        const userId = (await AuthService.getCachedUser())?.id;
        assertSession(scope);
        if (!userId || scope.userId !== userId) return false;

        const commands = queue.filter((item) => item.queuedByUserId === userId);
        if (commands.length === 0) return true;

        onStatusChange?.('syncing');
        const status = await Network.getNetworkStateAsync();
        if (status.isConnected === false) return false;

        const blocked = new Map<string, number>();
        const importing = new Set(pendingWidgetTaps().map((tap) => tap.id));
        for (const queued of commands) {
            // The native journal owns retry identity until its durable handoff finishes.
            if (importing.has(queued.id)) {
                blocked.set(queued.entityId, 0);
                continue;
            }
            const removal = queued.type === 'DELETE' || queued.type === 'REMOVE';
            if (attempted.has(queued.id)) blocked.set(queued.entityId, queued.rejected ?? 0);
            if (
                attempted.has(queued.id) ||
                (blocked.has(queued.entityId) && (!removal || blocked.get(queued.entityId) === 409))
            )
                continue;
            const command = await SyncQueue.prepare(queued.id);
            if (!command) continue;
            attempted.add(command.id);
            try {
                assertSession(scope);
                await this.executeCommand(command, scope);
                assertSession(scope);
                if (removal) await SyncQueue.removeCounter(userId, command.entityId);
                else await SyncQueue.remove(command.id);
                assertSession(scope);
                onAcknowledged?.();
            } catch (error: unknown) {
                assertSession(scope);
                const statusCode = error instanceof ApiError ? error.status || 0 : 0;

                // An already-removed counter completes a removal, not a failed write.
                if (statusCode === NOT_FOUND && removal) {
                    await SyncQueue.removeCounter(userId, command.entityId);
                    assertSession(scope);
                    onAcknowledged?.();
                    continue;
                }

                if ([400, 403, 404, 409, 422].includes(statusCode)) {
                    if (await SyncQueue.reject(command.id, statusCode)) this.syncRequested = true;
                    blocked.set(command.entityId, statusCode);
                    continue;
                }

                // Network, authentication, and rate-limit failures stop the pass without changing keys.
                this.syncRequested = false;
                return false;
            }
        }

        return !(await SyncQueue.get()).some((command) => command.queuedByUserId === userId);
    },

    async executeCommand(command: MutationCommand, sessionScope = getSessionScope()) {
        assertSession(sessionScope);
        if (sessionScope.userId !== command.queuedByUserId) throw new SessionChangedError();
        const headers = { 'X-Idempotency-Key': command.id, 'X-Account-Id': command.queuedByUserId };
        const options = { headers, sessionScope };

        switch (command.type) {
            case 'CREATE':
                return apiFetch<CounterResponse, CreateCounterRequest>('/counters', {
                    method: 'POST',
                    body: command.payload as CreateCounterRequest,
                    ...options,
                });
            case 'UPDATE':
                return apiFetch<CounterResponse, UpdateCounterRequest>(`/counters/update/${command.entityId}`, {
                    method: 'PUT',
                    body: command.payload as UpdateCounterRequest,
                    ...options,
                });
            case 'INCREMENT':
                return apiFetch<CounterResponse, IncrementCounterRequest>(`/counters/increment/${command.entityId}`, {
                    method: 'PUT',
                    body: command.payload as IncrementCounterRequest,
                    ...options,
                });
            case 'DELETE':
                return apiFetch(`/counters/${command.entityId}`, { method: 'DELETE', ...options });
            case 'REMOVE':
                return apiFetch(`/counters/remove-shared/${command.entityId}`, { method: 'PUT', ...options });
        }
    },
};
