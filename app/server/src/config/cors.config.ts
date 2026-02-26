import 'dotenv/config';
import cors from 'cors';

const getAllowedOrigins = () => {
    const { FRONTEND_URL } = process.env;
    return [
        'http://localhost:5173',
        'http://localhost:8100',
        'capacitor://localhost', // iOS WebView
        'http://localhost', // Android WebView
        FRONTEND_URL,
    ].filter(Boolean) as string[];
};

const corsOrigin = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // No origin = same-origin or non-browser request (e.g., curl, Postman)
    if (!origin) return callback(null, true);

    if (getAllowedOrigins().includes(origin)) return callback(null, true);

    // Allow local network IPs for testing on physical devices during development
    const localNetwork = /^http:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?$/;
    if (localNetwork.test(origin)) return callback(null, true);

    console.log('Blocked by CORS:', origin);
    callback(new Error('Not allowed by CORS'));
};

export const expressCorsOpts = {
    credentials: true,
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Requested-With', 'X-Idempotency-Key'],
};

export const socketCorsOpts = {
    credentials: true,
    origin: corsOrigin,
    methods: ['GET', 'POST'],
};
