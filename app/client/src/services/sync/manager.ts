/**
 * Singleton responsible for processing the offline sync queue.
 *
 * Listens for network restoration via Capacitor and processes commands in FIFO order.
 * Each command includes its ID as an X-Idempotency-Key header. If the server already
 * processed a command but the client missed the response, the retry receives the
 * original mutation response without running the mutation again.
 * Commands are scoped to the user that queued them and only replay for that user.
 *
 * Error strategy:
 * - 2xx: Success. Remove command from queue.
 * - 401: Session expired (refresh already failed in apiFetch). Stop processing,
 *         keep commands for after re-auth, trigger logout.
 * - Other 4xx: Fatal (validation/logic error). Remove to unblock the queue.
 * - 5xx / Network: Retryable. Stop processing, retry on next trigger.
 */

import { UNAUTHORIZED } from '@tally/utils';
import { Network } from '@capacitor/network';
import { SyncQueueService } from '@/services/sync/queue';
import { useAuthStore } from '@/stores/authStore';
import apiFetch from '@/api';
import { ApiError } from '@/utils/errors';

import type { MutationCommand } from './types';
import type {
    CounterResponse,
    CreateCounterRequest,
    IncrementCounterRequest,
    SetCounterCountRequest,
    UpdateCounterRequest,
} from '@tally/core';

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

        const authStore = useAuthStore();
        const currentUserId = authStore.user?.id;
        if (!currentUserId) {
            console.log('[Sync] No authenticated user. Keeping commands in queue.');
            this.isSyncing = false;
            return;
        }

        const commandsForCurrentUser = queue.filter((command) => command.queuedByUserId === currentUserId);
        if (commandsForCurrentUser.length === 0) {
            console.log('[Sync] No commands queued for current user.');
            this.isSyncing = false;
            return;
        }

        console.log(`[Sync] Processing ${commandsForCurrentUser.length} commands...`);

        for (const command of commandsForCurrentUser) {
            try {
                await this.executeCommand(command);
                await SyncQueueService.removeCommand(command.id);
            } catch (error: unknown) {
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
                    body: cmd.payload as CreateCounterRequest,
                    ...options,
                });
                break;
            case 'UPDATE':
                await apiFetch<CounterResponse, UpdateCounterRequest>(`/counters/update/${cmd.entityId}`, {
                    method: 'PUT',
                    body: cmd.payload as UpdateCounterRequest,
                    ...options,
                });
                break;
            case 'SET_COUNT':
                await apiFetch<CounterResponse, SetCounterCountRequest>(`/counters/${cmd.entityId}/count`, {
                    method: 'PUT',
                    body: cmd.payload as SetCounterCountRequest,
                    ...options,
                });
                break;
            case 'INCREMENT':
                await apiFetch<CounterResponse, IncrementCounterRequest>(`/counters/increment/${cmd.entityId}`, {
                    method: 'PUT',
                    body: cmd.payload as IncrementCounterRequest,
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
