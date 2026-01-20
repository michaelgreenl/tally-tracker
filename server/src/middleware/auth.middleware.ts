import { Request, Response, NextFunction } from 'express';
import jwtUtil from '../util/jwt.util.js';
import { UNAUTHORIZED } from '../contants.js';

export const jwt = (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies.token;

    if (!token) {
        return res.status(UNAUTHORIZED).json({ message: 'Not authenticated' });
    }

    try {
        const decoded = jwtUtil.verify(token);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(UNAUTHORIZED).json({ message: 'Invalid token' });
    }
};
