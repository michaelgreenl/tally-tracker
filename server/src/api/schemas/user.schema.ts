import { z } from 'zod';

const phoneSchema = z.string().min(10, 'Phone number must be at least 10 digits');

export const createUserSchema = z.object({
    body: z
        .object({
            email: z.string().email('Invalid email format').optional(),
            phone: phoneSchema.optional(),
            password: z.string().min(6, 'Password must be at least 6 characters'),
        })
        .refine((data) => data.email || data.phone, {
            message: 'Either email or phone number is required',
            path: ['email'],
        }),
});

export const loginSchema = z.object({
    body: z
        .object({
            email: z.string().email().optional(),
            phone: z.string().optional(),
            password: z.string(),
        })
        .refine((data) => data.email || data.phone, {
            message: 'Either email or phone number is required to login',
            path: ['email'],
        }),
});

export const updateUserSchema = z.object({
    params: z.object({
        userId: z.string().uuid(),
    }),
    body: z.object({
        email: z.string().email().optional(),
        phone: phoneSchema.optional(),
        password: z.string().min(6).optional(),
    }),
});

export const deleteUserSchema = z.object({
    params: z.object({
        userId: z.string().uuid(),
    }),
});

export const getUsersSchema = z.object({
    query: z.object({
        limit: z.coerce.number().min(1).max(100).optional(),
        offset: z.coerce.number().min(0).optional(),
    }),
});
