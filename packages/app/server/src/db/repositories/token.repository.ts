import prisma from '../prisma.js';

export const create = async ({ userId, expiresAt }: { userId: string; expiresAt: Date }) =>
    prisma.refreshToken.create({
        data: { userId, expiresAt },
    });

export const get = async (id: string) =>
    prisma.refreshToken.findUnique({
        where: { id },
    });

export const remove = async (id: string) =>
    prisma.refreshToken.delete({
        where: { id },
    });

export const removeAllForUser = async (userId: string) =>
    prisma.refreshToken.deleteMany({
        where: { userId },
    });

export const deleteExpired = async () => {
    const { count } = await prisma.refreshToken.deleteMany({
        where: {
            expiresAt: { lt: new Date() },
        },
    });
    return count;
};
