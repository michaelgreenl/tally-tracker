// Maps to API endpoints: CREATE/UPDATE/DELETE operate on owned counters,
// SET_COUNT sets personal counts, INCREMENT uses the atomic shared counter endpoint,
// REMOVE sets a share to REJECTED.
export type MutationType = 'CREATE' | 'UPDATE' | 'SET_COUNT' | 'DELETE' | 'INCREMENT' | 'REMOVE';

export interface MutationCommand {
    id: string; // Also used as the X-Idempotency-Key header
    queuedByUserId: string;
    type: MutationType;
    entity: 'counter';
    entityId: string;
    payload: unknown;
    timestamp: number;
}

export interface SyncState {
    lastSyncedAt: number | null;
    status: 'idle' | 'syncing' | 'offline' | 'error';
    queueLength: number;
}
