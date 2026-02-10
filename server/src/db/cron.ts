import prisma from './prisma.js';
import * as idempotencyRepository from './repositories/idempotency.repository.js';

export const startCleanupJob = () => {
    cleanup();
    setInterval(cleanup, 86400000);
};

const cleanup = async () => {
    try {
        console.log('[Maintenance] Cleaning up old idempotency keys...');

        const count = await idempotencyRepository.deleteMany();

        console.log(`[Maintenance] Deleted ${count} expired keys.`);
    } catch (error) {
        console.error('[Maintenance] Cleanup failed:', error);
    }
};
