import expressConfig from '../config/express.config.js';
import routes from '../api/routes/index.js';
import { errorHandler } from '../middleware/errorHandler.middleware.js';
import helmetConfig from './helmet.config.js';
import { limiter, speedLimiter } from './limiters.config.js';

const config: Array<any> = [...expressConfig, helmetConfig, limiter, speedLimiter, routes, errorHandler];

export default config;
