import { CREATED, UNAUTHORIZED, NOT_FOUND, UNPROCESSABLE_ENTITY, SERVER_ERROR } from '@tally/core';
import * as userRepository from '../../db/repositories/user.repository.js';
import * as tokenRepository from '../../db/repositories/token.repository.js';
import {
    accessCookieConfig,
    shortAccessCookieConfig,
    refreshCookieConfig,
    clearCookieConfig,
} from '../../config/cookie.config.js';
import { captureServerError } from '../../monitoring/sentry.js';
import { issueEmailOtp } from '../../services/email-otp.service.js';
import jwt from '../../util/jwt.util.js';
import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';

import type { Request, Response } from 'express';
import type { AuthResponse, ClientUser } from '@tally/core';
import type { AuthRequest, RefreshRequest } from '@tally/core';
import type { User } from '@prisma/client';
import type { Server } from 'socket.io';

const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60 * 1000; // 30d

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    return 'Unknown error';
};

const toClientUser = (user: Pick<User, 'id' | 'email' | 'tier' | 'emailVerifiedAt'>): ClientUser => ({
    id: user.id,
    email: user.email,
    tier: user.tier,
    emailVerified: Boolean(user.emailVerifiedAt),
});

// Access token is validated by the jwt middleware before reaching here.
// Just look up the user and return their data.
export const checkAuth = async (req: Request, res: Response<AuthResponse>) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(UNAUTHORIZED).json({ success: false, message: 'Not authenticated' });
        }

        const user = await userRepository.getUserById(userId);
        if (!user) {
            return res.status(NOT_FOUND).json({ success: false, message: 'User not found' });
        }

        res.json({
            success: true,
            data: { user: toClientUser(user) },
        });
    } catch (error: unknown) {
        captureServerError(error, { req, source: 'user.checkAuth' });
        console.error('Authentication Check Error:', error);
        res.status(SERVER_ERROR).json({
            success: false,
            message: 'Authentication Check Error: ' + getErrorMessage(error),
        });
    }
};

const sanitizeEmail = (email: string): string => {
    return email.trim().toLowerCase();
};

export const post = async (
    req: Request<Record<string, never>, AuthResponse, AuthRequest>,
    res: Response<AuthResponse>,
) => {
    try {
        const { email, password } = req.body;

        const sanitizedEmail = sanitizeEmail(email);

        const hash = await bcrypt.hash(password, 10);
        const user = await userRepository.createUser({ email: sanitizedEmail, password: hash });
        void issueEmailOtp(user, 'EMAIL_VERIFICATION').catch((error: unknown) => {
            captureServerError(error, { req, source: 'user.post.emailVerification' });
        });

        res.status(CREATED).json({ success: true });
    } catch (error: unknown) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            // P2002 = unique constraint violation
            const target = (error.meta?.target as string[])?.[0] || 'Account';
            const field = target.charAt(0).toUpperCase() + target.slice(1);

            res.status(UNPROCESSABLE_ENTITY).json({
                success: false,
                message: `${field} is already in use.`,
            });
        } else {
            captureServerError(error, { req, source: 'user.post' });
            console.error('User Controller Error: ', error);
            res.status(SERVER_ERROR).json({
                success: false,
                message: 'Server error: ' + getErrorMessage(error),
            });
        }
    }
};

// Returns tokens both as cookies (web) and in the response body (native).
// See: docs/diagrams/sequence/auth/login.md
export const login = async (
    req: Request<Record<string, never>, AuthResponse, AuthRequest>,
    res: Response<AuthResponse>,
) => {
    try {
        const { email, password, rememberMe } = req.body;

        const sanitizedEmail = sanitizeEmail(email);
        const user = await userRepository.getUserByEmail(sanitizedEmail);

        if (!user) {
            return res.status(NOT_FOUND).json({
                success: false,
                message: 'No account found with those credentials.',
            });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(UNAUTHORIZED).json({ success: false, message: 'Incorrect password.' });
        }

        const credentials = await userRepository.withLockedUser(user.id, async (current, tx) => {
            if (!current || current.password !== user.password || current.sessionVersion !== user.sessionVersion)
                return null;
            const accessToken = jwt.sign(
                { id: current.id, email: current.email, sessionVersion: current.sessionVersion },
                rememberMe ? '60m' : '1d',
            );
            const token = rememberMe
                ? await tx.refreshToken.create({
                      data: { userId: user.id, expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL) },
                  })
                : null;
            return { user: toClientUser(current), accessToken, refreshToken: token?.id };
        });
        if (!credentials) return res.status(UNAUTHORIZED).json({ success: false, message: 'Please sign in again.' });
        const { accessToken, refreshToken } = credentials;

        if (rememberMe) {
            res.cookie('access_token', accessToken, shortAccessCookieConfig);
            res.cookie('refresh_token', refreshToken, refreshCookieConfig);
        } else {
            res.cookie('access_token', accessToken, accessCookieConfig);
            res.clearCookie('refresh_token', clearCookieConfig);
        }

        res.json({ success: true, data: credentials });
    } catch (error: unknown) {
        captureServerError(error, { req, source: 'user.login' });
        console.error('User Controller Error: ', error);
        res.status(SERVER_ERROR).json({
            success: false,
            message: 'Server error: ' + getErrorMessage(error),
        });
    }
};

