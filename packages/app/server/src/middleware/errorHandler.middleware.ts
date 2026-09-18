import { Request, Response, NextFunction } from 'express';

import type { ApiResponse } from '@tally/core';

export const errorHandler = (err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);

    let status = 500;
    if (
        err instanceof Error &&
        'status' in err &&
        typeof err.status === 'number' &&
        Number.isInteger(err.status) &&
        err.status >= 400 &&
        err.status < 500
    ) {
        status = err.status;
    }

    // Error messages and stacks can contain request data or database credentials.
    // Sentry handles diagnostics before this middleware; log only safe request metadata here.
    console.error('Request failed', { method: req.method, route: req.route?.path, status });
    const response: ApiResponse<null> = {
        success: false,
        message: status === 500 ? 'Something went wrong. Please try again later.' : 'Invalid request.',
    };
    res.status(status).json(response);
};
