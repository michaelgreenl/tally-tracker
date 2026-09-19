import { CREATED, UNAUTHORIZED, NOT_FOUND, UNPROCESSABLE_ENTITY } from '@tally/core';
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
// Unknown accounts still pay the same bcrypt cost as an incorrect password.
const DUMMY_PASSWORD_HASH = '$2b$10$RbpR42/g2.4KJVi2faLOcuooync48POnkHFq1Qy9GeiMfSNU1xyaa';

const toClientUser = (user: Pick<User, 'id' | 'email' | 'tier' | 'emailVerifiedAt'>): ClientUser => ({
    id: user.id,
    email: user.email,
    tier: user.tier,
    emailVerified: Boolean(user.emailVerifiedAt),
});

// Access token is validated by the jwt middleware before reaching here.
// Just look up the user and return their data.
export const checkAuth = async (req: Request, res: Response<AuthResponse>) => {
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
            res.status(UNPROCESSABLE_ENTITY).json({
                success: false,
                message: 'Account is already in use.',
            });
        } else {
            throw error;
        }
    }
};

// Returns tokens both as cookies (web) and in the response body (native).
// See: docs/diagrams/sequence/auth/login.md
export const login = async (
    req: Request<Record<string, never>, AuthResponse, AuthRequest>,
    res: Response<AuthResponse>,
) => {
    const { email, password, rememberMe } = req.body;

    const sanitizedEmail = sanitizeEmail(email);
    const user = await userRepository.getUserByEmail(sanitizedEmail);

    const match = await bcrypt.compare(password, user?.password ?? DUMMY_PASSWORD_HASH);
    if (!user?.password || !match) {
        return res.status(UNAUTHORIZED).json({ success: false, message: 'Email or password is incorrect.' });
    }

    return sendSession(user, rememberMe, res);
};

export const sendSession = async (user: User, rememberMe: boolean | undefined, res: Response<AuthResponse>) => {
    const credentials = await userRepository.withLockedUser(user.id, async (current, tx) => {
        if (
            !current ||
            current.password !== user.password ||
            current.googleSubject !== user.googleSubject ||
            current.sessionVersion !== user.sessionVersion
        )
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
};

// See: docs/diagrams/sequence/auth/token-refresh.md
export const refresh = async (
    req: Request<Record<string, never>, AuthResponse, RefreshRequest>,
    res: Response<AuthResponse>,
) => {
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
        throw error;
    }
};

export const remove = async (req: Request, res: Response<AuthResponse>) => {
    const userId = req.user?.id;

    if (typeof userId !== 'string') {
        return res.status(UNAUTHORIZED).json({ success: false, message: 'Not authenticated' });
    }

    await userRepository.deleteAccount(userId);

    res.clearCookie('access_token', clearCookieConfig);
    res.clearCookie('refresh_token', clearCookieConfig);

    res.json({ success: true });
};
