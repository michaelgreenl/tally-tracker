import { Preferences } from '@capacitor/preferences';

import type { MutationCommand } from './types';

const QUEUE_KEY = 'app_sync_queue';

export const SyncQueueService = {
    async getQueue(): Promise<MutationCommand[]> {
        const { value } = await Preferences.get({ key: QUEUE_KEY });
        return value ? JSON.parse(value) : [];
    },

    async saveQueue(queue: MutationCommand[]): Promise<void> {
        await Preferences.set({
            key: QUEUE_KEY,
            value: JSON.stringify(queue),
        });
    },

    async addCommand(command: MutationCommand): Promise<void> {
        const queue = await this.getQueue();
        queue.push(command);
        await this.saveQueue(queue);
    },

    async removeCommand(id: string): Promise<void> {
        const queue = await this.getQueue();
        const filtered = queue.filter((cmd) => cmd.id !== id);
        await this.saveQueue(filtered);
    },

    async clearQueue(): Promise<void> {
        await Preferences.remove({ key: QUEUE_KEY });
    },
};
