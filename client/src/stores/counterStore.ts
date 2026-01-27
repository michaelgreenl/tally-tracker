import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useAuthStore } from '@/stores/authStore';
import { LocalStorageService } from '@/services/storage.service';
import { SyncQueueService } from '@/services/sync-queue.service';
import { SyncManager } from '@/services/sync-manager';
import apiFetch from '@/api';

import type { StoreResponse } from '@/types/index';
import type { ClientCounter } from '@/types/shared/models';
import type { HexColor } from '@/types/shared';
import type { CounterResponse } from '@/types/shared/responses';

const DEFAULT_COUNTER_COLOR = '#000000' as HexColor;

export const useCounterStore = defineStore('counter', () => {
    const counters = ref<ClientCounter[]>([]);
    const loading = ref(false);

    const authStore = useAuthStore();
    const isGuest = computed(() => !authStore.isAuthenticated);

    async function persist() {
        await LocalStorageService.saveCounters(counters.value);
    }

    async function init() {
        counters.value = await LocalStorageService.getAllCounters();

        if (!isGuest.value) {
            fetchRemoteCounters();
            SyncManager.processQueue();
        }
    }

    async function fetchRemoteCounters() {
        loading.value = true;
        try {
            const res = await apiFetch<CounterResponse>('/counters', { method: 'GET' });

            if (res.success && res.data?.counters) {
                counters.value = res.data.counters;
                await persist();
            }
        } catch (err) {
            console.warn('Background fetch failed, using local cache.');
        } finally {
            loading.value = false;
        }
    }

    async function createCounter(title: string, color: HexColor | null): Promise<StoreResponse> {
        const newCounter: ClientCounter = {
            id: crypto.randomUUID(),
            title,
            color: color || DEFAULT_COUNTER_COLOR,
            count: 0,
            userId: isGuest.value ? 'guest' : authStore.user?.id || 'offline-user',
        };

        counters.value.push(newCounter);
        await persist();

        if (!isGuest.value) {
            await SyncQueueService.addCommand({
                id: crypto.randomUUID(),
                type: 'CREATE',
                entity: 'counter',
                entityId: newCounter.id,
                payload: {
                    id: newCounter.id,
                    title: newCounter.title,
                    color: newCounter.color,
                },
                timestamp: Date.now(),
                retryCount: 0,
            });
            SyncManager.processQueue();
        }

        return { success: true };
    }

    async function incrementCounter(counterId: string, amount: number): Promise<StoreResponse> {
        const counter = counters.value.find((c) => c.id === counterId);
        if (!counter) return { success: false, message: 'Counter not found' };

        counter.count += amount;
        await persist();

        if (!isGuest.value) {
            await SyncQueueService.addCommand({
                id: crypto.randomUUID(),
                type: 'INCREMENT',
                entity: 'counter',
                entityId: counter.id,
                payload: { amount },
                timestamp: Date.now(),
                retryCount: 0,
            });
            SyncManager.processQueue();
        }

        return { success: true };
    }

    async function updateCounter(counterId: string, data: any): Promise<StoreResponse> {
        const index = counters.value.findIndex((c) => c.id === counterId);
        if (index === -1) return { success: false, message: 'Not found' };

        counters.value[index] = { ...counters.value[index], ...data };
        await persist();

        if (!isGuest.value) {
            await SyncQueueService.addCommand({
                id: crypto.randomUUID(),
                type: 'UPDATE',
                entity: 'counter',
                entityId: counterId,
                payload: data,
                timestamp: Date.now(),
                retryCount: 0,
            });
            SyncManager.processQueue();
        }

        return { success: true };
    }

    async function deleteCounter(counterId: string): Promise<StoreResponse> {
        counters.value = counters.value.filter((c) => c.id !== counterId);
        await persist();

        if (!isGuest.value) {
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
        }

        return { success: true };
    }

    async function consolidateGuestCounters() {
        if (isGuest.value) return;

        const guestCounters = counters.value.filter((c) => c.userId === 'guest');

        if (guestCounters.length === 0) return;

        console.log(`[Consolidation] Found ${guestCounters.length} guest counters. Syncing...`);

        for (const counter of guestCounters) {
            counter.userId = authStore.user?.id || 'unknown';

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

        await persist();
        SyncManager.processQueue();
    }

    return {
        counters,
        loading,
        init,
        createCounter,
        incrementCounter,
        updateCounter,
        deleteCounter,
        consolidateGuestCounters,
    };
});
