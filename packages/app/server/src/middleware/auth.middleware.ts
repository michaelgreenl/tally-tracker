// Explicit native credentials take precedence over browser cookies.
// See: docs/diagrams/sequence/auth/cross-platform-strategy.md

import { Request, Response, NextFunction } from 'express';
import jwtUtil from '../util/jwt.util.js';
import { UNAUTHORIZED, SERVER_ERROR } from '@tally/core';
import * as userRepository from '../db/repositories/user.repository.js';

export const jwt = async (req: Request, res: Response, next: NextFunction) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.access_token) {
        token = req.cookies.access_token;
    }

    if (!token) {
        return res.status(UNAUTHORIZED).json({ success: false, message: 'Not authenticated' });
    }

    let decoded;
    try {
        decoded = jwtUtil.verify(token);
        if (
            typeof decoded === 'string' ||
            typeof decoded.id !== 'string' ||
            typeof decoded.sessionVersion !== 'number'
        ) {
            throw new Error('Invalid token payload');
        }
    } catch {
        return res.status(UNAUTHORIZED).json({ success: false, message: 'Invalid token' });
    }
    try {
        const user = await userRepository.getUserAuthById(decoded.id);
        const expectedUserId = req.get('X-Account-Id');
        if (!user || user.sessionVersion !== decoded.sessionVersion || (expectedUserId && expectedUserId !== user.id)) {
            return res.status(UNAUTHORIZED).json({ success: false, message: 'Expired session' });
        }

        req.user = user;
        next();
    } catch {
        // A database failure is not proof that the user's credentials expired.
        return res.status(SERVER_ERROR).json({ success: false, message: 'Authentication is temporarily unavailable.' });
    }
};
