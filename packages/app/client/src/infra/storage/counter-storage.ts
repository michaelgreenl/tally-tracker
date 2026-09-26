import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ClientCounter } from '@tally/core/client';

const COUNTERS_KEY = 'app_counters';

type CounterState = { counters: ClientCounter[]; widgetReceipts: string[] };

async function getState(): Promise<CounterState> {
    const value = await AsyncStorage.getItem(COUNTERS_KEY);
    if (!value) return { counters: [], widgetReceipts: [] };
    const state = JSON.parse(value) as CounterState | ClientCounter[];
    return Array.isArray(state) ? { counters: state, widgetReceipts: [] } : state;
}

function saveState(state: CounterState) {
    // Receipts and counts must commit together. A crash must not apply a widget tap twice.
    return AsyncStorage.setItem(COUNTERS_KEY, JSON.stringify(state));
}

export const CounterStorage = {
    getState,
    saveState,
    async getAll(): Promise<ClientCounter[]> {
        return (await getState()).counters;
    },

    async save(counters: ClientCounter[]) {
        const state = await getState();
        await saveState({ ...state, counters });
    },

    clear() {
        return AsyncStorage.removeItem(COUNTERS_KEY);
    },

    async removeAccount(userId: string) {
        try {
            const counters = await this.getAll();
            await this.save(
                counters.filter(
                    (counter) => counter.userId !== userId && !counter.shares?.some((share) => share.userId === userId),
                ),
            );
        } finally {
            await AsyncStorage.removeItem(`${COUNTERS_KEY}_order_${userId}`);
        }
    },

    async getOrder(userId: string): Promise<string[]> {
        const value = await AsyncStorage.getItem(`${COUNTERS_KEY}_order_${userId}`);
        const ids: unknown = value ? JSON.parse(value) : [];
        return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
    },

    saveOrder(userId: string, ids: string[]) {
        return AsyncStorage.setItem(`${COUNTERS_KEY}_order_${userId}`, JSON.stringify(ids));
    },
};
