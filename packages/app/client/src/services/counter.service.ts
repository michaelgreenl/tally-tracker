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

const command = async (input: Omit<Parameters<typeof SyncQueue.add>[0], 'id' | 'queuedByUserId' | 'timestamp'>) => {
    await SyncQueue.add({
        ...input,
        id: Crypto.randomUUID(),
        queuedByUserId: await queuedUserId(),
        timestamp: Date.now(),
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
        });
    },

    update(counterId: string, payload: UpdateCounterRequest) {
        return command({ type: 'UPDATE', entity: 'counter', entityId: counterId, payload });
    },

    increment(counter: ClientCounter, amount: number) {
        return command({
            type: counter.type === 'SHARED' ? 'INCREMENT' : 'SET_COUNT',
            entity: 'counter',
            entityId: counter.id,
            payload: counter.type === 'SHARED' ? { amount } : { count: counter.count },
        });
    },

    async delete(counter: ClientCounter) {
        const userId = await queuedUserId();
        await SyncQueue.add({
            id: Crypto.randomUUID(),
            queuedByUserId: userId,
            type: counter.userId === userId ? 'DELETE' : 'REMOVE',
            entity: 'counter',
            entityId: counter.id,
            payload: {},
            timestamp: Date.now(),
        });
        void SyncManager.processQueue();
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
