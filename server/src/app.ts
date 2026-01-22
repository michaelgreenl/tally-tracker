import config from './config/index.js';
import express from 'express';

const app = express();

app.set('trust proxy', 1);

app.use(config);

export default app;
