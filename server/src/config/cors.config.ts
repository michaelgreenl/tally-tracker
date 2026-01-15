import cors from 'cors';

const getAllowedOrigins = () => {
    const { FRONTEND_URL } = process.env;
    return ['http://localhost:5173', 'http://localhost:5174', FRONTEND_URL].filter(Boolean) as string[];
};

export const expressCorsOpts = {
    origin: getAllowedOrigins(),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Requested-With'],
};

