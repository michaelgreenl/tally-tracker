import { z } from 'zod';

export const PASSWORD_REQUIREMENTS = '6+ characters, 1 uppercase letter, 1 number.';

export const passwordSchema = z
    .string()
    .min(6, 'Password must be at least 6 characters.')
    .regex(/[A-Z]/, 'Password must include at least 1 uppercase letter.')
    .regex(/[0-9]/, 'Password must include at least 1 number.');
