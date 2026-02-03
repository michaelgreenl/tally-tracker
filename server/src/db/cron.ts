import prisma from './prisma.js';

export const startCleanupJob = () => {
    cleanup();
    setInterval(cleanup, 86400000);
};

const cleanup = async () => {
    try {
        console.log('[Maintenance] Cleaning up old idempotency keys...');

        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const { count } = await prisma.idempotencyLog.deleteMany({
            where: {
                createdAt: {
                    lt: twentyFourHoursAgo,
                },
            },
        });

        console.log(`[Maintenance] Deleted ${count} expired keys.`);
    } catch (error) {
        console.error('[Maintenance] Cleanup failed:', error);
    }
};
