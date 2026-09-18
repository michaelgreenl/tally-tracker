import express from 'express';
import rateLimit from 'express-rate-limit';
import { jwt } from '../../middleware/auth.middleware.js';
import { verifiedEmail } from '../../middleware/verified-email.middleware.js';
import { sync, webhook } from '../controllers/billing.controller.js';

const router = express.Router();
const syncLimiter = rateLimit({
    windowMs: 60_000,
    limit: 10,
    keyGenerator: (req) => req.user!.id,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Please wait before checking purchases again.' },
});

router.get('/eligibility', jwt, verifiedEmail, (req, res) => {
    res.json({ success: true, data: { userId: req.user!.id } });
});
// Restore, cancellation, and existing paid access do not depend on email verification.
router.post('/sync', jwt, syncLimiter, sync);
router.post('/revenuecat', webhook);

export default router;
