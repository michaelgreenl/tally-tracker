import { createHash } from 'crypto';
import { CONFLICT, OK_NO_CONTENT } from '@tally/utils';
import { Prisma } from '@prisma/client';
import prisma from '../db/prisma.js';

import type { Request } from 'express';
import type { ApiResponse } from '@tally/core';

export type TransactionClient = Prisma.TransactionClient;

export type IdempotentResponse<TBody = unknown> = {
    status: number;
    body?: TBody;
};

export type IdempotentResult<TBody = unknown> = IdempotentResponse<TBody> & {
    replayed: boolean;
};

type MutationHandler<TBody> = (tx: TransactionClient) => Promise<IdempotentResponse<TBody>>;

const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) {
        return value.map(normalize);
    }

    if (value && typeof value === 'object') {
        return Object.keys(value)
            .sort()
            .reduce<Record<string, unknown>>((acc, key) => {
                acc[key] = normalize((value as Record<string, unknown>)[key]);
                return acc;
            }, {});
    }

    return value;
};

const hashRequest = (req: Request): string => {
    const payload = {
        method: req.method,
        path: req.originalUrl,
        body: normalize(req.body),
    };

    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
};

const toJsonValue = (body: unknown) => {
    if (body === undefined) return Prisma.JsonNull;

    return JSON.parse(JSON.stringify(body)) as Prisma.InputJsonValue;
};

const isUniqueConstraintError = (error: unknown): error is Prisma.PrismaClientKnownRequestError =>
    typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';

const conflictResponse = (message: string): IdempotentResult<ApiResponse<null>> => ({
    status: CONFLICT,
    body: { success: false, message },
    replayed: true,
});

const replayExisting = async <TBody>(
    key: string,
    userId: string,
    requestHash: string,
): Promise<IdempotentResult<TBody | ApiResponse<null>>> => {
    const existing = await prisma.idempotencyLog.findUnique({ where: { key } });

    if (!existing) {
        throw new Error(`Idempotency conflict for ${key} did not resolve to an existing log.`);
    }

    if (existing.userId !== userId) {
        return conflictResponse('Idempotency key was already used by another user.');
    }

    if (existing.requestHash && existing.requestHash !== requestHash) {
        return conflictResponse('Idempotency key was already used for a different request.');
    }

    if (existing.status !== 'COMPLETED') {
        return conflictResponse('Idempotent request is still processing.');
    }

    if (!existing.responseStatus) {
        return { status: OK_NO_CONTENT, replayed: true };
    }

    return {
        status: existing.responseStatus,
        body: existing.responseBody as TBody,
        replayed: true,
    };
};

export const runIdempotentMutation = async <TBody>(
    req: Request,
    mutation: MutationHandler<TBody>,
): Promise<IdempotentResult<TBody | ApiResponse<null>>> => {
    const key = req.headers['x-idempotency-key'];
    const userId = req.user?.id;

    if (typeof key !== 'string' || !userId) {
        const response = await mutation(prisma);
        return { ...response, replayed: false };
    }

    const requestHash = hashRequest(req);

    try {
        const response = await prisma.$transaction(async (tx) => {
            await tx.idempotencyLog.create({
                data: {
                    key,
                    userId,
                    requestHash,
                    status: 'IN_PROGRESS',
                },
            });

            const mutationResponse = await mutation(tx);

            await tx.idempotencyLog.update({
                where: { key },
                data: {
                    status: 'COMPLETED',
                    responseStatus: mutationResponse.status,
                    responseBody: toJsonValue(mutationResponse.body),
                },
            });

            return mutationResponse;
        });

        return { ...response, replayed: false };
    } catch (error) {
        if (isUniqueConstraintError(error)) {
            return replayExisting<TBody>(key, userId, requestHash);
        }

        throw error;
    }
};
