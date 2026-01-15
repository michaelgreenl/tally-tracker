import express from 'express';
import healthRoutes from './health.routes.js';
import userRoutes from './user.routes.js';

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/users', userRoutes);

export default router;
