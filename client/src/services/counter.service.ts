import { LocalStorageService } from '@/services/storage.service';
import { SyncQueueService } from '@/services/sync/queue';
import { SyncManager } from '@/services/sync/manager';
import { useAuthStore } from '@/stores/authStore';
import apiFetch from '@/api';

import type { ClientCounter } from '@/types/shared/models';
import type { CounterResponse } from '@/types/shared/responses';
import type { JoinCounterRequest } from '@/types/shared/requests';

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

    async create(counter: ClientCounter) {
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
                type: counter.type,
                inviteCode: counter.inviteCode,
            },
            timestamp: Date.now(),
            retryCount: 0,
        });
        SyncManager.processQueue();
    },

    async update(counterId: string, updates: Partial<ClientCounter>) {
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

    async increment(counter: ClientCounter, amount: number) {
        // Shared counters use the atomic increment endpoint to avoid race conditions
        // with concurrent users. Personal counters send the absolute count instead.
        if (counter.type === 'SHARED') {
            await SyncQueueService.addCommand({
                id: crypto.randomUUID(),
                type: 'INCREMENT',
                entity: 'counter',
                entityId: counter.id,
                payload: { amount },
                timestamp: Date.now(),
                retryCount: 0,
            });
        } else {
            await SyncQueueService.addCommand({
                id: crypto.randomUUID(),
                type: 'UPDATE',
                entity: 'counter',
                entityId: counter.id,
                payload: { count: counter.count },
                timestamp: Date.now(),
                retryCount: 0,
            });
        }
        SyncManager.processQueue();
    },

    async delete(counter: ClientCounter) {
        const authStore = useAuthStore();

        // Counter owner -> DELETE | Counter participant -> REMOVE (sets share status to REJECTED).
        if (!authStore.isAuthenticated || counter.userId === authStore.user?.id) {
            await SyncQueueService.addCommand({
                id: crypto.randomUUID(),
                type: 'DELETE',
                entity: 'counter',
                entityId: counter.id,
                payload: {},
                timestamp: Date.now(),
                retryCount: 0,
            });
        } else {
            await SyncQueueService.addCommand({
                id: crypto.randomUUID(),
                type: 'REMOVE',
                entity: 'counter',
                entityId: counter.id,
                payload: {},
                timestamp: Date.now(),
                retryCount: 0,
            });
        }
        SyncManager.processQueue();
    },

    // Join is synchronous since it requires real-time server validation.
    async join(inviteCode: string) {
        const res = await apiFetch<CounterResponse, JoinCounterRequest>('/counters/join', {
            method: 'POST',
            body: { inviteCode },
        });

        return res;
    },

    // Migrates guest counters to the authenticated user's account after login.
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
                    type: counter.type,
                },
                timestamp: Date.now(),
                retryCount: 0,
            });
        }
        SyncManager.processQueue();
    },
};
