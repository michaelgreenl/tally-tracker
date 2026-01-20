import 'dotenv/config';
import jwt from 'jsonwebtoken';

const { JWT_SECRET } = process.env;

export default {
    sign: (obj = {}) =>
        jwt.sign(obj, JWT_SECRET as string, {
            expiresIn: 60 * 60 * 24, // 24 hours
            issuer: 'reaction-api',
            audience: 'reaction-client',
        }),
    verify: (token: string) =>
        jwt.verify(token, JWT_SECRET as string, {
            issuer: 'reaction-api',
            audience: 'reaction-client',
        }),
};
