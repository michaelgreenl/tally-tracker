import { Request, Response } from 'express';
import type { ApiResponse } from '../../types/shared/responses.d.ts';

export const checkHealth = (req: Request, res: Response) => {
    const response: ApiResponse<Object> = {
        success: true,
        data: {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        },
    };

    res.json(response);
};
