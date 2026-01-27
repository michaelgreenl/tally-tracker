import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useAuthStore } from '@/stores/authStore';
import { CounterService } from '@/services/counter.service';
import { ok, fail } from '@/utils/result';

import type { StoreResponse } from '@/types/index';
import type { ClientCounter } from '@/types/shared/models';
import type { HexColor } from '@/types/shared';

const DEFAULT_COUNTER_COLOR = '#000000' as HexColor;

export const useCounterStore = defineStore('counter', () => {
    const authStore = useAuthStore();

    const counters = ref<ClientCounter[]>([]);
    const isGuest = computed(() => !authStore.isAuthenticated);
    const loading = ref(false);

    async function saveState() {
        await CounterService.persist(counters.value);
    }

    async function init() {
        counters.value = await CounterService.getAllLocal();

        if (!isGuest.value) {
            loading.value = true;
            try {
                const remoteCounters = await CounterService.fetchRemote();

                if (remoteCounters) {
                    counters.value = remoteCounters;
                    await saveState();
                }
            } catch (error: any) {
                console.warn('Background fetch failed, using local cache.');
            } finally {
                loading.value = false;
            }
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
        await saveState();

        await CounterService.create(newCounter, isGuest.value);

        return ok();
    }

    async function incrementCounter(counterId: string, amount: number): Promise<StoreResponse> {
        const counter = counters.value.find((c) => c.id === counterId);
        if (!counter) return fail('Counter not found');

        counter.count += amount;
        await saveState();

        await CounterService.increment(counterId, amount, isGuest.value);

        return ok();
    }

    async function updateCounter(counterId: string, data: any): Promise<StoreResponse> {
        const index = counters.value.findIndex((c) => c.id === counterId);
        if (index === -1) return fail('Not found');

        counters.value[index] = { ...counters.value[index], ...data };
        await saveState();

        await CounterService.update(counterId, data, isGuest.value);

        return ok();
    }

    async function deleteCounter(counterId: string): Promise<StoreResponse> {
        counters.value = counters.value.filter((c) => c.id !== counterId);
        await saveState();

        await CounterService.delete(counterId, isGuest.value);

        return ok();
    }

    async function consolidateGuestCounters() {
        if (isGuest.value) return;

        const guestCounters = counters.value.filter((c) => c.userId === 'guest');
        if (guestCounters.length === 0) return;

        guestCounters.forEach((c) => {
            c.userId = authStore.user?.id || 'unknown';
        });
        await saveState();

        await CounterService.consolidate(guestCounters, authStore.user?.id || '');
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
