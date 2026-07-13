import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import jsonwebtoken, { type JwtPayload, type SignOptions } from 'jsonwebtoken';

import jwt from '../jwt.util.js';

const AUDIENCE = 'reaction-client';
const FIXED_TIME = new Date('2026-01-15T12:00:00.000Z');
const ISSUER = 'reaction-api';
const TEST_JWT_SECRET = 'vitest-only-jwt-secret';
const TEST_USER_ID = 'user-123';
const WRONG_JWT_SECRET = 'wrong-vitest-jwt-secret';

type DecodedToken = JwtPayload & {
    aud: string;
    exp: number;
    iat: number;
    id: string;
    iss: string;
};

type FixtureOptions = {
    audience?: string;
    expiresIn?: SignOptions['expiresIn'];
    issuer?: string;
    secret?: string;
};

const decodeToken = (token: string) => {
    const decoded = jsonwebtoken.decode(token);

    expect(decoded).not.toBeNull();
    expect(typeof decoded).toBe('object');

    return decoded as DecodedToken;
};

const signFixture = ({
    audience = AUDIENCE,
    expiresIn = '45m',
    issuer = ISSUER,
    secret = TEST_JWT_SECRET,
}: FixtureOptions = {}) =>
    jsonwebtoken.sign({ id: TEST_USER_ID }, secret, {
        audience,
        expiresIn,
        issuer,
    });

const getVerificationError = (token: string) => {
    try {
        jwt.verify(token);
    } catch (error) {
        return error;
    }

    throw new Error('Expected token verification to fail');
};

describe('JWT Util', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(FIXED_TIME);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('signs the expected claims with a 45 minute expiry by default', () => {
        const token = jwt.sign({ id: TEST_USER_ID });
        const decoded = decodeToken(token);
        const issuedAt = Math.floor(FIXED_TIME.getTime() / 1000);

        expect(decoded).toMatchObject({
            aud: AUDIENCE,
            exp: issuedAt + 45 * 60,
            iat: issuedAt,
            id: TEST_USER_ID,
            iss: ISSUER,
        });
    });

    it('signs a custom expiry', () => {
        const token = jwt.sign({ id: TEST_USER_ID }, '1d');
        const decoded = decodeToken(token);

        expect(decoded.exp - decoded.iat).toBe(24 * 60 * 60);
    });

    it('rejects a token with the wrong issuer', () => {
        const token = signFixture({ issuer: 'wrong-issuer' });
        const error = getVerificationError(token);

        expect(error).toMatchObject({
            message: `jwt issuer invalid. expected: ${ISSUER}`,
            name: 'JsonWebTokenError',
        });
    });

    it('rejects a token with the wrong audience', () => {
        const token = signFixture({ audience: 'wrong-audience' });
        const error = getVerificationError(token);

        expect(error).toMatchObject({
            message: `jwt audience invalid. expected: ${AUDIENCE}`,
            name: 'JsonWebTokenError',
        });
    });

    it('rejects an expired token', () => {
        const token = signFixture({ expiresIn: -1 });
        const error = getVerificationError(token);

        expect(error).toMatchObject({
            message: 'jwt expired',
            name: 'TokenExpiredError',
        });
    });

    it('rejects a token signed with the wrong secret', () => {
        const token = signFixture({ secret: WRONG_JWT_SECRET });
        const error = getVerificationError(token);

        expect(error).toMatchObject({
            message: 'invalid signature',
            name: 'JsonWebTokenError',
        });
    });
});
