import expressConfig from '../config/express.config.js';
import routes from '../api/routes/index.js';
import { errorHandler } from '../middleware/errorHandler.middleware.js';
import helmetConfig from './helmet.config.js';
import { limiter, speedLimiter } from './limiters.config.js';

import type { ErrorRequestHandler, RequestHandler } from 'express';

const config: Array<RequestHandler | ErrorRequestHandler> = [
    ...expressConfig,
    helmetConfig,
    limiter,
    speedLimiter,
    routes,
    errorHandler,
];

export default config;
