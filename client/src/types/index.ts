import type { ApiResponse } from '@/types/shared/responses';

// Re-used as the return type for all store actions, giving views a
// consistent { success, message? } contract without needing try/catch.
export type StoreResponse = ApiResponse<never>;
