import { z } from 'zod';

export function validateEnvironment(env: Record<string, string | undefined> = process.env) {
    if (env.NODE_ENV && !['development', 'test', 'production'].includes(env.NODE_ENV)) {
        throw new Error('Invalid configuration: NODE_ENV');
    }
    if (env.NODE_ENV !== 'production') return;

    const secret = z.string().refine((value) => value.trim().length >= 32);
    const billing = Boolean(env.REVENUECAT_SECRET_API_KEY || env.REVENUECAT_WEBHOOK_SECRET);
    const apple = [
        'APPLE_CLIENT_ID',
        'APPLE_TEAM_ID',
        'APPLE_KEY_ID',
        'APPLE_PRIVATE_KEY',
        'APPLE_TOKEN_ENCRYPTION_KEY',
    ].some((name) => Boolean(env[name]));
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
            GOOGLE_WEB_CLIENT_ID: z
                .string()
                .regex(/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/)
                .or(z.literal(''))
                .optional(),
            APPLE_CLIENT_ID: apple ? z.string().regex(/^[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/) : z.string().optional(),
            APPLE_TEAM_ID: apple ? z.string().regex(/^[A-Z0-9]{10}$/) : z.string().optional(),
            APPLE_KEY_ID: apple ? z.string().regex(/^[A-Z0-9]{10}$/) : z.string().optional(),
            APPLE_PRIVATE_KEY: apple
                ? z.string().regex(/-----BEGIN PRIVATE KEY-----[\s\S]+-----END PRIVATE KEY-----/)
                : z.string().optional(),
            APPLE_TOKEN_ENCRYPTION_KEY: apple ? z.string().regex(/^[a-f\d]{64}$/i) : z.string().optional(),
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
