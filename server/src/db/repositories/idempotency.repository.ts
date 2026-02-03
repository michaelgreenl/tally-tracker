import prisma from '../prisma.js';
import { Prisma } from '@prisma/client';

export const get = (key: string) =>
    prisma.idempotencyLog.findUnique({
        where: { key },
    });

export const create = ({ key, userId }: { key: string; userId: string }) =>
    prisma.idempotencyLog.create({
        data: {
            key,
            userId,
        },
    });
