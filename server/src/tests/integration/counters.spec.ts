import { Request, Response, NextFunction } from 'express';
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import prisma from '../../db/prisma.js';

vi.mock('../../middleware/auth.middleware.ts', () => ({
    jwt: (req: Request, res: Response, next: NextFunction) => {
        req.user = { id: 'test-user-id-123' };
        next();
    },
}));

vi.mock('../../db/prisma', () => ({
    default: {
        counter: {
            create: vi.fn().mockResolvedValue({
                id: '123',
                title: 'Test Counter',
                count: 0,
                type: 'SHARED',
                inviteCode: 'ABC',
            }),
        },
    },
}));

describe('POST /counters', () => {
    it('should create a counter successfully', async () => {
        const res = await request(app).post('/counters').send({
            title: 'Test Counter',
            type: 'SHARED',
            inviteCode: 'ABC',
        });

        expect(res.status).toBe(201);
        expect(res.body.data.counter.title).toBe('Test Counter');
    });

    it('should fail if inviteCode is missing for SHARED counter', async () => {
        const res = await request(app).post('/counters').send({
            title: 'Broken Counter',
            type: 'SHARED',
        });

        expect(res.status).toBe(422);
        expect(res.body.message).toContain('Validation failed');
    });
});
