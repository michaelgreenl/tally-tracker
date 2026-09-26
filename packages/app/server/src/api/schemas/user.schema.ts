import { emailSchema, loginPasswordSchema, passwordSchema } from '@tally/core';
import { z } from 'zod';

export const createUserSchema = z.object({
    body: z
        .object({
            email: emailSchema,
            password: passwordSchema,
        })
        .refine((data) => data.email, {
            message: 'Email is required to login',
            path: ['email'],
        }),
});

export const loginSchema = z.object({
    body: z.object({
        email: emailSchema.toLowerCase(),
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

export const appleLoginSchema = z.object({
    body: z.object({
        authorizationCode: z.string().min(1).max(8192),
        nonce: z.string().uuid(),
        rememberMe: z.boolean().optional(),
    }),
});

export const appleNotificationSchema = z.object({
    body: z.object({ payload: z.string().min(1).max(16384) }),
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
