import express from 'express';
import cors from 'cors';
import { expressCorsOpts } from './cors.config.js';
import cookieParser from 'cookie-parser';

const expressConfig = [cors(expressCorsOpts), express.json(), express.urlencoded({ extended: true }), cookieParser()];

export default expressConfig;
