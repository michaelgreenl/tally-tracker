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
    id?: string; // Client-generated UUID for optimistic/offline creation
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

// Returns owned counters + counters shared with this user (ACCEPTED status)
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

// Authorization check: user must be the owner OR have an accepted share
export const getByIdOrShare = async ({ counterId, userId }: { counterId: string; userId: string }) =>
    await prisma.counter.findFirst({
        where: {
            id: counterId,
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
    });

// Returns all user IDs that should receive socket broadcasts for this counter
export const getParticipants = async (counterId: string) => {
    const counter = await prisma.counter.findUnique({
        where: { id: counterId },
        select: {
            userId: true,
            shares: {
                where: { status: 'ACCEPTED' as ShareStatusType },
                select: { userId: true },
            },
        },
    });

    if (!counter) return [];

    const ownerId = counter.userId;
    const sharedIds = counter.shares.map((s) => s.userId);

    return [ownerId, ...sharedIds];
};

export const put = async ({
    counterId,
    userId,
    data,
}: {
    counterId: string;
    userId: string;
    data: Prisma.CounterUpdateInput;
}) => {
    const counter = await getByIdOrShare({ counterId, userId });

    if (!counter) return null;

    return prisma.counter.update({
        where: { id: counterId },
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
    const counter = await getByIdOrShare({ counterId, userId });

    if (!counter) return null;

    // Atomic increment avoids race conditions on concurrent shared counter updates
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

// Uses the compound unique (counterId, userId) to target the specific share record
export const updateShare = ({
    counterId,
    userId,
    status,
}: {
    counterId: string;
    userId: string;
    status: ShareStatusType;
}) =>
    prisma.counterShare.update({
        where: {
            counterId_userId: {
                counterId,
                userId,
            },
        },
        data: {
            status,
        },
    });
