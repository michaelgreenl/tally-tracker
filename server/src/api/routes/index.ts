import express from 'express';
import healthRoutes from './health.routes.js';
import userRoutes from './user.routes.js';
import counterRoutes from './counter.routes.js';

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/users', userRoutes);
router.use('/counters', counterRoutes);

export default router;
