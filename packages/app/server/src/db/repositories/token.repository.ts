import prisma from '../prisma.js';
import { withLockedUser } from './user.repository.js';

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

export const rotate = async (id: string, expiresAt: Date, expectedUserId?: string) => {
    const initial = await get(id);
    if (!initial || (expectedUserId && initial.userId !== expectedUserId)) return null;
    return withLockedUser(initial.userId, async (user, tx) => {
        const now = new Date();
        const token = await tx.refreshToken.findUnique({ where: { id } });
        if (!user || !token || token.expiresAt <= now) return null;
        if (token.rotatedAt) {
            // A lost response can retry briefly, but cannot extend the grace or rotate twice.
            if (!token.replacementId || now.getTime() - token.rotatedAt.getTime() > 30_000) return null;
            const replacement = await tx.refreshToken.findUnique({ where: { id: token.replacementId } });
            return replacement &&
                replacement.userId === user.id &&
                !replacement.rotatedAt &&
                replacement.expiresAt > now
                ? { user, token: replacement }
                : null;
        }
        const replacement = await tx.refreshToken.create({ data: { userId: user.id, expiresAt } });
        await tx.refreshToken.update({ where: { id }, data: { rotatedAt: now, replacementId: replacement.id } });
        return { user, token: replacement };
    });
};

export const revokeSession = async (
    access: { id: string; sessionVersion: number } | null,
    refreshId?: string,
    expectedUserId?: string,
) => {
    const initial = refreshId ? await get(refreshId) : null;
    const userId = access?.id || initial?.userId;
    if (!userId) return null;
    if (expectedUserId && expectedUserId !== userId) throw Object.assign(new Error('Account changed'), { status: 401 });
    return withLockedUser(userId, async (user, tx) => {
        if (!user) return null;
        const refresh = refreshId ? await tx.refreshToken.findUnique({ where: { id: refreshId } }) : null;
        const validRefresh = refresh?.userId === userId && refresh.expiresAt > new Date();
        if (!validRefresh && access?.sessionVersion !== user.sessionVersion) return null;
        const revoked = await tx.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
        await tx.refreshToken.deleteMany({ where: { userId } });
        return { userId, sessionVersion: revoked.sessionVersion };
    });
};

export const deleteExpired = async () => {
    const { count } = await prisma.refreshToken.deleteMany({
        where: {
            expiresAt: { lt: new Date() },
        },
    });
    return count;
};
