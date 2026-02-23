// Note: SyncManager.isSyncing is a plain boolean, not a Vue ref.
// This works for one-time reads but won't trigger reactive UI updates.
import { SyncManager } from '@/services/sync/manager';

export function useSync() {
    return {
        isSyncing: SyncManager.isSyncing,
    };
}
