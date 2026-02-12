import prisma from './prisma.js';
import * as idempotencyRepository from './repositories/idempotency.repository.js';
import * as tokenRepository from './repositories/token.repository.js';

export const startCleanupJob = () => {
    cleanup();
    setInterval(cleanup, 86400000);
};

const cleanup = async () => {
    try {
        console.log('[Maintenance] Running cleanup...');

        const idempotencyCount = await idempotencyRepository.deleteMany();
        console.log(`[Maintenance] Deleted ${idempotencyCount} expired idempotency keys.`);

        const tokenCount = await tokenRepository.deleteExpired();
        console.log(`[Maintenance] Deleted ${tokenCount} expired refresh tokens.`);
    } catch (error) {
        console.error('[Maintenance] Cleanup failed:', error);
    }
};
