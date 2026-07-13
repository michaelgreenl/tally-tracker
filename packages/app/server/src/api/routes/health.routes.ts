import express from 'express';
import { checkHealth } from '../controllers/health.controller.js';

const healthRoutes = express.Router();

healthRoutes.get('/', checkHealth);

export default healthRoutes;
