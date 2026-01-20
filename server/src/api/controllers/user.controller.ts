import { CREATED, UNAUTHORIZED, NOT_FOUND, UNPROCESSABLE_ENTITY, SERVER_ERROR } from '../../contants.js';
import * as userRepository from '../../db/repositories/user.repository.js';
import cookieConfig from '../../config/cookie.config.js';
import jwt from '../../util/jwt.util.js';
import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';

import type { Request, Response } from 'express';
import type { AuthResponse } from '../../types/shared/responses.d.ts';
import type { AuthRequest } from '../../types/shared/requests.d.ts';
import type { ClientUser } from '../../types/shared/models.d.ts';

export const checkAuth = async (req: Request, res: Response<AuthResponse>) => {
    try {
        const token = req.cookies?.token;
        if (!token) {
            return res.json({ success: false, message: 'Not authenticated: Token not found' });
        }

        const decoded = jwt.verify(token) as { id: string };
        const userId = decoded.id;

        const user = await userRepository.getUserById(userId);
        if (!user) {
            return res.status(NOT_FOUND).json({ success: false, message: 'User not found' });
        }

        res.json({
            success: true,
            message: 'Authentication successful',
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

export const post = async (req: Request<{}, {}, AuthRequest>, res: Response<AuthResponse>) => {
    try {
        const { email, phone, password } = req.body;

        const hash = await bcrypt.hash(password, 10);
        await userRepository.createUser({ email, phone, password: hash });

        res.status(CREATED).json({ success: true });
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

export const login = async (req: Request<{}, {}, AuthRequest>, res: Response<AuthResponse>) => {
    try {
        const { email, phone, password } = req.body;

        let user;
        if (email) {
            user = await userRepository.getUserByEmail(email);
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

        const token = jwt.sign({ id: user.id, email: user.email, phone: user.phone });

        const { password: _, ...clientUser } = user;

        res.cookie('token', token, cookieConfig);
        res.json({ success: true, data: { user: clientUser } });
    } catch (error: any) {
        console.error('User Controller Error: ', error);
        res.status(SERVER_ERROR).json({
            success: false,
            message: 'Server error: ' + error.message,
        });
    }
};

export const logout = async (req: Request, res: Response<AuthResponse>) => {
    try {
        res.clearCookie('token', cookieConfig);

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
