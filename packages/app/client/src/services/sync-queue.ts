import AsyncStorage from '@react-native-async-storage/async-storage';

export type MutationCommand = {
    id: string;
    queuedByUserId: string;
    type: 'CREATE' | 'UPDATE' | 'SET_COUNT' | 'DELETE' | 'INCREMENT' | 'REMOVE';
    entity: 'counter';
    entityId: string;
    payload: unknown;
    timestamp: number;
};

const QUEUE_KEY = 'app_sync_queue';
let queueMutation = Promise.resolve();

const mutateQueue = async <T>(operation: () => Promise<T>): Promise<T> => {
    const result = queueMutation.then(operation, operation);
    queueMutation = result.then(
        () => undefined,
        () => undefined,
    );
    return result;
};

export const SyncQueue = {
    async get(): Promise<MutationCommand[]> {
        const value = await AsyncStorage.getItem(QUEUE_KEY);
        if (!value) return [];

        const queue: unknown = JSON.parse(value);
        return Array.isArray(queue) ? (queue as MutationCommand[]) : [];
    },

    save(queue: MutationCommand[]) {
        return AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    },

    add(command: MutationCommand) {
        return mutateQueue(async () => {
            const queue = await this.get();
            queue.push(command);
            await this.save(queue);
        });
    },

    remove(id: string) {
        return mutateQueue(async () => {
            const queue = await this.get();
            await this.save(queue.filter((command) => command.id !== id));
        });
    },

    clear() {
        return AsyncStorage.removeItem(QUEUE_KEY);
    },
};
