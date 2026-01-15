import { expressCorsOpts } from './cors.config.js';
import express from 'express';
import cors from 'cors';

const expressConfig = [cors(expressCorsOpts), express.json(), express.urlencoded({ extended: true })];

export default expressConfig;
