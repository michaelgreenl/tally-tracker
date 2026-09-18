import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

export type MutationCommand = {
    id: string;
    queuedByUserId: string;
    type: 'CREATE' | 'UPDATE' | 'DELETE' | 'INCREMENT' | 'REMOVE';
    entityId: string;
    payload: unknown;
    rejected?: number;
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

function repairRejectedEdits(queue: MutationCommand[], target: MutationCommand) {
    const sameCounter = (item: MutationCommand) =>
        item.queuedByUserId === target.queuedByUserId && item.entityId === target.entityId;
    const index = queue.findIndex(
        (item) =>
            sameCounter(item) &&
            item.rejected &&
            item.rejected !== 409 &&
            (item.type === 'CREATE' || item.type === 'UPDATE'),
    );
    if (index < 0) return queue;
    const edits = queue.slice(index + 1).filter((item) => sameCounter(item) && item.type === 'UPDATE');
    const latest = edits.at(-1);
    if (!latest) return queue;
    // Keep the original create count. Later increments must still run exactly once.
    const payload = Object.assign({}, queue[index].payload, ...edits.map((item) => item.payload));
    queue[index] = { ...queue[index], id: latest.id, payload, rejected: undefined };
    return queue.filter((item) => !edits.includes(item));
}

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
            await this.save(command.type === 'UPDATE' ? repairRejectedEdits(queue, command) : queue);
        });
    },

    prepare(id: string) {
        return mutateQueue(async () => {
            const queue = await this.get();
            const command = queue.find((item) => item.id === id);
            // A 409 can describe an already-applied operation. Never give it a new identity.
            if (command?.rejected && command.rejected !== 409) {
                command.id = Crypto.randomUUID();
                delete command.rejected;
                await this.save(queue);
            }
            return command;
        });
    },

    reject(id: string, status: number) {
        return mutateQueue(async () => {
            const queue = await this.get();
            const command = queue.find((item) => item.id === id);
            if (command) {
                command.rejected = status;
                const repaired = repairRejectedEdits(queue, command);
                await this.save(repaired);
                return repaired !== queue;
            }
            return false;
        });
    },

    removeCounter(userId: string, entityId: string) {
        return mutateQueue(async () => {
            const queue = await this.get();
            await this.save(queue.filter((item) => item.queuedByUserId !== userId || item.entityId !== entityId));
        });
    },

    removeAccount(userId: string) {
        return mutateQueue(async () => {
            const queue = await this.get();
            await this.save(queue.filter((item) => item.queuedByUserId !== userId));
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
