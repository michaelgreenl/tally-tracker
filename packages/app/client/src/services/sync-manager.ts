import { UNAUTHORIZED } from '@tally/core/client';
import * as Network from 'expo-network';

import apiFetch, { ApiError } from '../api';
import { AuthService } from './auth.service';
import { SyncQueue } from './sync-queue';

import type { MutationCommand } from './sync-queue';
import type {
    CounterResponse,
    CreateCounterRequest,
    IncrementCounterRequest,
    SetCounterCountRequest,
    UpdateCounterRequest,
} from '@tally/core/client';

let networkSubscription: ReturnType<typeof Network.addNetworkStateListener> | null = null;

export const SyncManager = {
    isSyncing: false,
    syncRequested: false,

    init() {
        if (networkSubscription) return;
        networkSubscription = Network.addNetworkStateListener((status) => {
            if (status.isConnected) void this.processQueue();
        });
    },

    dispose() {
        networkSubscription?.remove();
        networkSubscription = null;
    },

    async processQueue() {
        if (this.isSyncing) {
            this.syncRequested = true;
            return;
        }

        this.isSyncing = true;

        try {
            let drained = true;
            do {
                this.syncRequested = false;
                drained = await this.processQueuePass();
            } while (drained && this.syncRequested);
        } finally {
            this.isSyncing = false;
            this.syncRequested = false;
        }
    },

    async processQueuePass(): Promise<boolean> {
        const status = await Network.getNetworkStateAsync();
        if (status.isConnected === false) return false;

        const queue = await SyncQueue.get();
        if (queue.length === 0) return true;

        const userId = (await AuthService.getCachedUser())?.id;
        if (!userId) return false;

        for (const command of queue.filter((item) => item.queuedByUserId === userId)) {
            try {
                await this.executeCommand(command);
                await SyncQueue.remove(command.id);
            } catch (error: unknown) {
                const statusCode = error instanceof ApiError ? error.status || 0 : 0;

                if (statusCode === UNAUTHORIZED) return false;
                if (statusCode >= 400 && statusCode < 500) {
                    await SyncQueue.remove(command.id);
                    continue;
                }

                return false;
            }
        }

        return true;
    },

    async executeCommand(command: MutationCommand) {
        const headers = { 'X-Idempotency-Key': command.id };

        switch (command.type) {
            case 'CREATE':
                return apiFetch<CounterResponse, CreateCounterRequest>('/counters', {
                    method: 'POST',
                    body: command.payload as CreateCounterRequest,
                    headers,
                });
            case 'UPDATE':
                return apiFetch<CounterResponse, UpdateCounterRequest>(`/counters/update/${command.entityId}`, {
                    method: 'PUT',
                    body: command.payload as UpdateCounterRequest,
                    headers,
                });
            case 'SET_COUNT':
                return apiFetch<CounterResponse, SetCounterCountRequest>(`/counters/${command.entityId}/count`, {
                    method: 'PUT',
                    body: command.payload as SetCounterCountRequest,
                    headers,
                });
            case 'INCREMENT':
                return apiFetch<CounterResponse, IncrementCounterRequest>(`/counters/increment/${command.entityId}`, {
                    method: 'PUT',
                    body: command.payload as IncrementCounterRequest,
                    headers,
                });
            case 'DELETE':
                return apiFetch(`/counters/${command.entityId}`, { method: 'DELETE', headers });
            case 'REMOVE':
                return apiFetch(`/counters/remove-shared/${command.entityId}`, { method: 'PUT', headers });
        }
    },
};
