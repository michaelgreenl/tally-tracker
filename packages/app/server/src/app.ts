import config from './config/index.js';
import express from 'express';

const app = express();

app.use(config);

export default app;
