import type { ClientCounter } from '@packages/core';

// Maps to API endpoints: CREATE/UPDATE/DELETE operate on owned counters,
// INCREMENT uses the atomic increment endpoint, REMOVE sets a share to REJECTED.
export type MutationType = 'CREATE' | 'UPDATE' | 'DELETE' | 'INCREMENT' | 'REMOVE';

export interface MutationCommand {
    id: string; // Also used as the X-Idempotency-Key header
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
