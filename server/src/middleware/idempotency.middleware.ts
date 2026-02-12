import { Request, Response, NextFunction } from 'express';
import prisma from '../db/prisma.js';
import { OK_NO_CONTENT } from '../constants.js';
import * as idempotencyRepository from '../db/repositories/idempotency.repository.js';

export const idempotency = async (req: Request, res: Response, next: NextFunction) => {
    const key = req.headers['x-idempotency-key'] as string;

    // No key = not an offline-synced request, skip.
    if (!key) {
        return next();
    }

    try {
        const userId = req.user?.id;
        if (!userId) return next();

        const existing = await idempotencyRepository.get(key);

        if (existing) {
            console.log(`[Idempotency] Skipping duplicate request: ${key}`);
            return res.status(OK_NO_CONTENT).send();
        }

        await idempotencyRepository.create({ key, userId });

        next();
    } catch (error) {
        // Fail open — better to risk a duplicate than block the client's sync queue
        console.error('[Idempotency] Error:', error);
        return res.status(OK_NO_CONTENT).send();
    }
};