// See: docs/diagrams/sequence/auth/token-refresh.md
export const refresh = async (
    req: Request<Record<string, never>, AuthResponse, RefreshRequest>,
    res: Response<AuthResponse>,
) => {
    try {
        // Web sends refresh token via cookie, native sends it in the body
        const refreshTokenId = req.body?.refreshToken || req.cookies?.refresh_token;

        if (!refreshTokenId) {
            return res.status(UNAUTHORIZED).json({ success: false, message: 'No refresh token provided' });
        }

        const rotated = await tokenRepository.rotate(
            refreshTokenId,
            new Date(Date.now() + REFRESH_TOKEN_TTL),
            req.get('X-Account-Id'),
        );
        if (!rotated) {
            return res.status(UNAUTHORIZED).json({ success: false, message: 'Invalid or expired refresh token' });
        }

        const { user, token: newTokenRecord } = rotated;
        const accessToken = jwt.sign({ id: user.id, email: user.email, sessionVersion: user.sessionVersion });

        res.cookie('access_token', accessToken, shortAccessCookieConfig);
        res.cookie('refresh_token', newTokenRecord.id, refreshCookieConfig);

        res.json({
            success: true,
            data: { accessToken, refreshToken: newTokenRecord.id },
        });
    } catch (error: unknown) {
        captureServerError(error, { req, source: 'user.refresh' });
        console.error('Refresh Token Error:', error);
        res.status(SERVER_ERROR).json({
            success: false,
            message: 'Server error: ' + getErrorMessage(error),
        });
    }
};

// Accept either credential. Non-remembered web sessions have no refresh cookie.
export const logout = async (req: Request, res: Response<AuthResponse>) => {
    try {
        const refreshTokenId = req.body?.refreshToken || req.cookies?.refresh_token;
        const token = req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.slice(7)
            : req.cookies?.access_token;
        let access: { id: string; sessionVersion: number } | null = null;
        if (token) {
            try {
                const decoded = jwt.verify(token);
                if (
                    typeof decoded !== 'string' &&
                    typeof decoded.id === 'string' &&
                    typeof decoded.sessionVersion === 'number'
                ) {
                    access = { id: decoded.id, sessionVersion: decoded.sessionVersion };
                }
            } catch {
                /* A valid refresh token can still revoke an expired access session. */
            }
        }
        const revoked = await tokenRepository.revokeSession(access, refreshTokenId, req.get('X-Account-Id'));
        const io = req.app.get('io') as Server | undefined;
        if (revoked && io) {
            const sockets = await io.in(revoked.userId).fetchSockets();
            for (const socket of sockets) {
                if (socket.data.sessionVersion < revoked.sessionVersion) socket.disconnect(true);
            }
        }

        res.clearCookie('access_token', clearCookieConfig);
        res.clearCookie('refresh_token', clearCookieConfig);

        res.json({ success: true });
    } catch (error: unknown) {
        if (error instanceof Error && 'status' in error && error.status === UNAUTHORIZED) {
            return res.status(UNAUTHORIZED).json({ success: false, message: 'Account changed' });
        }
        captureServerError(error, { req, source: 'user.logout' });
        console.error('User Controller Error: ', error);
        res.status(SERVER_ERROR).json({
            success: false,
            message: 'Could not finish logging out. Please try again.',
        });
    }
};

export const remove = async (req: Request, res: Response<AuthResponse>) => {
    try {
        const userId = req.user?.id;

        if (typeof userId !== 'string') {
            return res.status(UNAUTHORIZED).json({ success: false, message: 'Not authenticated' });
        }

        await userRepository.deleteAccount(userId);

        res.clearCookie('access_token', clearCookieConfig);
        res.clearCookie('refresh_token', clearCookieConfig);

        res.json({ success: true });
    } catch (error: unknown) {
        captureServerError(error, { req, source: 'user.remove' });
        console.error('User Controller Error: ', error);
        res.status(SERVER_ERROR).json({
            success: false,
            message: 'Server error: ' + getErrorMessage(error),
        });
    }
};
