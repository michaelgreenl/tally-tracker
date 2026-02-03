import prisma from '../prisma.js';
import { Prisma } from '@prisma/client';

import type { ShareStatusType, CounterTypeType as CounterType } from '../../types/shared/generated/index.js';

export const post = async ({
    id,
    userId,
    title,
    count,
    color,
    type,
    inviteCode,
}: {
    id?: string;
    userId: string;
    title: string;
    count?: number;
    color?: string;
    type?: CounterType;
    inviteCode?: string;
}) => {
    return prisma.counter.create({
        data: {
            id,
            userId,
            title,
            count,
            color,
            type,
            inviteCode,
        },
    });
};

export const remove = async ({ counterId, userId }: { counterId: string; userId: string }) =>
    prisma.counter.delete({ where: { id: counterId, userId: userId } });

export const getAllByUser = async (userId: string) =>
    prisma.counter.findMany({
        where: {
            OR: [
                { userId: userId },
                {
                    shares: {
                        some: {
                            userId: userId,
                            status: 'ACCEPTED' as ShareStatusType,
                        },
                    },
                },
            ],
        },
        include: {
            shares: true,
            owner: {
                select: { email: true, id: true },
            },
        },
        orderBy: {
            updatedAt: 'desc',
        },
    });

export const getById = ({ counterId, userId }: { counterId: string; userId: string }) =>
    prisma.counter.findUnique({
        where: {
            id: counterId,
            userId,
        },
    });

export const put = ({
    counterId,
    userId,
    data,
}: {
    counterId: string;
    userId: string;
    data: Prisma.CounterUpdateInput;
}) => {
    return prisma.counter.update({
        where: { id: counterId, userId },
        data,
    });
};

export const increment = async ({
    counterId,
    userId,
    amount,
}: {
    counterId: string;
    userId: string;
    amount: number;
}) => {
    const counter = await prisma.counter.findFirst({ where: { id: counterId, userId } });
    if (!counter) return null;

    return prisma.counter.update({
        where: { id: counterId },
        data: {
            count: {
                increment: amount,
            },
        },
    });
};

export const join = (inviteCode: string) =>
    prisma.counter.findUnique({
        where: { inviteCode },
        include: {
            shares: true,
        },
    });

// export const removeShared = (counterId: string, userId: string) =>
//     // TODO:
//     prisma.counter.update({
//         where: { counterId },
//     });

export const createShare = ({
    counterId,
    userId,
    status,
}: {
    counterId: string;
    userId: string;
    status: ShareStatusType;
}) =>
    prisma.counterShare.create({
        data: {
            counterId,
            userId,
            status,
        },
    });
