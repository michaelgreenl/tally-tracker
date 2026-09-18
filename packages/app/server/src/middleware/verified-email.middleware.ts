import type { RequestHandler } from 'express';

// Authentication loads this value from the database, not from a token or client profile.
export const verifiedEmail: RequestHandler = (req, res, next) => {
    if (!req.user?.emailVerifiedAt) {
        res.status(403).json({
            success: false,
            code: 'EMAIL_VERIFICATION_REQUIRED',
            message: 'Verify your email to continue.',
        });
        return;
    }
    next();
};
