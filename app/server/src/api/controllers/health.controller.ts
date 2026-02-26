import { Request, Response } from 'express';
import type { ApiResponse } from '@packages/core';

export const checkHealth = (req: Request, res: Response) => {
    const response: ApiResponse<object> = {
        success: true,
        data: {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        },
    };

    res.json(response);
};
