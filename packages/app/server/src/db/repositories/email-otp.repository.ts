import prisma from '../prisma.js';

import type { EmailOtpPurpose, Prisma } from '@prisma/client';

const MAX_ATTEMPTS = 5;

export const issue = (userId: string, purpose: EmailOtpPurpose, digest: string, expiresAt: Date) => {
    const createdAt = new Date();

    return prisma.emailOtp.upsert({
        where: { userId_purpose: { userId, purpose } },
        create: { userId, purpose, digest, expiresAt },
        update: { digest, expiresAt, createdAt, consumedAt: null, attempts: 0 },
    });
};

const consume = async (
    userId: string,
    purpose: EmailOtpPurpose,
    digest: string,
    onConsume: (tx: Prisma.TransactionClient, now: Date) => Promise<unknown>,
) =>
    prisma.$transaction(async (tx) => {
        const now = new Date();
        const activeCode = {
            userId,
            purpose,
            consumedAt: null,
            expiresAt: { gt: now },
            attempts: { lt: MAX_ATTEMPTS },
        } as const;
        const consumed = await tx.emailOtp.updateMany({
            where: { ...activeCode, digest },
            data: { consumedAt: now },
        });

        if (consumed.count === 1) {
            await onConsume(tx, now);
            return true;
        }

        await tx.emailOtp.updateMany({
            where: activeCode,
            data: { attempts: { increment: 1 } },
        });
        return false;
    });

export const verifyEmail = (userId: string, digest: string) =>
    consume(userId, 'EMAIL_VERIFICATION', digest, (tx, now) =>
        tx.user.update({
            where: { id: userId },
            data: { emailVerifiedAt: now },
        }),
    );

export const resetPassword = (userId: string, digest: string, password: string) =>
    consume(userId, 'PASSWORD_RESET', digest, async (tx) => {
        await tx.user.update({
            where: { id: userId },
            data: { password, sessionVersion: { increment: 1 } },
        });
        await tx.refreshToken.deleteMany({ where: { userId } });
    });
