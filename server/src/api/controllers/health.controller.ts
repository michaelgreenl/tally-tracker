import { Request, Response } from 'express';
import { ApiResponse } from '../../types/index.js';

export const checkHealth = (req: Request, res: Response) => {
    const response: ApiResponse = {
        success: true,
        data: {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        },
    };
    res.json(response);
};
