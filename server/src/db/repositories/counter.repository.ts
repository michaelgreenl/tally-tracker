import prisma from '../prisma.js';
import { Prisma } from '@prisma/client';

export const post = async ({
    userId,
    title,
    count,
    color,
}: {
    userId: string;
    title: string;
    count?: number;
    color?: string;
}) =>
    prisma.counter.create({
        data: { userId, title, count, color },
    });

export const remove = async ({ counterId, userId }: { counterId: string; userId: string }) =>
    prisma.counter.delete({ where: { id: counterId, userId: userId } });

export const getAllByUser = async (userId: string) =>
    prisma.counter.findMany({
        where: {
            userId,
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
