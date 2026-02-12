// Dual-path auth: checks cookie first (web), then Bearer header (native).
// See: docs/diagrams/sequence/auth/cross-platform-strategy.md

import { Request, Response, NextFunction } from 'express';
import jwtUtil from '../util/jwt.util.js';
import { UNAUTHORIZED } from '../constants.js';

export const jwt = (req: Request, res: Response, next: NextFunction) => {
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
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(UNAUTHORIZED).json({ success: false, message: 'Invalid token' });
    }
};
