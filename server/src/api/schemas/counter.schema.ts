import { z } from 'zod';

import { HexColorSchema } from '../../types/shared/index.js';
import { CounterTypeSchema } from '../../types/shared/generated/index.js';

export const createCounterSchema = z.object({
    body: z
        .object({
            id: z.string().uuid('Invalid UUID').optional(),
            title: z.string().min(1, 'Title is required').max(50, 'Title is too long'),
            count: z.number().int().default(0).optional(),
            color: HexColorSchema.optional(),
            type: CounterTypeSchema.optional(),
            inviteCode: z.string().optional(),
        })
        .refine(
            (data) => {
                if (data.type === 'SHARED') {
                    return !!data.inviteCode;
                }

                return true;
            },
            {
                message: 'Shared counters must have an invite code',
                path: ['inviteCode'],
            },
        ),
});

export const deleteCounterSchema = z.object({
    params: z.object({
        counterId: z.string().uuid('Invalid Counter ID'),
    }),
});

export const getCounterSchema = z.object({
    params: z.object({
        counterId: z.string().uuid('Invalid Counter ID'),
    }),
});

export const updateCounterSchema = z.object({
    params: z.object({
        counterId: z.string().uuid('Invalid Counter ID'),
    }),
    body: z.object({
        title: z.string().min(1).max(50).optional(),
        count: z.number().int().positive().optional(),
        color: HexColorSchema.optional().or(z.literal(null)),
        type: CounterTypeSchema.optional(),
    }),
});

export const incrementCounterSchema = z.object({
    params: z.object({
        counterId: z.string().uuid('Invalid Counter ID'),
    }),
    body: z.object({
        amount: z.number().int(),
    }),
});
