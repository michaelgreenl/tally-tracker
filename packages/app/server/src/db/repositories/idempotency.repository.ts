import prisma from '../prisma.js';

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
