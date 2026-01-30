import { Network } from '@capacitor/network';
import { SyncQueueService } from '@/services/sync/queue';
import apiFetch from '@/api';
import { ApiError } from '@/utils/errors';

import type { MutationCommand } from './types';
import type { CounterResponse } from '@/types/shared/responses';
import type { CreateCounterRequest, IncrementCounterRequest, UpdateCounterRequest } from '@/types/shared/requests';

export const SyncManager = {
    isSyncing: false,

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

                const isFatal = status >= 400 && status < 500;

                if (isFatal) {
                    console.warn('[Sync] Fatal error (4xx), removing invalid command.');
                    await SyncQueueService.removeCommand(command.id);
                    continue;
                }

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
        }
    },
};
