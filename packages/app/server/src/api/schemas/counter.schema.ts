import { z } from 'zod';

import {
    HexColorSchema,
    counterTitleSchema,
    counterValueSchema,
    counterIncrementSchema,
    counterMetricSchema,
} from '@tally/core';

const createCounterBaseSchema = z.strictObject({
    id: z.string().uuid('Invalid UUID').optional(),
    title: counterTitleSchema,
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
        title: counterTitleSchema.optional(),
        color: HexColorSchema.optional().or(z.literal(null)),
        metric: counterMetricSchema.optional(),
        increment: counterIncrementSchema.optional(),
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
