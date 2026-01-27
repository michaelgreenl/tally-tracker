import { LocalStorageService } from '@/services/storage.service';
import { SyncQueueService } from '@/services/sync/queue';
import { SyncManager } from '@/services/sync/manager';
import apiFetch from '@/api';

import type { ClientCounter } from '@/types/shared/models';
import type { CounterResponse } from '@/types/shared/responses';

export const CounterService = {
    async getAllLocal() {
        return LocalStorageService.getAllCounters();
    },

    async fetchRemote() {
        const res = await apiFetch<CounterResponse>('/counters', { method: 'GET' });
        return res.success ? res.data?.counters || [] : null;
    },

    async persist(counters: ClientCounter[]) {
        await LocalStorageService.saveCounters(counters);
    },

    async create(counter: ClientCounter, isGuest: boolean) {
        if (isGuest) return;

        await SyncQueueService.addCommand({
            id: crypto.randomUUID(),
            type: 'CREATE',
            entity: 'counter',
            entityId: counter.id,
            payload: {
                id: counter.id,
                title: counter.title,
                color: counter.color,
                count: counter.count,
            },
            timestamp: Date.now(),
            retryCount: 0,
        });
        SyncManager.processQueue();
    },

    async update(counterId: string, updates: Partial<ClientCounter>, isGuest: boolean) {
        if (isGuest) return;

        await SyncQueueService.addCommand({
            id: crypto.randomUUID(),
            type: 'UPDATE',
            entity: 'counter',
            entityId: counterId,
            payload: updates,
            timestamp: Date.now(),
            retryCount: 0,
        });
        SyncManager.processQueue();
    },

    async increment(counterId: string, amount: number, isGuest: boolean) {
        if (isGuest) return;

        await SyncQueueService.addCommand({
            id: crypto.randomUUID(),
            type: 'INCREMENT',
            entity: 'counter',
            entityId: counterId,
            payload: { amount },
            timestamp: Date.now(),
            retryCount: 0,
        });
        SyncManager.processQueue();
    },

    async delete(counterId: string, isGuest: boolean) {
        if (isGuest) return;

        await SyncQueueService.addCommand({
            id: crypto.randomUUID(),
            type: 'DELETE',
            entity: 'counter',
            entityId: counterId,
            payload: {},
            timestamp: Date.now(),
            retryCount: 0,
        });
        SyncManager.processQueue();
    },

    async consolidate(countersToSync: ClientCounter[], userId: string) {
        console.log(`[Consolidation] Syncing ${countersToSync.length} counters...`);

        for (const counter of countersToSync) {
            await SyncQueueService.addCommand({
                id: crypto.randomUUID(),
                type: 'CREATE',
                entity: 'counter',
                entityId: counter.id,
                payload: {
                    id: counter.id,
                    title: counter.title,
                    color: counter.color,
                    count: counter.count,
                },
                timestamp: Date.now(),
                retryCount: 0,
            });
        }
        SyncManager.processQueue();
    },
};
