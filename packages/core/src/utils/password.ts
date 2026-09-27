import { z } from 'zod';

export const PASSWORD_REQUIREMENTS = '8+ characters, 1 uppercase letter, 1 number.';

export const loginPasswordSchema = z.string().min(1, 'Password is required.');

export const passwordSchema = loginPasswordSchema
    .refine((value) => [...value].length >= 8, 'Password must be at least 8 characters.')
    .regex(/[A-Z]/, 'Password must include at least 1 uppercase letter.')
    .regex(/[0-9]/, 'Password must include at least 1 number.');
