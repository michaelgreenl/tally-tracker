import { describe, it, expect, vi } from 'vitest';

vi.stubEnv('JWT_SECRET', 'test-secret-key-for-testing');

import jwt from '../jwt.util.js';

describe('JWT Util', () => {
    it('should sign and verify a token', () => {
        const token = jwt.sign({ id: 'user-123' });
        const decoded = jwt.verify(token) as any;

        expect(decoded.id).toBe('user-123');
        expect(decoded.iss).toBe('reaction-api');
        expect(decoded.aud).toBe('reaction-client');
    });

    it('should default to 15m expiry', () => {
        const token = jwt.sign({ id: 'user-123' });
        const decoded = jwt.verify(token) as any;

        // exp - iat should be 900 seconds (15 minutes)
        expect(decoded.exp - decoded.iat).toBe(900);
    });

    it('should accept custom expiry', () => {
        const token = jwt.sign({ id: 'user-123' }, '1d');
        const decoded = jwt.verify(token) as any;

        expect(decoded.exp - decoded.iat).toBe(86400);
    });

    it('should throw on invalid token', () => {
        expect(() => jwt.verify('garbage')).toThrow();
    });

    it('should throw on token with wrong issuer', () => {
        const jsonwebtoken = require('jsonwebtoken');
        const badToken = jsonwebtoken.sign({ id: '123' }, 'test-secret-key-for-testing', {
            issuer: 'wrong-issuer',
        });

        expect(() => jwt.verify(badToken)).toThrow();
    });
});
