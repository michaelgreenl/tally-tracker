import { SyncManager } from '@/services/sync/manager';

export function useSync() {
    return {
        isSyncing: SyncManager.isSyncing,
    };
}
