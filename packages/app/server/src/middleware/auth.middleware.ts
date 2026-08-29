// Dual-path auth: checks cookie first (web), then Bearer header (native).
// See: docs/diagrams/sequence/auth/cross-platform-strategy.md

import { Request, Response, NextFunction } from 'express';
import jwtUtil from '../util/jwt.util.js';
import { UNAUTHORIZED } from '@tally/core';
import * as userRepository from '../db/repositories/user.repository.js';

export const jwt = async (req: Request, res: Response, next: NextFunction) => {
    let token;

    if (req.cookies?.access_token) {
        token = req.cookies.access_token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(UNAUTHORIZED).json({ success: false, message: 'Not authenticated' });
    }

    try {
        const decoded = jwtUtil.verify(token);
        if (
            typeof decoded === 'string' ||
            typeof decoded.id !== 'string' ||
            typeof decoded.sessionVersion !== 'number'
        ) {
            throw new Error('Invalid token payload');
        }

        const user = await userRepository.getUserAuthById(decoded.id);
        if (!user || user.sessionVersion !== decoded.sessionVersion) {
            throw new Error('Expired session');
        }

        req.user = user;
        next();
    } catch {
        return res.status(UNAUTHORIZED).json({ success: false, message: 'Invalid token' });
    }
};
