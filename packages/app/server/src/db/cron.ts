import * as tokenRepository from './repositories/token.repository.js';
import { captureServerError } from '../monitoring/sentry.js';
import prisma from './prisma.js';

export const startCleanupJob = () => {
    cleanup();
    setInterval(cleanup, 86400000);
};

export const cleanup = async () => {
    try {
        console.log('[Maintenance] Running cleanup...');

        const tokenCount = await tokenRepository.deleteExpired();
        console.log(`[Maintenance] Deleted ${tokenCount} expired refresh tokens.`);
        await prisma.loginRateLimit.deleteMany({ where: { resetAt: { lte: new Date() } } });
    } catch (error) {
        captureServerError(error, { source: 'maintenance.cleanup' });
        console.error('[Maintenance] Cleanup failed.');
    }
};
