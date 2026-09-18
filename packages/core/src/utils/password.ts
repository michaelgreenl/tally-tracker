import { z } from 'zod';

export const PASSWORD_REQUIREMENTS = '15+ characters, 1 uppercase letter, 1 number.';

export const loginPasswordSchema = z
    .string()
    .min(1, 'Password is required.')
    .max(72, 'Password is too long. Use fewer characters.')
    // bcrypt only uses the first 72 UTF-8 bytes. Never silently accept a truncated password.
    .refine((value) => new TextEncoder().encode(value).length <= 72, 'Password is too long. Use fewer characters.');

export const passwordSchema = loginPasswordSchema
    .refine((value) => [...value].length >= 15, 'Password must be at least 15 characters.')
    .regex(/[A-Z]/, 'Password must include at least 1 uppercase letter.')
    .regex(/[0-9]/, 'Password must include at least 1 number.');
