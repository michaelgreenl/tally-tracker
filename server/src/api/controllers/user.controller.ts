import { UNAUTHORIZED, NOT_FOUND, UNPROCESSABLE_ENTITY } from '../../contants.js';
import bcrypt from 'bcrypt';
import jwt from '../../util/jwt.util.js';
import * as userRepository from '../../db/repositories/user.repository.js';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

export const get = async (req: Request, res: Response) => {
    const { limit, offset } = req.query;
    res.send({ users: await userRepository.getAllUsers({ limit: Number(limit) || 10, offset: Number(offset) || 0 }) });
};

export const checkAuth = async (req: Request, res: Response) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.json({ success: false, message: 'Not authenticated', id: null });
        }

        const decoded = jwt.verify(token) as { id: string };
        const userId = decoded.id;

        const user = await userRepository.getUserById(userId);
        if (!user) {
            return res.json({ success: false, message: 'User not found', id: null });
        } else {
            res.json({
                success: true,
                message: 'Authentication successful',
                id: user.id,
                email: user.email,
                phone: user.phone,
            });
        }
    } catch (error: any) {
        console.error('Auth check error:', error);
        res.json({ success: false, message: 'Authentication failed: ' + error.message });
    }
};

export const post = async (req: Request, res: Response) => {
    try {
        const { email, phone, password } = req.body;

        const hash = await bcrypt.hash(password, 10);
        const user = await userRepository.createUser({ email, phone, password: hash });

        const token = jwt.sign({ id: user.id, email: user.email });

        res.send({ id: user.id, email: user.email, phone: user.phone });
    } catch (error: any) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            const target = (error.meta?.target as string[])?.[0] || 'Account';
            const field = target.charAt(0).toUpperCase() + target.slice(1);

            res.status(UNPROCESSABLE_ENTITY).json({ message: `${field} is already in use.` });
        } else {
            res.send(error);
        }
    }
};

export const put = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
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

        res.send({ success: true });
    } catch (error: any) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            const target = (error.meta?.target as string[])?.[0] || 'Account';
            const field = target.charAt(0).toUpperCase() + target.slice(1);

            res.status(UNPROCESSABLE_ENTITY).json({ message: `${field} is already in use.` });
        } else {
            res.send(error);
        }
    }
};

export const remove = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;

        if (typeof userId === 'string') {
            await userRepository.deleteUser(userId);
        }

        res.send();
    } catch (error) {
        res.send(error);
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { email, phone, password } = req.body;

        let user;
        if (email) {
            user = await userRepository.getUserByEmail(email);
        } else if (phone) {
            user = await userRepository.getUserByPhone(phone);
        }

        if (!user) {
            res.status(NOT_FOUND).json({ message: 'No account found with those credentials.' });
            return;
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            res.status(UNAUTHORIZED).json({ message: 'Incorrect password.' });
            return;
        }

        const token = jwt.sign({ id: user.id, email: user.email });
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
            maxAge: 24 * 60 * 60 * 1000,
        });

        res.send({ id: user.id, email: user.email, phone: user.phone });
    } catch (error) {
        res.send(error);
    }
};

export const logout = async (req: Request, res: Response) => {
    try {
        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
            maxAge: 0,
        });
        res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        res.send(error);
    }
};
