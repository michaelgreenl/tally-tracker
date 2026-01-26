import { Request, Response, NextFunction } from 'express';
import prisma from '../db/prisma.js';
import { OK_NO_CONTENT } from '../constants.js';

export const idempotency = async (req: Request, res: Response, next: NextFunction) => {
    const key = req.headers['x-idempotency-key'] as string;

    if (!key) {
        return next();
    }

    try {
        const userId = req.user?.id;
        if (!userId) return next();

        const existing = await prisma.idempotencyLog.findUnique({
            where: { key },
        });

        if (existing) {
            console.log(`[Idempotency] Skipping duplicate request: ${key}`);
            return res.status(OK_NO_CONTENT).send();
        }

        await prisma.idempotencyLog.create({
            data: {
                key,
                userId,
            },
        });

        next();
    } catch (error) {
        console.error('[Idempotency] Error:', error);
        return res.status(OK_NO_CONTENT).send();
    }
};
