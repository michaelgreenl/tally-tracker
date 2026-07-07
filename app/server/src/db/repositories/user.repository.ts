import prisma from '../prisma.js';
import { Prisma } from '@prisma/client';

type DbClient = typeof prisma | Prisma.TransactionClient;

const userSelectSchema = {
    id: true,
    email: true,
    tier: true,
    createdAt: true,
    updatedAt: true,
};

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
    prisma.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            ...userSelectSchema,
            sharedCounters: {
                select: { status: true, counter: true },
            },
        },
    });

export const getUserTierById = (userId: string, db: DbClient = prisma) =>
    db.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            id: true,
            tier: true,
        },
    });

export const getUserByEmail = (email: string) =>
    prisma.user.findUnique({
        where: {
            email,
        },
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
