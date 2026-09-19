import { loginPasswordSchema, passwordSchema } from '@tally/core';
import { z } from 'zod';

export const createUserSchema = z.object({
    body: z
        .object({
            email: z.string().email('Invalid email format'),
            password: passwordSchema,
        })
        .refine((data) => data.email, {
            message: 'Email is required to login',
            path: ['email'],
        }),
});

export const loginSchema = z.object({
    body: z.object({
        email: z.string().trim().toLowerCase().email(),
        password: loginPasswordSchema,
        rememberMe: z.boolean().optional(),
    }),
});

export const googleLoginSchema = z.object({
    body: z.object({
        idToken: z.string().min(1).max(8192),
        password: loginPasswordSchema.optional(),
        rememberMe: z.boolean().optional(),
    }),
});

const refreshTokenBodySchema = z.object({
    body: z
        .object({
            refreshToken: z.string().uuid().optional(),
        })
        .optional(),
});

export const refreshSchema = refreshTokenBodySchema;
export const logoutSchema = refreshTokenBodySchema;

const emailSchema = z.string().trim().email('Invalid email format');
const codeSchema = z.string().regex(/^\d{6}$/, 'Code must contain six digits');

export const emailAddressSchema = z.object({
    body: z.object({ email: emailSchema }),
});

export const emailOtpSchema = z.object({
    body: z.object({ email: emailSchema, code: codeSchema }),
});

export const passwordResetSchema = z.object({
    body: z.object({
        email: emailSchema,
        code: codeSchema,
        password: passwordSchema,
    }),
});
