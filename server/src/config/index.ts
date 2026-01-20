import expressConfig from '../config/express.config.js';
import routes from '../api/routes/index.js';
import { errorHandler } from '../middleware/errorHandler.middleware.js';

const config: Array<any> = [...expressConfig, routes, errorHandler];

export default config;
