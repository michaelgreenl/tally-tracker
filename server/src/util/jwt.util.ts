import 'dotenv/config';
import jwt from 'jsonwebtoken';

import type { StringValue } from 'ms';

const { JWT_SECRET } = process.env;

export default {
    // expiresIn defaults to 15m (when refresh tokens are in play).
    // Pass '1d' for browser sessions without remember me.
    sign: (payload = {}, expiresIn: StringValue = '15m') =>
        jwt.sign(payload, JWT_SECRET as string, {
            expiresIn,
            issuer: 'reaction-api',
            audience: 'reaction-client',
        }),
    verify: (token: string) =>
        jwt.verify(token, JWT_SECRET as string, {
            issuer: 'reaction-api',
            audience: 'reaction-client',
        }),
};
