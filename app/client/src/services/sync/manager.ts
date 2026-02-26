/**
 * Singleton responsible for processing the offline sync queue.
 *
 * Listens for network restoration via Capacitor and processes commands in FIFO order.
 * Each command includes its ID as an X-Idempotency-Key header, so replayed commands
 * (e.g., client didn't receive the response but server processed it) are safely deduplicated.
 *
 * Error strategy:
 * - 2xx: Success. Remove command from queue.
 * - 401: Session expired (refresh already failed in apiFetch). Stop processing,
 *         keep commands for after re-auth, trigger logout.
 * - Other 4xx: Fatal (validation/logic error). Remove to unblock the queue.
 * - 5xx / Network: Retryable. Stop processing, retry on next trigger.
 */

import { UNAUTHORIZED } from '@/constants/status-codes';
import { Network } from '@capacitor/network';
import { SyncQueueService } from '@/services/sync/queue';
import { useAuthStore } from '@/stores/authStore';
import apiFetch from '@/api';
import { ApiError } from '@/utils/errors';

import type { MutationCommand } from './types';
import type { CounterResponse } from '@packages/core';
import type { CreateCounterRequest, IncrementCounterRequest, UpdateCounterRequest } from '@packages/core';

export const SyncManager = {
    isSyncing: false,

    // Register network listener. Called once on app mount (App.vue).
    async init() {
        Network.addListener('networkStatusChange', async (status) => {
            console.log('[Network] Status changed:', status.connected);
            if (status.connected) {
                await this.processQueue();
            }
        });
    },

    async processQueue() {
        if (this.isSyncing) return;

        const status = await Network.getStatus();
        if (!status.connected) {
            console.log('[Sync] Offline. Keeping commands in queue.');
            return;
        }

        this.isSyncing = true;
        const queue = await SyncQueueService.getQueue();

        if (queue.length === 0) {
            this.isSyncing = false;
            return;
        }

        console.log(`[Sync] Processing ${queue.length} commands...`);

        for (const command of queue) {
            try {
                await this.executeCommand(command);
                await SyncQueueService.removeCommand(command.id);
            } catch (error: any) {
                console.error(`[Sync] Command ${command.id} Failed:`, error);

                let status = 0;
                if (error instanceof ApiError) {
                    status = error.status || 0;
                }

                // 401 = refresh already failed in apiFetch. Session is dead.
                // Keep commands for after re-auth.
                if (status === UNAUTHORIZED) {
                    console.warn('[Sync] Session expired. Keeping commands for after re-auth.');
                    this.isSyncing = false;

                    const authStore = useAuthStore();
                    await authStore.logout(false);
                    return;
                }

                // Other 4xx = invalid command (bug). Discard to unblock queue.
                if (status >= 400 && status < 500) {
                    console.warn('[Sync] Fatal error (4xx), removing invalid command.');
                    await SyncQueueService.removeCommand(command.id);
                    continue;
                }

                // 5xx or network failure = retryable. Stop and wait for next trigger.
                this.isSyncing = false;
                return;
            }
        }

        this.isSyncing = false;
    },

    async executeCommand(cmd: MutationCommand) {
        const options = {
            headers: {
                'X-Idempotency-Key': cmd.id,
            },
        };

        switch (cmd.type) {
            case 'CREATE':
                await apiFetch<CounterResponse, CreateCounterRequest>('/counters', {
                    method: 'POST',
                    body: cmd.payload,
                    ...options,
                });
                break;
            case 'UPDATE':
                await apiFetch<CounterResponse, UpdateCounterRequest>(`/counters/update/${cmd.entityId}`, {
                    method: 'PUT',
                    body: cmd.payload,
                    ...options,
                });
                break;
            case 'INCREMENT':
                await apiFetch<CounterResponse, IncrementCounterRequest>(`/counters/increment/${cmd.entityId}`, {
                    method: 'PUT',
                    body: cmd.payload,
                    ...options,
                });
                break;
            case 'DELETE':
                await apiFetch(`/counters/${cmd.entityId}`, {
                    method: 'DELETE',
                    ...options,
                });
                break;
            case 'REMOVE':
                await apiFetch(`/counters/remove-shared/${cmd.entityId}`, {
                    method: 'PUT',
                    ...options,
                });
                break;
        }
    },
};
