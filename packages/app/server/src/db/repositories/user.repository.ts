import prisma from '../prisma.js';
import { Prisma } from '@prisma/client';
import type { User } from '@prisma/client';

type DbClient = typeof prisma | Prisma.TransactionClient;

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

export const deleteUser = deleteAccount;

export const getAllUsers = async ({ limit, offset }: { limit: number; offset: number }) =>
    prisma.user.findMany({
        take: limit,
        skip: offset,
        select: userSelectSchema,
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
        select: { id: true, email: true, sessionVersion: true },
    });

export const updateUserInfo = (userId: string, data: Prisma.UserUpdateInput) =>
    prisma.user
        .update({
            where: {
                id: userId,
            },
            data,
        })
        .then(() => true);
