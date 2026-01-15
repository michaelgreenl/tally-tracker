import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types/index.js';

export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
    let message = 'Internal Server Error';
    let status = 500;

    if (err instanceof Error) {
        message = err.message;
        console.error(err.stack);

        if ((err as any).status) {
            status = (err as any).status;
        }
    } else {
        console.error('Unknown error:', err);
    }

    const response: ApiResponse = {
        success: false,
        error: message,
    };

    res.status(status).json(response);
};
