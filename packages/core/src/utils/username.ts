import { z } from 'zod';

export const usernameSchema = z
    .string()
    .trim()
    .min(3, 'Use at least 3 characters.')
    .regex(/^[a-zA-Z0-9_]+$/, 'Use letters, numbers, and underscores only.');
