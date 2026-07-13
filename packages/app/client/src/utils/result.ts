// Factory helpers for the StoreResponse type. Provides a consistent success/fail
// contract between stores and views without throwing errors for expected failures.
import type { StoreResponse } from '@/types/index';

export const ok = (): StoreResponse => ({
    success: true,
});

export const fail = (message: string): StoreResponse => ({
    success: false,
    message,
});
