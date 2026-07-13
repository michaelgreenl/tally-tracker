import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TEST_USER_ID } from '../../fixtures/counter.fixture.js';

const prismaMock = vi.hoisted(() => {
    const tx = {
        idempotencyLog: {
            deleteMany: vi.fn(),
        },
        user: {
            deleteMany: vi.fn(),
        },
    };

    const prisma = {
        $transaction: vi.fn((handler: (txClient: typeof tx) => Promise<unknown>) => handler(tx)),
    };

    return { prisma, tx };
});

vi.mock('../../../src/db/prisma', () => ({
    default: prismaMock.prisma,
}));

import { deleteAccount } from '../../../src/db/repositories/user.repository.js';

describe('user repository account deletion', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should delete user idempotency logs before deleting the user', async () => {
        prismaMock.tx.idempotencyLog.deleteMany.mockResolvedValue({ count: 2 });
        prismaMock.tx.user.deleteMany.mockResolvedValue({ count: 1 });

        const result = await deleteAccount(TEST_USER_ID);

        expect(prismaMock.prisma.$transaction).toHaveBeenCalledOnce();
        expect(prismaMock.tx.idempotencyLog.deleteMany).toHaveBeenCalledWith({
            where: { userId: TEST_USER_ID },
        });
        expect(prismaMock.tx.user.deleteMany).toHaveBeenCalledWith({
            where: { id: TEST_USER_ID },
        });
        expect(prismaMock.tx.idempotencyLog.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
            prismaMock.tx.user.deleteMany.mock.invocationCallOrder[0],
        );
        expect(result).toEqual({
            deleted: true,
            idempotencyLogsDeleted: 2,
        });
    });

    it('should return not deleted when the user row is already missing', async () => {
        prismaMock.tx.idempotencyLog.deleteMany.mockResolvedValue({ count: 0 });
        prismaMock.tx.user.deleteMany.mockResolvedValue({ count: 0 });

        const result = await deleteAccount(TEST_USER_ID);

        expect(result).toEqual({
            deleted: false,
            idempotencyLogsDeleted: 0,
        });
    });
});
