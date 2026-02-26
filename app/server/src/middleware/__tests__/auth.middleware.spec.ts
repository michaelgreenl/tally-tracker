import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jwt } from '../auth.middleware.js';

import type { Request, Response, NextFunction } from 'express';

vi.mock('../../util/jwt.util', () => ({
    default: {
        verify: vi.fn(),
    },
}));

import jwtUtil from '../../util/jwt.util.js';

const mockReq = (overrides = {}) =>
    ({
        cookies: {},
        headers: {},
        ...overrides,
    }) as unknown as Request;

const mockRes = () => {
    const res = {} as Response;
    res.status = vi.fn().mockReturnThis();
    res.json = vi.fn().mockReturnThis();
    return res;
};

const mockNext: NextFunction = vi.fn();

describe('Auth Middleware', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should extract token from access_token cookie', () => {
        vi.mocked(jwtUtil.verify).mockReturnValue({ id: 'user-123' });
        const req = mockReq({ cookies: { access_token: 'valid-token' } });
        const res = mockRes();

        jwt(req, res, mockNext);

        expect(jwtUtil.verify).toHaveBeenCalledWith('valid-token');
        expect(req.user).toEqual({ id: 'user-123' });
        expect(mockNext).toHaveBeenCalled();
    });

    it('should extract token from Bearer header', () => {
        vi.mocked(jwtUtil.verify).mockReturnValue({ id: 'user-123' });
        const req = mockReq({
            headers: { authorization: 'Bearer valid-token' },
        });
        const res = mockRes();

        jwt(req, res, mockNext);

        expect(jwtUtil.verify).toHaveBeenCalledWith('valid-token');
        expect(req.user).toEqual({ id: 'user-123' });
        expect(mockNext).toHaveBeenCalled();
    });

    it('should prefer cookie over header when both exist', () => {
        vi.mocked(jwtUtil.verify).mockReturnValue({ id: 'user-123' });
        const req = mockReq({
            cookies: { access_token: 'cookie-token' },
            headers: { authorization: 'Bearer header-token' },
        });
        const res = mockRes();

        jwt(req, res, mockNext);

        expect(jwtUtil.verify).toHaveBeenCalledWith('cookie-token');
    });

    it('should return 401 when no token is present', () => {
        const req = mockReq();
        const res = mockRes();

        jwt(req, res, mockNext);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Not authenticated' });
        expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when token verification fails', () => {
        vi.mocked(jwtUtil.verify).mockImplementation(() => {
            throw new Error('invalid token');
        });
        const req = mockReq({ cookies: { access_token: 'bad-token' } });
        const res = mockRes();

        jwt(req, res, mockNext);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Invalid token' });
        expect(mockNext).not.toHaveBeenCalled();
    });
});
