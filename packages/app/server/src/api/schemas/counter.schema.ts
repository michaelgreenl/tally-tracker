import { z } from 'zod';

import { HexColorSchema, counterValueSchema, counterIncrementSchema, counterMetricSchema } from '@tally/core';

const createCounterBaseSchema = z.strictObject({
    id: z.string().uuid('Invalid UUID').optional(),
    title: z.string().min(1, 'Title is required').max(50, 'Title is too long'),
    count: counterValueSchema.default(0).optional(),
    color: HexColorSchema.optional(),
    metric: counterMetricSchema.optional(),
    increment: counterIncrementSchema.optional(),
});

export const createCounterSchema = z.object({
    body: createCounterBaseSchema,
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
    body: z.strictObject({
        title: z.string().min(1).max(50).optional(),
        color: HexColorSchema.optional().or(z.literal(null)),
        metric: counterMetricSchema.optional(),
        increment: counterIncrementSchema.optional(),
    }),
});

export const setCounterCountSchema = z.object({
    params: z.object({
        counterId: z.string().uuid('Invalid Counter ID'),
    }),
    body: z.strictObject({
        count: counterValueSchema,
    }),
});

export const incrementCounterSchema = z.object({
    params: z.object({
        counterId: z.string().uuid('Invalid Counter ID'),
    }),
    body: z.object({
        amount: counterValueSchema,
    }),
});

export const joinCounterSchema = z.object({
    body: z.object({
        inviteCode: z.string(),
    }),
});

export const updateShareSchema = z.object({
    params: z.object({
        counterId: z.string().uuid('Invalid Counter ID'),
    }),
});
