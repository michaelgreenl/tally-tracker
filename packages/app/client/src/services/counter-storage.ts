import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ClientCounter } from '@tally/core/client';

const COUNTERS_KEY = 'guest_counters';

export const CounterStorage = {
    async getAll(): Promise<ClientCounter[]> {
        const value = await AsyncStorage.getItem(COUNTERS_KEY);
        if (!value) return [];

        const counters: unknown = JSON.parse(value);
        return Array.isArray(counters) ? (counters as ClientCounter[]) : [];
    },

    save(counters: ClientCounter[]) {
        return AsyncStorage.setItem(COUNTERS_KEY, JSON.stringify(counters));
    },

    clear() {
        return AsyncStorage.removeItem(COUNTERS_KEY);
    },
};
