import type { ClientCounter } from '@/types/shared/models';

export type MutationType = 'CREATE' | 'UPDATE' | 'DELETE' | 'INCREMENT' | 'REMOVE';

export interface MutationCommand {
    id: string;
    type: MutationType;
    entity: 'counter';
    entityId: string;
    payload: any;
    timestamp: number;
    retryCount: number;
}

export interface SyncState {
    lastSyncedAt: number | null;
    status: 'idle' | 'syncing' | 'offline' | 'error';
    queueLength: number;
}
