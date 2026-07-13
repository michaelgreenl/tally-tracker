import { afterAll, beforeEach } from 'vitest';
import { assertIntegrationDatabaseSafety } from './test-database.js';

assertIntegrationDatabaseSafety();

const { default: prisma } = await import('../../src/db/prisma.js');

beforeEach(async () => {
    await prisma.$transaction([
        prisma.counterShare.deleteMany(),
        prisma.refreshToken.deleteMany(),
        prisma.counter.deleteMany(),
        prisma.idempotencyLog.deleteMany(),
        prisma.user.deleteMany(),
    ]);
});

afterAll(async () => {
    await prisma.$disconnect();
});
