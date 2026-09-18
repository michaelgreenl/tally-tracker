import { z } from 'zod';

export function validateEnvironment(env: Record<string, string | undefined> = process.env) {
    if (env.NODE_ENV && !['development', 'test', 'production'].includes(env.NODE_ENV)) {
        throw new Error('Invalid configuration: NODE_ENV');
    }
    if (env.NODE_ENV !== 'production') return;

    const secret = z.string().refine((value) => value.trim().length >= 32);
    const billing = Boolean(env.REVENUECAT_SECRET_API_KEY || env.REVENUECAT_WEBHOOK_SECRET);
    const result = z
        .object({
            POSTGRES_URL: z.url({ protocol: /^postgres(ql)?$/, hostname: /.+/ }),
            JWT_SECRET: secret,
            EMAIL_OTP_SECRET: secret,
            RESEND_API_KEY: z.string().trim().min(1),
            EMAIL_FROM: z
                .string()
                .refine(
                    (value) =>
                        !/[\r\n]/.test(value) &&
                        z.email().safeParse(value.match(/^[^<>]+<([^<>]+)>$/)?.[1] ?? value).success,
                ),
            FRONTEND_URL: z.url({ protocol: /^https$/ }),
            PORT: z.coerce.number().int().min(1).max(65535).optional(),
            REVENUECAT_SECRET_API_KEY: billing ? z.string().trim().min(1) : z.string().optional(),
            REVENUECAT_WEBHOOK_SECRET: billing ? secret : z.string().optional(),
            REVENUECAT_ALLOW_SANDBOX: z.enum(['true', 'false']).optional(),
        })
        .refine((value) => value.JWT_SECRET !== value.EMAIL_OTP_SECRET, { path: ['EMAIL_OTP_SECRET'] })
        .safeParse(env);

    if (!result.success) {
        // Report field names only. Validation errors can otherwise include secret values.
        const fields = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
        throw new Error(`Invalid production configuration: ${fields.join(', ')}`);
    }
}
