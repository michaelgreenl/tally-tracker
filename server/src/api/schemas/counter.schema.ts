import { z } from 'zod';

const hexColorSchema = z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/, 'Must be a valid Hex color code (e.g., #ff0000)');

export const createCounterSchema = z.object({
    body: z.object({
        title: z.string().min(1, 'Title is required').max(50, 'Title is too long'),
        count: z.number().int().default(0).optional(),
        color: hexColorSchema.optional(),
    }),
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
        color: hexColorSchema.optional().or(z.literal(null)),
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
