import prisma from '../prisma.js';
import { Prisma } from '@prisma/client';

export const get = (key: string) =>
    prisma.idempotencyLog.findUnique({
        where: { key },
    });

export const create = ({ key, userId }: { key: string; userId: string }) =>
    prisma.idempotencyLog.create({
        data: {
            key,
            userId,
        },
    });

export const deleteMany = async () => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const { count } = await prisma.idempotencyLog.deleteMany({
        where: {
            createdAt: {
                lt: oneDayAgo,
            },
        },
    });

    return count;
};
