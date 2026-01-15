import expressConfig from '../config/express.config.js';
import routes from '../api/routes/index.js';
import { errorHandler } from '../middleware/errorHandler.middleware.js';
import cookieParser from 'cookie-parser';

const config: Array<any> = [...expressConfig, routes, errorHandler, cookieParser];

export default config;
