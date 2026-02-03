import 'dotenv/config';
import cors from 'cors';

const getAllowedOrigins = () => {
    const { FRONTEND_URL } = process.env;
    return [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:8100',
        'capacitor://localhost',
        'http://localhost',
        FRONTEND_URL,
    ].filter(Boolean) as string[];
};

export const expressCorsOpts = {
    credentials: true,
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin) return callback(null, true);

        if (getAllowedOrigins().includes(origin)) return callback(null, true);

        const localNetwork = /^http:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?$/;

        if (localNetwork.test(origin)) return callback(null, true);

        console.log('Blocked by CORS:', origin);
        callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Requested-With', 'X-Idempotency-Key'],
};
