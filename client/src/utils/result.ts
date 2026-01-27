import type { StoreResponse } from '@/types/index';

export const ok = (data?: any): StoreResponse => ({
    success: true,
    data,
});

export const fail = (message: string): StoreResponse => ({
    success: false,
    message,
});
