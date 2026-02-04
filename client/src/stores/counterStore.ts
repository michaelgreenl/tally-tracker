import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useAuthStore } from '@/stores/authStore';
import { CounterService } from '@/services/counter.service';
import { ok, fail } from '@/utils/result';

import type { StoreResponse } from '@/types/index';
import type { CounterTypeType as CounterType } from '@/types/shared/generated/index';
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

    const generateInviteCode = (): string => {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    };

    async function createCounter(title: string, color: HexColor | null, type: CounterType): Promise<StoreResponse> {
        const inviteCode = type === 'SHARED' ? generateInviteCode() : null;

        const newCounter: ClientCounter = {
            id: crypto.randomUUID(),
            title,
            color: color || DEFAULT_COUNTER_COLOR,
            count: 0,
            userId: isGuest.value ? 'guest' : authStore.user?.id || 'offline-user',
            type,
            inviteCode,
        };

        counters.value.push(newCounter);
        await saveState();

        if (!isGuest.value) await CounterService.create(newCounter);

        return ok();
    }

    async function incrementCounter(counterId: string, amount: number): Promise<StoreResponse> {
        const counter = counters.value.find((c) => c.id === counterId);
        if (!counter) return fail('Counter not found');

        counter.count += amount;
        await saveState();

        if (!isGuest.value) await CounterService.increment(counter, amount);

        return ok();
    }

    async function updateCounter(counterId: string, data: any): Promise<StoreResponse> {
        const index = counters.value.findIndex((c) => c.id === counterId);
        if (index === -1) return fail('Not found');

        counters.value[index] = { ...counters.value[index], ...data };
        await saveState();

        if (!isGuest.value) await CounterService.update(counterId, data);

        return ok();
    }

    async function deleteCounter(counterId: string): Promise<StoreResponse> {
        counters.value = counters.value.filter((c) => c.id !== counterId);
        await saveState();

        if (!isGuest.value) await CounterService.delete(counterId);

        return ok();
    }

    // TODO:
    async function removeShared(counterId: string): Promise<StoreResponse> {
        counters.value = counters.value.filter((c) => c.id !== counterId);
        await saveState();

        if (!isGuest.value) await CounterService.removeShared(counterId);

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

    async function joinCounter(inviteCode: string): Promise<StoreResponse> {
        loading.value = true;

        try {
            const res = await CounterService.join(inviteCode);

            if (res.success && res.data?.counter) {
                const newCounter = res.data.counter;

                const exists = counters.value.some((c) => c.id === newCounter.id);
                if (!exists) {
                    counters.value.push(newCounter);
                    await saveState();
                }

                return ok();
            }

            return fail(res.message || 'Failed to join counter');
        } catch (error: any) {
            console.error('Join counter failed:', error);
            return fail(error.message || 'Network error');
        } finally {
            loading.value = false;
        }
    }

    return {
        counters,
        loading,
        init,
        createCounter,
        incrementCounter,
        updateCounter,
        deleteCounter,
        removeShared,
        consolidateGuestCounters,
        joinCounter,
    };
});
