import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import apiFetch from '@/api';
import { useAuthStore } from '@/stores/authStore';
import { LocalStorageService } from '@/services/storage.service';

import type { ApiResponse, CounterResponse } from '@/types/shared/responses';
import type { StoreResponse } from '@/types/index';
import type { CreateCounterRequest, IncrementCounterRequest, UpdateCounterRequest } from '@/types/shared/requests';
import type { ClientCounter } from '@/types/shared/models';
import type { HexColor } from '@/types/shared';

const DEFAULT_COUNTER_COLOR = '#000000' as HexColor;

export const useCounterStore = defineStore('counter', () => {
    const counters = ref<ClientCounter[]>([]);
    const loading = ref(false);
    const isGuest = computed(() => !useAuthStore().isAuthenticated);

    async function createCounter(title: string, color: HexColor | null): Promise<StoreResponse> {
        const payload = {
            title: title,
            color: color || DEFAULT_COUNTER_COLOR,
            count: 0,
        };

        const tempId = crypto.randomUUID();
        const tempCounter: ClientCounter = {
            ...payload,
            id: tempId,
            userId: 'optimistic',
        };

        counters.value.push(tempCounter);

        try {
            if (isGuest.value) {
                const newCounter = await LocalStorageService.createCounter(payload as ClientCounter);

                const index = counters.value.findIndex((c) => c.id === tempId);
                if (index !== -1) counters.value[index] = newCounter;

                return { success: true };
            } else {
                const res = await apiFetch<CounterResponse, CreateCounterRequest>('/counters', {
                    method: 'POST',
                    body: payload as CreateCounterRequest,
                });

                if (res.success && res.data?.counter) {
                    const index = counters.value.findIndex((c) => c.id === tempId);
                    if (index !== -1) {
                        counters.value[index] = res.data.counter;
                        return { success: true };
                    }
                }
            }

            throw new Error('API Error');
        } catch (error: any) {
            counters.value = counters.value.filter((c) => c.id !== tempId);
            console.error('Failed to create counter: ', error.message);
            return { success: false, message: error.message };
        }
    }

    async function getAllCounters(): Promise<StoreResponse> {
        loading.value = true;
        try {
            if (isGuest.value) {
                counters.value = await LocalStorageService.getAllCounters();
                return { success: true };
            } else {
                const res = await apiFetch<CounterResponse>('/counters', { method: 'GET' });

                if (res.success) {
                    if (res.data?.counters) {
                        counters.value = res.data.counters;
                        return { success: true };
                    }

                    return { success: false, message: 'Failed to get counters: No counters were found' };
                }
            }

            return { success: false, message: 'Failed to get counters' };
        } catch (error: any) {
            console.error('Failed to get counters: ', error.message);
            return { success: false, message: error.message };
        } finally {
            loading.value = false;
        }
    }

    async function getCounter(counterId: string): Promise<StoreResponse> {
        loading.value = true;
        try {
            if (isGuest.value) {
                const counter: ClientCounter | undefined = await LocalStorageService.getCounter(counterId);

                if (counter) {
                    const index = counters.value.findIndex((c) => c.id === counter.id);
                    if (index !== -1) counters.value[index] = counter;

                    return { success: true };
                }

                return { success: false, message: 'Failed to get counter: No counter was found' };
            } else {
                const res = await apiFetch<CounterResponse>(`/counters/${counterId}`, { method: 'GET' });

                if (res.success) {
                    if (res.data?.counter) {
                        const index = counters.value.findIndex((c) => c.id === counterId);
                        if (index !== -1) counters.value[index] = res.data.counter;

                        return { success: true };
                    }

                    return { success: false, message: 'Failed to get counter: No counter was found' };
                }
            }

            return { success: false, message: 'Failed to get counter' };
        } catch (error: any) {
            console.error('Failed to get counter: ', error.message);
            return { success: false, message: error.message };
        } finally {
            loading.value = false;
        }
    }

    async function updateCounter(counterId: string, data: UpdateCounterRequest): Promise<StoreResponse> {
        const index = counters.value.findIndex((c) => c.id === counterId);
        if (index === -1) throw new Error('Counter not found');

        const previousCounter = counters.value[index];
        if (previousCounter) {
            counters.value[index] = { ...data } as ClientCounter;
        }

        try {
            if (isGuest.value) {
                if (counters.value[index]) {
                    await LocalStorageService.updateCounter(counters.value[index]);
                    return { success: true };
                }
            } else {
                const res = await apiFetch<CounterResponse, UpdateCounterRequest>(`/counters/update/${counterId}`, {
                    method: 'PUT',
                    body: data,
                });

                if (res.success && res.data?.counter) {
                    counters.value[index] = res.data.counter;
                    return { success: true };
                }
            }

            throw new Error('API Error');
        } catch (error: any) {
            if (error.type !== 'Counter not found' && previousCounter) {
                counters.value[index] = previousCounter;
            }

            console.error('Failed to update counter: ', error.message);
            return { success: false, message: error.message };
        }
    }

    async function incrementCounter(counterId: string, amount: number): Promise<StoreResponse> {
        const index = counters.value.findIndex((c) => c.id === counterId);
        if (index === -1) throw new Error('Counter not found');

        if (counters.value[index]) {
            counters.value[index].count += amount;
        }

        try {
            if (isGuest.value) {
                if (counters.value[index]) {
                    await LocalStorageService.updateCounter(counters.value[index]);
                    return { success: true };
                }
            } else {
                const res = await apiFetch<CounterResponse, IncrementCounterRequest>(
                    `/counters/increment/${counterId}`,
                    {
                        method: 'PUT',
                        body: { amount },
                    },
                );

                if (res.success && res.data?.counter) {
                    if (index !== -1) counters.value[index] = res.data.counter;
                    return { success: true };
                }
            }

            throw new Error('API Error');
        } catch (error: any) {
            if (error.type !== 'Counter not found' && counters.value[index]) {
                counters.value[index].count -= amount;
            }

            console.error('Failed to increment counter: ', error.message);
            return { success: false, message: error.message };
        }
    }

    async function deleteCounter(counterId: string): Promise<StoreResponse> {
        const previous = [...counters.value];
        counters.value = counters.value.filter((c) => c.id !== counterId);

        try {
            if (isGuest.value) {
                await LocalStorageService.deleteCounter(counterId);
                return { success: true };
            } else {
                const res = await apiFetch<CounterResponse, UpdateCounterRequest>(`/counters/${counterId}`, {
                    method: 'DELETE',
                });

                if (res.success) return { success: true };
            }

            throw new Error('API Error');
        } catch (error: any) {
            counters.value = previous;
            console.error('Failed to delete counter: ', error.message);
            return { success: false, message: error.message };
        }
    }

    return {
        counters,
        loading,
        createCounter,
        getCounter,
        getAllCounters,
        updateCounter,
        incrementCounter,
        deleteCounter,
    };
});
