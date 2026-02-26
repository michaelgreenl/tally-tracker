import 'dotenv/config';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

import { Request } from 'express';

const skip = (req: Request) => (process.env.NODE_ENV === 'development' ? true : false);

export const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1500,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skip,
});

export const speedLimiter = slowDown({
    windowMs: 15 * 60 * 1000,
    delayAfter: 1500,
    delayMs: (used, req) => {
        const delayAfter = req.slowDown.limit;
        return (used - delayAfter) * 500;
    },
    skip,
});
