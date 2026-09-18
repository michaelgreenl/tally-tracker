import { createHash } from 'node:crypto';
import type { Store } from 'express-rate-limit';
import prisma from './prisma.js';

export function loginRateLimitStore(prefix: string): Store {
    let windowMs: number;
    const keyFor = (key: string) => createHash('sha256').update(`${prefix}:${key}`).digest('hex');
    return {
        prefix,
        localKeys: false,
        init(options) {
            windowMs = options.windowMs;
        },
        async increment(key) {
            // One atomic statement shares the limit across restarts and server instances.
            const [row] = await prisma.$queryRaw<{ totalHits: number; resetTime: Date }[]>`
                INSERT INTO login_rate_limits (key, hits, reset_at)
                VALUES (${keyFor(key)}, 1, CURRENT_TIMESTAMP + ${windowMs} * INTERVAL '1 millisecond')
                ON CONFLICT (key) DO UPDATE SET
                    hits = CASE WHEN login_rate_limits.reset_at <= CURRENT_TIMESTAMP THEN 1 ELSE login_rate_limits.hits + 1 END,
                    reset_at = CASE WHEN login_rate_limits.reset_at <= CURRENT_TIMESTAMP
                        THEN CURRENT_TIMESTAMP + ${windowMs} * INTERVAL '1 millisecond' ELSE login_rate_limits.reset_at END
                RETURNING hits AS "totalHits", reset_at AS "resetTime"
            `;
            return row;
        },
        async decrement() {
            // Count every attempt. Late responses must not subtract from a newer window.
        },
        async resetKey(key) {
            await prisma.loginRateLimit.deleteMany({ where: { key: keyFor(key) } });
        },
    };
}
