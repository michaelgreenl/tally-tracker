import 'dotenv/config';
import rateLimit from 'express-rate-limit';
import { loginRateLimitStore } from '../db/login-rate-limit.store.js';

import { Request } from 'express';

const skip = (_req: Request) => process.env.NODE_ENV === 'development';

export const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1500,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skip,
});

export const emailAuthLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { success: false, message: 'Too many email requests. Try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (_req: Request) => process.env.NODE_ENV !== 'production',
});

const loginOptions = {
    windowMs: 15 * 60 * 1000,
    message: { success: false, message: 'Too many sign-in attempts. Try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (_req: Request) => process.env.NODE_ENV !== 'production',
};

export const loginIpLimiter = rateLimit({
    ...loginOptions,
    limit: 30,
    store: loginRateLimitStore('login-ip'),
});

export const loginAccountLimiter = rateLimit({
    ...loginOptions,
    limit: 10,
    keyGenerator: (req) => req.body.email,
    store: loginRateLimitStore('login-account'),
});
