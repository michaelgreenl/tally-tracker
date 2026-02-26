import prisma from '../prisma.js';
import { Prisma } from '@prisma/client';

const userSelectSchema = {
    id: true,
    email: true,
    phone: true,
    tier: true,
    createdAt: true,
    updatedAt: true,
};

export const createUser = async ({ email, phone, password }: { email?: string; phone?: string; password: string }) =>
    prisma.user.create({
        data: {
            email,
            phone,
            password,
        },
    });

export const deleteUser = async (userId: string) => prisma.user.delete({ where: { id: userId } });

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

export const getUserByEmail = (email: string) =>
    prisma.user.findUnique({
        where: {
            email,
        },
    });

export const getUserByPhone = (phone: string) =>
    prisma.user.findUnique({
        where: {
            phone,
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
