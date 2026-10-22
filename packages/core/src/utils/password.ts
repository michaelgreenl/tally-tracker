import { z } from 'zod';

export const PASSWORD_RULES = [
    {
        id: 'length',
        label: '8+ characters',
        message: 'Password must be at least 8 characters.',
        test: (value: string) => [...value].length >= 8,
    },
    {
        id: 'uppercase',
        label: '1 uppercase letter',
        message: 'Password must include at least 1 uppercase letter.',
        test: (value: string) => /[A-Z]/.test(value),
    },
    {
        id: 'number',
        label: '1 number',
        message: 'Password must include at least 1 number.',
        test: (value: string) => /[0-9]/.test(value),
    },
] as const;

export const loginPasswordSchema = z.string().min(1, 'Password is required.');

export const passwordSchema = PASSWORD_RULES.reduce(
    (schema, rule) => schema.refine(rule.test, rule.message),
    loginPasswordSchema,
);
