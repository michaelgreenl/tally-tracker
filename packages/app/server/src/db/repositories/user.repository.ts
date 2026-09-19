import prisma from '../prisma.js';
import { Prisma } from '@prisma/client';
import type { User } from '@prisma/client';

type DbClient = typeof prisma | Prisma.TransactionClient;

// Login, refresh, logout, and socket admission share this lock and session version.
export const withLockedUser = <T>(
    userId: string,
    action: (user: User | null, tx: Prisma.TransactionClient) => Promise<T>,
) =>
    prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
        const user = withCurrentTier(await tx.user.findUnique({ where: { id: userId } }));
        return action(user, tx);
    });

const userSelectSchema = {
    id: true,
    email: true,
    tier: true,
    premiumExpiresAt: true,
    billingSandbox: true,
    emailVerifiedAt: true,
    createdAt: true,
    updatedAt: true,
};

// An expired cached grant cannot keep access when a webhook is delayed or missed.
const withCurrentTier = <T extends Pick<User, 'tier' | 'premiumExpiresAt' | 'billingSandbox'>>(
    user: T | null,
): T | null =>
    user?.tier === 'PREMIUM' &&
    ((user.premiumExpiresAt && user.premiumExpiresAt.getTime() <= Date.now()) ||
        (user.billingSandbox && process.env.REVENUECAT_ALLOW_SANDBOX !== 'true'))
        ? { ...user, tier: 'BASIC' }
        : user;

export const createUser = async ({ email, password }: { email: string; password: string }) =>
    prisma.user.create({
        data: {
            email,
            password,
        },
    });

export const deleteAccount = async (userId: string) =>
    prisma.$transaction(async (tx) => {
        const idempotencyLogs = await tx.idempotencyLog.deleteMany({
            where: { userId },
        });

        const users = await tx.user.deleteMany({
            where: { id: userId },
        });

        return {
            deleted: users.count > 0,
            idempotencyLogsDeleted: idempotencyLogs.count,
        };
    });

export const getUserById = (userId: string) =>
    prisma.user
        .findUnique({
            where: {
                id: userId,
            },
            select: {
                ...userSelectSchema,
                sharedCounters: {
                    select: { status: true, counter: true },
                },
            },
        })
        .then(withCurrentTier);

export const getUserTierById = (userId: string, db: DbClient = prisma) =>
    db.user
        .findUnique({
            where: {
                id: userId,
            },
            select: {
                id: true,
                tier: true,
                premiumExpiresAt: true,
                billingSandbox: true,
            },
        })
        .then((user) => {
            const current = withCurrentTier(user);
            return current ? { id: current.id, tier: current.tier } : null;
        });

export const getUserByEmail = (email: string) =>
    prisma.user
        .findUnique({
            where: {
                email,
            },
        })
        .then(withCurrentTier);

export const getUserByGoogleSubject = (googleSubject: string) =>
    prisma.user.findUnique({ where: { googleSubject } }).then(withCurrentTier);

export const createGoogleUser = (googleSubject: string, email: string, emailVerified: boolean) =>
    prisma.user.create({
        data: { googleSubject, email, emailVerifiedAt: emailVerified ? new Date() : null },
    });

export const linkGoogle = (user: User, googleSubject: string, emailVerified: boolean) =>
    withLockedUser(user.id, async (current, tx) => {
        if (
            !current ||
            current.password !== user.password ||
            current.sessionVersion !== user.sessionVersion ||
            current.email !== user.email ||
            (current.googleSubject && current.googleSubject !== googleSubject)
        )
            return null;
        return tx.user.update({
            where: { id: user.id },
            data: {
                googleSubject,
                emailVerifiedAt: current.emailVerifiedAt ?? (emailVerified ? new Date() : null),
            },
        });
    });

export const updateBillingEntitlement = (
    userId: string,
    data: Pick<User, 'tier' | 'premiumExpiresAt' | 'billingSandbox'> & { billingCheckedAt: Date },
) =>
    prisma.user.updateMany({
        where: {
            id: userId,
            OR: [{ billingCheckedAt: null }, { billingCheckedAt: { lt: data.billingCheckedAt } }],
        },
        data,
    });

export const getUserAuthById = (userId: string) =>
    prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, sessionVersion: true, emailVerifiedAt: true },
    });
