import { CREATED, UNAUTHORIZED, NOT_FOUND, UNPROCESSABLE_ENTITY, SERVER_ERROR } from '../../constants.js';
import * as userRepository from '../../db/repositories/user.repository.js';
import * as tokenRepository from '../../db/repositories/token.repository.js';
import {
    accessCookieConfig,
    shortAccessCookieConfig,
    refreshCookieConfig,
    clearCookieConfig,
} from '../../config/cookie.config.js';
import jwt from '../../util/jwt.util.js';
import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';

import type { Request, Response } from 'express';
import type { AuthResponse } from '../../types/shared/responses.d.ts';
import type { AuthRequest, RefreshRequest } from '../../types/shared/requests.d.ts';
import type { ClientUser } from '../../types/shared/models.d.ts';

const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60 * 1000; // 30d

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
            data: { user },
        });
    } catch (error: any) {
        console.error('Authentication Check Error:', error);
        res.status(SERVER_ERROR).json({
            success: false,
            message: 'Authentication Check Error: ' + error.message,
        });
    }
};

const sanitizeEmail = (email: string): string => {
    return email.trim().toLowerCase();
};

export const post = async (req: Request<{}, {}, AuthRequest>, res: Response<AuthResponse>) => {
    try {
        const { email, phone, password } = req.body;

        let sanitizedEmail: string | undefined;
        if (email) {
            sanitizedEmail = sanitizeEmail(email);
        }

        const hash = await bcrypt.hash(password, 10);
        await userRepository.createUser({ email: sanitizedEmail, phone, password: hash });

        res.status(CREATED).json({ success: true });
    } catch (error: any) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            // P2002 = unique constraint violation
            const target = (error.meta?.target as string[])?.[0] || 'Account';
            const field = target.charAt(0).toUpperCase() + target.slice(1);

            res.status(UNPROCESSABLE_ENTITY).json({
                success: false,
                message: `${field} is already in use.`,
            });
        } else {
            console.error('User Controller Error: ', error);
            res.status(SERVER_ERROR).json({
                success: false,
                message: 'Server error: ' + error.message,
            });
        }
    }
};

// Returns tokens both as cookies (web) and in the response body (native).
// See: docs/diagrams/sequence/auth/login.md
export const login = async (req: Request<{}, {}, AuthRequest>, res: Response<AuthResponse>) => {
    try {
        const { email, phone, password, rememberMe } = req.body;

        let user;
        if (email) {
            const sanitizedEmail = sanitizeEmail(email);
            user = await userRepository.getUserByEmail(sanitizedEmail);
        } else if (phone) {
            user = await userRepository.getUserByPhone(phone);
        }

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

        const { password: _, ...clientUser } = user;

        const accessToken = jwt.sign(
            { id: user.id, email: user.email, phone: user.phone },
            !!rememberMe ? '15m' : '1d',
        );

        let refreshToken: string | undefined;

        if (!!rememberMe) {
            const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL);
            const tokenRecord = await tokenRepository.create({ userId: user.id, expiresAt });
            refreshToken = tokenRecord.id;

            res.cookie('access_token', accessToken, shortAccessCookieConfig);
            res.cookie('refresh_token', refreshToken, refreshCookieConfig);
        } else {
            res.cookie('access_token', accessToken, accessCookieConfig);
        }

        res.json({ success: true, data: { user: clientUser, accessToken, refreshToken } });
    } catch (error: any) {
        console.error('User Controller Error: ', error);
        res.status(SERVER_ERROR).json({
            success: false,
            message: 'Server error: ' + error.message,
        });
    }
};

// See: docs/diagrams/sequence/auth/token-refresh.md
export const refresh = async (req: Request<{}, {}, RefreshRequest>, res: Response<AuthResponse>) => {
    try {
        // Web sends refresh token via cookie, native sends it in the body
        const refreshTokenId = req.cookies?.refresh_token || req.body?.refreshToken;

        if (!refreshTokenId) {
            return res.status(UNAUTHORIZED).json({ success: false, message: 'No refresh token provided' });
        }

        const tokenRecord = await tokenRepository.get(refreshTokenId);

        if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
            if (tokenRecord) await tokenRepository.remove(tokenRecord.id);
            return res.status(UNAUTHORIZED).json({ success: false, message: 'Invalid or expired refresh token' });
        }

        const user = await userRepository.getUserById(tokenRecord.userId);
        if (!user) {
            await tokenRepository.remove(tokenRecord.id);
            return res.status(NOT_FOUND).json({ success: false, message: 'User not found' });
        }

        // Rotate: invalidate old token, issue new one with fresh expiry
        await tokenRepository.remove(tokenRecord.id);
        const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL);
        const newTokenRecord = await tokenRepository.create({ userId: tokenRecord.userId, expiresAt });

        const accessToken = jwt.sign({ id: user.id, email: user.email, phone: user.phone });

        res.cookie('access_token', accessToken, shortAccessCookieConfig);
        res.cookie('refresh_token', newTokenRecord.id, refreshCookieConfig);

        res.json({
            success: true,
            data: { accessToken, refreshToken: newTokenRecord.id },
        });
    } catch (error: any) {
        console.error('Refresh Token Error:', error);
        res.status(SERVER_ERROR).json({
            success: false,
            message: 'Server error: ' + error.message,
        });
    }
};

// Uses the refresh token (not access token) to identify the user,
// so logout works even when the access token is expired.
export const logout = async (req: Request, res: Response<AuthResponse>) => {
    try {
        const refreshTokenId = req.cookies?.refresh_token;

        if (refreshTokenId) {
            const tokenRecord = await tokenRepository.get(refreshTokenId);
            if (tokenRecord) {
                await tokenRepository.removeAllForUser(tokenRecord.userId);
            }
        }

        res.clearCookie('access_token', clearCookieConfig);
        res.clearCookie('refresh_token', clearCookieConfig);

        res.json({ success: true });
    } catch (error: any) {
        console.error('User Controller Error: ', error);
        res.status(SERVER_ERROR).json({
            success: false,
            message: 'Server error: ' + error.message,
        });
    }
};

export const put = async (req: Request<{}, {}, AuthRequest>, res: Response<AuthResponse>) => {
    try {
        const userId = req.user?.id;
        const { email, phone, password } = req.body;

        const updateData: any = {};
        if (email) updateData.email = email;
        if (phone) updateData.phone = phone;

        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        if (typeof userId === 'string') {
            await userRepository.updateUserInfo(userId, updateData);
        }

        res.json({ success: true });
    } catch (error: any) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            const target = (error.meta?.target as string[])?.[0] || 'Account';
            const field = target.charAt(0).toUpperCase() + target.slice(1);

            res.status(UNPROCESSABLE_ENTITY).json({
                success: false,
                message: `${field} is already in use.`,
            });
        } else {
            console.error('User Controller Error: ', error);
            res.status(SERVER_ERROR).json({
                success: false,
                message: 'Server error: ' + error.message,
            });
        }
    }
};

export const remove = async (req: Request, res: Response<AuthResponse>) => {
    try {
        const userId = req.user?.id;

        if (typeof userId === 'string') {
            await userRepository.deleteUser(userId);
        }

        res.json({ success: true });
    } catch (error: any) {
        console.error('User Controller Error: ', error);
        res.status(SERVER_ERROR).json({
            success: false,
            message: 'Server error: ' + error.message,
        });
    }
};
