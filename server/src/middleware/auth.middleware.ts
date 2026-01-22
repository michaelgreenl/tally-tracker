import { Request, Response, NextFunction } from 'express';
import jwtUtil from '../util/jwt.util.js';
import { UNAUTHORIZED } from '../contants.js';

export const jwt = (req: Request, res: Response, next: NextFunction) => {
    let token;

    if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(UNAUTHORIZED).json({ success: false, message: 'Not authenticated' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(UNAUTHORIZED).json({ success: false, message: 'Invalid token' });
    }
};
