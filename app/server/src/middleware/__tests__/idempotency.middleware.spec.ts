import { OK_NO_CONTENT } from '../../constants/status-codes.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { idempotency } from '../idempotency.middleware.js';

import type { Request, Response, NextFunction } from 'express';

vi.mock('../../db/repositories/idempotency.repository', () => ({
    get: vi.fn(),
    create: vi.fn(),
}));

import * as idempotencyRepo from '../../db/repositories/idempotency.repository.js';

const mockReq = (overrides = {}) =>
    ({
        headers: {},
        user: { id: 'test-user-123' },
        ...overrides,
    }) as unknown as Request;

const mockRes = () => {
    const res = {} as Response;
    res.status = vi.fn().mockReturnThis();
    res.send = vi.fn().mockReturnThis();
    return res;
};

const mockNext: NextFunction = vi.fn();

describe('Idempotency Middleware', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should pass through when no idempotency key is present', async () => {
        const req = mockReq();
        const res = mockRes();

        await idempotency(req, res, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(idempotencyRepo.get).not.toHaveBeenCalled();
    });

    it('should pass through when no user is present', async () => {
        const req = mockReq({
            headers: { 'x-idempotency-key': 'key-123' },
            user: undefined,
        });
        const res = mockRes();

        await idempotency(req, res, mockNext);

        expect(mockNext).toHaveBeenCalled();
    });

    it('should return OK_NO_CONTENT for duplicate keys', async () => {
        vi.mocked(idempotencyRepo.get).mockResolvedValue({
            key: 'key-123',
            userId: 'test-user-123',
            createdAt: new Date(),
        });

        const req = mockReq({ headers: { 'x-idempotency-key': 'key-123' } });
        const res = mockRes();

        await idempotency(req, res, mockNext);

        expect(res.status).toHaveBeenCalledWith(OK_NO_CONTENT);
        expect(res.send).toHaveBeenCalled();
        expect(mockNext).not.toHaveBeenCalled();
    });

    it('should create key and pass through for new requests', async () => {
        vi.mocked(idempotencyRepo.get).mockResolvedValue(null);
        vi.mocked(idempotencyRepo.create).mockResolvedValue({
            key: 'key-123',
            userId: 'test-user-123',
            createdAt: new Date(),
        });

        const req = mockReq({ headers: { 'x-idempotency-key': 'key-123' } });
        const res = mockRes();

        await idempotency(req, res, mockNext);

        expect(idempotencyRepo.create).toHaveBeenCalledWith({
            key: 'key-123',
            userId: 'test-user-123',
        });
        expect(mockNext).toHaveBeenCalled();
    });

    it('should fail open on errors', async () => {
        vi.mocked(idempotencyRepo.get).mockRejectedValue(new Error('DB down'));

        const req = mockReq({ headers: { 'x-idempotency-key': 'key-123' } });
        const res = mockRes();

        await idempotency(req, res, mockNext);

        expect(res.status).toHaveBeenCalledWith(OK_NO_CONTENT);
        expect(res.send).toHaveBeenCalled();
    });
});
