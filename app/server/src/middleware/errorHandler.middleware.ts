import { Request, Response, NextFunction } from 'express';

import type { ApiResponse } from '@packages/core';

type ErrorWithStatus = Error & {
    status?: number;
};

const hasStatus = (error: Error): error is ErrorWithStatus => {
    return typeof (error as ErrorWithStatus).status === 'number';
};

export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
    let message = 'Internal Server Error';
    let status = 500;

    if (err instanceof Error) {
        message = err.message;
        console.error(err.stack);

        if (hasStatus(err) && typeof err.status === 'number') {
            status = err.status;
        }
    } else {
        console.error('Unknown error:', err);
    }

    const response: ApiResponse<null> = { success: false, message };
    res.status(status).json(response);
};
