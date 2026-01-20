import { defineStore } from 'pinia';
import { ref } from 'vue';
import apiFetch from '@/api';

import type { ApiResponse, CounterResponse } from '@/types/shared/responses';
import type { StoreResponse } from '@/types/index';
import type { CreateCounterRequest, IncrementCounterRequest, UpdateCounterRequest } from '@/types/shared/requests';
import type { ClientCounter } from '@/types/shared/models';
import type { HexColor } from '@/types/shared';

const DEFAULT_COUNTER_COLOR = '#000000' as HexColor;

export const useCounterStore = defineStore('counter', () => {
    const counters = ref<ClientCounter[]>([]);

    async function createCounter(title: string, color: HexColor | null): Promise<StoreResponse> {
        try {
            const res = await apiFetch<CounterResponse, CreateCounterRequest>('/counters', {
                method: 'POST',
                body: {
                    title,
                    color: color || DEFAULT_COUNTER_COLOR,
                    count: 0,
                },
            });

            if (res.success && res.data?.counter) {
                counters.value.push(res.data.counter);
                return { success: true };
            }

            return { success: false, message: 'Failed to get counter' };
        } catch (error: any) {
            console.error('Failed to create counter: ', error.message);
            return { success: false, message: error.message };
        }
    }

    async function getAllCounters(): Promise<StoreResponse> {
        try {
            const res = await apiFetch<CounterResponse>('/counters', { method: 'GET' });

            if (res.success && res.data?.counters) {
                counters.value = res.data.counters;
                return { success: true };
            }

            return { success: false, message: 'Failed to get counters' };
        } catch (error: any) {
            console.error('Failed to get counters: ', error.message);
            return { success: false, message: error.message };
        }
    }

    async function getCounter(counterId: string): Promise<StoreResponse> {
        try {
            const res = await apiFetch<CounterResponse>(`/counters/${counterId}`, { method: 'GET' });

            if (res.success && res.data?.counter) {
                const index = counters.value.findIndex((c) => c.id === counterId);
                if (index !== -1) counters.value[index] = res.data.counter;

                return { success: true };
            }

            return { success: false, message: 'Failed to get counter' };
        } catch (error: any) {
            console.error('Failed to get counter: ', error.message);
            return { success: false, message: error.message };
        }
    }

    async function updateCounter(counterId: string, data: UpdateCounterRequest): Promise<StoreResponse> {
        try {
            const res = await apiFetch<CounterResponse, UpdateCounterRequest>(`/counters/update/${counterId}`, {
                method: 'PUT',
                body: data,
            });

            if (res.success && res.data?.counter) {
                const index = counters.value.findIndex((c) => c.id === counterId);
                if (index !== -1) {
                    counters.value[index] = res.data.counter;
                }

                return { success: true };
            }

            return { success: false, message: 'Failed to update counter' };
        } catch (error: any) {
            console.error('Failed to update counter: ', error.message);
            return { success: false, message: error.message };
        }
    }

    async function incrementCounter(counterId: string, amount: number): Promise<StoreResponse> {
        try {
            const res = await apiFetch<CounterResponse, IncrementCounterRequest>(`/counters/increment/${counterId}`, {
                method: 'PUT',
                body: { amount },
            });

            if (res.success && res.data?.counter) {
                const index = counters.value.findIndex((c) => c.id === counterId);
                if (index !== -1) {
                    counters.value[index] = res.data.counter;
                }

                return { success: true };
            }

            return { success: false, message: 'Failed to increment counter' };
        } catch (error: any) {
            console.error('Failed to increment counter: ', error.message);
            return { success: false, message: error.message };
        }
    }

    async function deleteCounter(counterId: string): Promise<StoreResponse> {
        try {
            const res = await apiFetch<CounterResponse, UpdateCounterRequest>(`/counters/${counterId}`, {
                method: 'DELETE',
            });

            if (res.success) {
                counters.value = counters.value.filter((c) => c.id !== counterId);
                return { success: true };
            }

            return { success: false, message: 'Failed to delete counter' };
        } catch (error: any) {
            console.error('Failed to delete counter: ', error.message);
            return { success: false, message: error.message };
        }
    }

    return { counters, createCounter, getCounter, getAllCounters, updateCounter, incrementCounter, deleteCounter };
});
