import { OK, SERVER_ERROR, UNPROCESSABLE_ENTITY } from '@tally/core';
import bcrypt from 'bcrypt';

import * as emailOtpRepository from '../../db/repositories/email-otp.repository.js';
import * as userRepository from '../../db/repositories/user.repository.js';
import { captureServerError } from '../../monitoring/sentry.js';
import { digestEmailOtp, issueEmailOtp } from '../../services/email-otp.service.js';

import type { AuthResponse, EmailAddressRequest, EmailOtpRequest, PasswordResetRequest } from '@tally/core';
import type { Request, Response } from 'express';

const REQUEST_MESSAGE = 'If an account exists, a code will be sent.';
const INVALID_CODE_MESSAGE = 'The code is invalid or expired.';
const normalizeEmail = (email: string) => email.trim().toLowerCase();

const requestCode = async (
    req: Request<Record<string, never>, AuthResponse, EmailAddressRequest>,
    res: Response<AuthResponse>,
    purpose: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET',
) => {
    try {
        const user = await userRepository.getUserByEmail(normalizeEmail(req.body.email));
        const shouldSend = user && (purpose !== 'EMAIL_VERIFICATION' || !user.emailVerifiedAt);

        if (shouldSend) {
            void issueEmailOtp(user, purpose).catch((error: unknown) => {
                captureServerError(error, { req, source: `emailAuth.request.${purpose}` });
            });
        }

        return res.status(OK).json({ success: true, message: REQUEST_MESSAGE });
    } catch (error: unknown) {
        captureServerError(error, { req, source: `emailAuth.request.${purpose}` });
        return res.status(OK).json({ success: true, message: REQUEST_MESSAGE });
    }
};

export const requestEmailVerification = (
    req: Request<Record<string, never>, AuthResponse, EmailAddressRequest>,
    res: Response<AuthResponse>,
) => requestCode(req, res, 'EMAIL_VERIFICATION');

export const requestPasswordReset = (
    req: Request<Record<string, never>, AuthResponse, EmailAddressRequest>,
    res: Response<AuthResponse>,
) => requestCode(req, res, 'PASSWORD_RESET');

export const verifyEmail = async (
    req: Request<Record<string, never>, AuthResponse, EmailOtpRequest>,
    res: Response<AuthResponse>,
) => {
    try {
        const user = await userRepository.getUserByEmail(normalizeEmail(req.body.email));
        if (!user) {
            return res.status(UNPROCESSABLE_ENTITY).json({ success: false, message: INVALID_CODE_MESSAGE });
        }

        const digest = digestEmailOtp(user.id, 'EMAIL_VERIFICATION', req.body.code);
        const verified = await emailOtpRepository.verifyEmail(user.id, digest);
        if (!verified) {
            return res.status(UNPROCESSABLE_ENTITY).json({ success: false, message: INVALID_CODE_MESSAGE });
        }

        return res.status(OK).json({ success: true });
    } catch (error: unknown) {
        captureServerError(error, { req, source: 'emailAuth.verifyEmail' });
        return res.status(SERVER_ERROR).json({ success: false, message: 'Email verification failed.' });
    }
};

export const resetPassword = async (
    req: Request<Record<string, never>, AuthResponse, PasswordResetRequest>,
    res: Response<AuthResponse>,
) => {
    try {
        const user = await userRepository.getUserByEmail(normalizeEmail(req.body.email));
        if (!user) {
            return res.status(UNPROCESSABLE_ENTITY).json({ success: false, message: INVALID_CODE_MESSAGE });
        }

        const digest = digestEmailOtp(user.id, 'PASSWORD_RESET', req.body.code);
        const password = await bcrypt.hash(req.body.password, 10);
        const reset = await emailOtpRepository.resetPassword(user.id, digest, password);
        if (!reset) {
            return res.status(UNPROCESSABLE_ENTITY).json({ success: false, message: INVALID_CODE_MESSAGE });
        }

        const io = req.app.get('io');
        io?.in(user.id).disconnectSockets(true);
        return res.status(OK).json({ success: true });
    } catch (error: unknown) {
        captureServerError(error, { req, source: 'emailAuth.resetPassword' });
        return res.status(SERVER_ERROR).json({ success: false, message: 'Password reset failed.' });
    }
};
