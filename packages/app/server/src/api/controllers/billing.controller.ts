import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { syncRevenueCatCustomer } from '../../services/revenuecat.service.js';
import { captureServerError } from '../../monitoring/sentry.js';
import type { Request, Response } from 'express';

const webhookSchema = z.object({
    event: z.object({
        id: z.string().min(1),
        type: z.string().min(1),
        app_user_id: z.string().optional(),
        original_app_user_id: z.string().optional(),
        aliases: z.array(z.string()).max(50).optional(),
        transferred_from: z.array(z.string()).max(50).optional(),
        transferred_to: z.array(z.string()).max(50).optional(),
    }),
});

export const sync = async (req: Request, res: Response) => {
    if (!process.env.REVENUECAT_SECRET_API_KEY) {
        return res.status(503).json({ success: false, message: 'Purchases are not available yet.' });
    }
    if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated' });
    if (!z.strictObject({}).optional().safeParse(req.body).success) {
        return res.status(422).json({ success: false, message: 'This request does not accept purchase data.' });
    }
    try {
        // The authenticated account, not a client-supplied ID or tier, determines access.
        const user = await syncRevenueCatCustomer(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: 'Account not found.' });
        return res.json({ success: true, data: { tier: user.tier } });
    } catch (error) {
        captureServerError(error, { req, source: 'billing.sync' });
        return res.status(503).json({ success: false, message: 'Could not verify purchases. Please try again.' });
    }
};

export const webhook = async (req: Request, res: Response) => {
    const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
    if (!secret || secret.length < 32) return res.status(503).json({ success: false });
    const expected = Buffer.from(`Bearer ${secret}`);
    const received = Buffer.from(req.get('Authorization') || '');
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
        return res.status(401).json({ success: false });
    }
    const parsed = webhookSchema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ success: false });
    const { event } = parsed.data;
    if (event.type === 'TEST') return res.json({ success: true });
    const userIds = new Set(
        [
            event.app_user_id,
            event.original_app_user_id,
            ...(event.aliases || []),
            ...(event.transferred_from || []),
            ...(event.transferred_to || []),
        ].filter((id): id is string => z.uuid().safeParse(id).success),
    );
    try {
        // Fetch current state for both sides of transfers. Event order does not determine access.
        await Promise.all([...userIds].map(syncRevenueCatCustomer));
        return res.json({ success: true });
    } catch (error) {
        captureServerError(error, { req, source: 'billing.webhook' });
        // A failed refresh must remain retryable by RevenueCat.
        return res.status(503).json({ success: false });
    }
};
