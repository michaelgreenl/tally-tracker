import { Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';
import { CONFLICT, UNAUTHORIZED, UNPROCESSABLE_ENTITY } from '@tally/core';

import * as userRepository from '../../db/repositories/user.repository.js';
import { verifyGoogleToken } from '../../services/google-auth.service.js';
import { issueEmailOtp } from '../../services/email-otp.service.js';
import { captureServerError } from '../../monitoring/sentry.js';
import { sendSession } from './user.controller.js';

import type { NextFunction, Request, Response } from 'express';
import type { GoogleAuthResponse, GoogleLoginRequest } from '@tally/core';
import type { GoogleIdentity } from '../../services/google-auth.service.js';

export const verifyGoogle = async (req: Request, res: Response<GoogleAuthResponse>, next: NextFunction) => {
    if (!process.env.GOOGLE_WEB_CLIENT_ID) {
        return res.status(503).json({ success: false, message: 'Google sign-in is unavailable.' });
    }
    if (!req.is('application/json')) {
        return res.status(UNPROCESSABLE_ENTITY).json({ success: false, message: 'Invalid sign-in request.' });
    }
    try {
        const identity = await verifyGoogleToken(req.body.idToken);
        res.locals.googleIdentity = identity;
        // Rate-limit the verified account, never an email supplied by the client.
        req.body.email = identity.email;
    } catch {
        return res.status(UNAUTHORIZED).json({ success: false, message: 'Google sign-in failed. Try again.' });
    }
    return next();
};

export const googleLogin = async (
    req: Request<Record<string, never>, GoogleAuthResponse, GoogleLoginRequest>,
    res: Response<GoogleAuthResponse>,
) => {
    const identity = res.locals.googleIdentity as GoogleIdentity;
    const { password, rememberMe } = req.body;
    try {
        let user = await userRepository.getUserByGoogleSubject(identity.subject);
        if (!user) {
            const existing = await userRepository.getUserByEmail(identity.email);
            if (existing) {
                if (!existing.password || existing.googleSubject) {
                    return res.status(CONFLICT).json({ success: false, message: 'Use your existing sign-in method.' });
                }
                if (!password) {
                    return res.status(CONFLICT).json({
                        success: false,
                        code: 'GOOGLE_LINK_REQUIRED',
                        message: 'Enter your Tally password to connect Google.',
                    });
                }
                if (!(await bcrypt.compare(password, existing.password))) {
                    return res.status(UNAUTHORIZED).json({ success: false, message: 'Password is incorrect.' });
                }
                user = await userRepository.linkGoogle(existing, identity.subject, identity.emailVerified);
                if (!user) {
                    return res.status(UNAUTHORIZED).json({ success: false, message: 'Please sign in again.' });
                }
            } else {
                user = await userRepository.createGoogleUser(identity.subject, identity.email, identity.emailVerified);
                if (!user.emailVerifiedAt) {
                    void issueEmailOtp(user, 'EMAIL_VERIFICATION').catch((error: unknown) => {
                        captureServerError(error, { req, source: 'googleLogin.emailVerification' });
                    });
                }
            }
        }
        return sendSession(user, rememberMe, res);
    } catch (error: unknown) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            // A concurrent sign-in may have created this identity. Never resolve an email conflict by linking it.
            const user = await userRepository.getUserByGoogleSubject(identity.subject);
            if (user) return sendSession(user, rememberMe, res);
            return res.status(CONFLICT).json({ success: false, message: 'Account changed. Please sign in again.' });
        }
        throw error;
    }
};
