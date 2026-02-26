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
            rememberMe: z.boolean().optional(),
        })
        .refine((data) => data.email || data.phone, {
            message: 'Either email or phone number is required to login',
            path: ['email'],
        }),
});

export const refreshSchema = z.object({
    body: z.object({
        refreshToken: z.string().uuid().optional(),
    }),
});

export const updateUserSchema = z.object({
    body: z.object({
        tier: z.string().optional(),
        email: z.string().email().optional(),
        phone: phoneSchema.optional(),
        password: z.string().min(6).optional(),
    }),
});
