import { NOT_FOUND } from '@tally/core/client';
import * as Network from 'expo-network';

import apiFetch, { ApiError } from '../api';
import { AuthService } from './auth.service';
import { SyncQueue } from './sync-queue';
import { assertSession, getSessionScope, SessionChangedError } from './session-scope';
import type { SessionScope } from './session-scope';

import type { MutationCommand } from './sync-queue';
import type {
    CounterResponse,
    CreateCounterRequest,
    IncrementCounterRequest,
    SetCounterCountRequest,
    UpdateCounterRequest,
} from '@tally/core/client';

let networkSubscription: ReturnType<typeof Network.addNetworkStateListener> | null = null;
let activeSync: Promise<void> | null = null;
let activeScope: SessionScope | null = null;
export type SyncStatus = 'idle' | 'syncing' | 'error';
let onStatusChange: ((status: SyncStatus) => void) | null = null;

export const SyncManager = {
    syncRequested: false,

    init(listener: (status: SyncStatus) => void) {
        onStatusChange = listener;
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
                do {
                    this.syncRequested = false;
                    drained = await this.processQueuePass();
                    assertSession(scope);
                } while (drained && this.syncRequested);
                onStatusChange?.(drained ? 'idle' : 'error');
            } catch (error: unknown) {
                if (error instanceof SessionChangedError) return;
                onStatusChange?.('error');
                console.warn('Counter sync failed', error);
            } finally {
                activeSync = null;
                this.syncRequested = false;
            }
        })();
        return activeSync;
    },

    async processQueuePass(): Promise<boolean> {
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

        for (const command of commands) {
            try {
                assertSession(scope);
                await this.executeCommand(command, scope);
                assertSession(scope);
                await SyncQueue.remove(command.id);
            } catch (error: unknown) {
                assertSession(scope);
                const statusCode = error instanceof ApiError ? error.status || 0 : 0;

                // An already-removed counter completes a removal, not a failed write.
                if (statusCode === NOT_FOUND && (command.type === 'DELETE' || command.type === 'REMOVE')) {
                    await SyncQueue.remove(command.id);
                    continue;
                }

                // Keep rejected writes until a later retry succeeds. Never report them as synced.
                return false;
            }
        }

        return true;
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
            case 'SET_COUNT':
                return apiFetch<CounterResponse, SetCounterCountRequest>(`/counters/${command.entityId}/count`, {
                    method: 'PUT',
                    body: command.payload as SetCounterCountRequest,
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
