import { Preferences } from '@capacitor/preferences';
import { randomUUID } from '@/utils/safeUUID';

import type { ClientCounter } from '@/types/shared/models';

const GUEST_COUNTERS_KEY = 'guest_counters';

export const LocalStorageService = {
    async getAllCounters(): Promise<ClientCounter[]> {
        const { value } = await Preferences.get({ key: GUEST_COUNTERS_KEY });
        return value ? JSON.parse(value) : [];
    },

    async getCounter(counterId: string): Promise<ClientCounter | undefined> {
        const counters = await this.getAllCounters();
        return counters.find((c) => c.id === counterId);
    },

    async saveCounters(counters: ClientCounter[]): Promise<void> {
        await Preferences.set({
            key: GUEST_COUNTERS_KEY,
            value: JSON.stringify(counters),
        });
    },

    async createCounter(counter: Omit<ClientCounter, 'id' | 'userId'>): Promise<ClientCounter> {
        const counters = await this.getAllCounters();

        const newCounter: ClientCounter = {
            ...counter,
            id: randomUUID(),
            userId: 'guest',
        };

        counters.push(newCounter);
        await this.saveCounters(counters);
        return newCounter;
    },

    async updateCounter(counter: ClientCounter): Promise<void> {
        const counters = await this.getAllCounters();
        const index = counters.findIndex((c) => c.id === counter.id);
        if (index !== -1) {
            counters[index] = counter;
            await this.saveCounters(counters);
        }
    },

    async deleteCounter(id: string): Promise<void> {
        const counters = await this.getAllCounters();
        const filtered = counters.filter((c) => c.id !== id);
        await this.saveCounters(filtered);
    },
};
