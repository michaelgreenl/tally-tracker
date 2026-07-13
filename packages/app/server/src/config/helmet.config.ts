import 'dotenv/config';
import helmet from 'helmet';

const helmetConfig = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
        },
    },
    // Disabled in production to avoid blocking cross-origin resources (API ↔ frontend)
    crossOriginEmbedderPolicy: process.env.NODE_ENV === 'development',
});

export default helmetConfig;
