import * as Crypto from 'expo-crypto';

import apiFetch from '../api';
import { AuthService } from './auth.service';
import { CounterStorage } from './counter-storage';
import { SyncManager } from './sync-manager';
import { SyncQueue } from './sync-queue';

import type { ClientCounter, CounterResponse, JoinCounterRequest, UpdateCounterRequest } from '@tally/core/client';

const queuedUserId = async () => {
    const userId = (await AuthService.getCachedUser())?.id;
    if (!userId) throw new Error('Cannot queue a mutation without an authenticated user');
    return userId;
};

const command = async (input: Omit<Parameters<typeof SyncQueue.add>[0], 'id' | 'queuedByUserId'>) => {
    await SyncQueue.add({
        ...input,
        id: Crypto.randomUUID(),
        queuedByUserId: await queuedUserId(),
    });
    void SyncManager.processQueue();
};

export const CounterService = {
    getAllLocal: CounterStorage.getAll,
    persist: CounterStorage.save,
    clearLocal: CounterStorage.clear,

    async fetchRemote() {
        const response = await apiFetch<CounterResponse>('/counters', { method: 'GET' });
        return response.success ? response.data?.counters || [] : null;
    },

    create(counter: ClientCounter) {
        return command({
            type: 'CREATE',
            entityId: counter.id,
            payload: {
                id: counter.id,
                title: counter.title,
                color: counter.color,
                count: counter.count,
            },
        });
    },

    update(counterId: string, payload: UpdateCounterRequest) {
        return command({ type: 'UPDATE', entityId: counterId, payload });
    },

    increment(counter: ClientCounter, amount: number) {
        return command({
            type: 'INCREMENT',
            entityId: counter.id,
            payload: { amount },
        });
    },

    async delete(counter: ClientCounter) {
        const userId = await queuedUserId();
        await SyncQueue.add({
            id: Crypto.randomUUID(),
            queuedByUserId: userId,
            type: counter.userId === userId ? 'DELETE' : 'REMOVE',
            entityId: counter.id,
            payload: {},
        });
        void SyncManager.processQueue();
    },

    async share(counterId: string) {
        const userId = await queuedUserId();
        await SyncManager.processQueue();
        const pending = await SyncQueue.get();
        if (pending.some((item) => item.entityId === counterId && item.queuedByUserId === userId)) {
            throw new Error('Wait for this counter to sync, then try sharing again.');
        }
        return apiFetch<CounterResponse>(`/counters/${counterId}/share`, { method: 'POST' });
    },

    join(inviteCode: string) {
        return apiFetch<CounterResponse, JoinCounterRequest>('/counters/join', {
            method: 'POST',
            body: { inviteCode },
        });
    },

    async consolidate(counters: ClientCounter[]) {
        for (const counter of counters) await this.create(counter);
    },
};
