import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncQueueService } from '../queue';
import { buildCommand } from '../../../../tests/e2e/fixtures/counter.fixture';

vi.mock('@capacitor/preferences', () => ({
    Preferences: {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn(),
    },
}));

import { Preferences } from '@capacitor/preferences';

describe('SyncQueueService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getQueue', () => {
        it('should return empty array when no queue exists', async () => {
            vi.mocked(Preferences.get).mockResolvedValue({ value: null });

            const queue = await SyncQueueService.getQueue();

            expect(queue).toEqual([]);
        });

        it('should parse and return stored queue', async () => {
            const commands = [buildCommand(), buildCommand({ id: 'cmd-2' })];
            vi.mocked(Preferences.get).mockResolvedValue({ value: JSON.stringify(commands) });

            const queue = await SyncQueueService.getQueue();

            expect(queue).toHaveLength(2);
        });
    });

    describe('addCommand', () => {
        it('should append command to existing queue', async () => {
            const existingCommand = buildCommand({ id: 'existing' });
            const newCommand = buildCommand({ id: 'new' });

            vi.mocked(Preferences.get).mockResolvedValue({
                value: JSON.stringify([existingCommand]),
            });

            await SyncQueueService.addCommand(newCommand);

            expect(Preferences.set).toHaveBeenCalledWith({
                key: 'app_sync_queue',
                value: expect.stringContaining('new'),
            });

            const savedValue = vi.mocked(Preferences.set).mock.calls[0][0].value;
            const parsed = JSON.parse(savedValue);
            expect(parsed).toHaveLength(2);
        });
    });

    describe('removeCommand', () => {
        it('should remove command by id', async () => {
            const commands = [buildCommand({ id: 'keep' }), buildCommand({ id: 'remove' })];
            vi.mocked(Preferences.get).mockResolvedValue({ value: JSON.stringify(commands) });

            await SyncQueueService.removeCommand('remove');

            const savedValue = vi.mocked(Preferences.set).mock.calls[0][0].value;
            const parsed = JSON.parse(savedValue);
            expect(parsed).toHaveLength(1);
            expect(parsed[0].id).toBe('keep');
        });
    });

    describe('clearQueue', () => {
        it('should remove the queue key', async () => {
            await SyncQueueService.clearQueue();

            expect(Preferences.remove).toHaveBeenCalledWith({ key: 'app_sync_queue' });
        });
    });
});
