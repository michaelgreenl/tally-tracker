import { OK, CREATED, OK_NO_CONTENT, UNAUTHORIZED, UNPROCESSABLE_ENTITY, SERVER_ERROR } from '@tally/core';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import type { Prisma } from '@prisma/client';
import app from '../../src/app.js';
import { buildUser } from '../fixtures/user.fixture.js';
import { buildRefreshToken, TEST_USER_ID, TEST_REFRESH_TOKEN_ID } from '../fixtures/counter.fixture.js';

vi.mock('../../src/middleware/auth.middleware', () => ({
    jwt: (req: Request, res: Response, next: NextFunction) => {
        if (req.headers.authorization === 'Bearer invalid-token') {
            return res.status(401).json({ success: false, message: 'Invalid token' });
        }

        req.user = { id: TEST_USER_ID, email: 'test@test.com', emailVerifiedAt: null, sessionVersion: 0 };
        next();
    },
}));

vi.mock('../../src/db/repositories/user.repository', () => ({
    createUser: vi.fn(),
    getUserByEmail: vi.fn(),
    getUserById: vi.fn(),
    getUserAuthById: vi.fn(),
    deleteAccount: vi.fn(),
    deleteUser: vi.fn(),
    withLockedUser: vi.fn(),
}));

vi.mock('../../src/db/repositories/email-otp.repository', () => ({
    issue: vi.fn(),
    verifyEmail: vi.fn(),
    resetPassword: vi.fn(),
}));

vi.mock('../../src/services/email-otp.service', () => ({
    digestEmailOtp: vi.fn(() => 'otp-digest'),
    issueEmailOtp: vi.fn(),
}));

vi.mock('../../src/db/repositories/token.repository', () => ({
    create: vi.fn(),
    get: vi.fn(),
    remove: vi.fn(),
    removeAllForUser: vi.fn(),
    rotate: vi.fn(),
    revokeSession: vi.fn(),
}));

import * as userRepository from '../../src/db/repositories/user.repository.js';
import * as emailOtpRepository from '../../src/db/repositories/email-otp.repository.js';
import * as tokenRepository from '../../src/db/repositories/token.repository.js';
import { issueEmailOtp } from '../../src/services/email-otp.service.js';

describe('Auth Routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(issueEmailOtp).mockResolvedValue();
        vi.mocked(userRepository.withLockedUser).mockImplementation(async (_id, action) =>
            action(buildUser(), {
                refreshToken: { create: tokenRepository.create },
            } as unknown as Prisma.TransactionClient),
        );
        vi.mocked(tokenRepository.rotate).mockResolvedValue(null);
        vi.mocked(tokenRepository.revokeSession).mockResolvedValue(null);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllEnvs();
    });

    describe('OPTIONS /users/login', () => {
        it.each([
            ['local Expo web', 'http://localhost:8081', ''],
            ['deployed web', 'https://michaelgreenl.github.io', 'https://michaelgreenl.github.io/tally-tracker'],
        ])('allows the %s origin', async (_name, origin, frontendUrl) => {
            vi.stubEnv('FRONTEND_URL', frontendUrl);
            const res = await request(app)
                .options('/users/login')
                .set('Origin', origin)
                .set('Access-Control-Request-Method', 'POST')
                .set('Access-Control-Request-Headers', 'Content-Type, Authorization');

            expect(res.status).toBe(OK_NO_CONTENT);
            expect(res.headers['access-control-allow-origin']).toBe(origin);
            expect(res.headers['access-control-allow-credentials']).toBe('true');
        });

        it('rejects private-network browser origins in production', async () => {
            vi.stubEnv('NODE_ENV', 'production');

            const res = await request(app)
                .options('/users/login')
                .set('Origin', 'http://192.168.1.20:8081')
                .set('Access-Control-Request-Method', 'POST');

            expect(res.headers['access-control-allow-origin']).toBeUndefined();
        });
    });

    describe('POST /users (register)', () => {
        it('should create a user and return 201', async () => {
            vi.mocked(userRepository.createUser).mockResolvedValue(buildUser());

            const res = await request(app).post('/users').send({
                email: 'new@test.com',
                password: 'New-password123',
            });

            expect(res.status).toBe(CREATED);
            expect(res.body.success).toBe(true);
            expect(userRepository.createUser).toHaveBeenCalledWith(expect.objectContaining({ email: 'new@test.com' }));
            expect(issueEmailOtp).toHaveBeenCalledWith(
                expect.objectContaining({ email: 'test@test.com' }),
                'EMAIL_VERIFICATION',
            );
        });

        it('should reject registration without email', async () => {
            const res = await request(app).post('/users').send({
                password: 'New-password123',
            });

            expect(res.status).toBe(UNPROCESSABLE_ENTITY);
        });
    });

    describe.each([
        ['post', '/users'],
        ['post', '/users/reset-password'],
    ] as const)('%s %s password requirements', (method, path) => {
        it.each([
            `A1${'a'.repeat(12)}`,
            `A1${'😀'.repeat(7)}`,
            'abcdefghijklmno1',
            'Abcdefghijklmnop',
            `Ab1${'a'.repeat(70)}`,
            `Ab1${'é'.repeat(35)}`,
        ])('rejects an invalid new password: %s', async (password) => {
            const res = await request(app)[method](path).send({
                email: 'test@test.com',
                code: '123456',
                password,
            });

            expect(res.status).toBe(UNPROCESSABLE_ENTITY);
            expect(res.body.errors).toEqual(
                expect.arrayContaining([expect.objectContaining({ field: 'body.password' })]),
            );
        });
    });

    describe('POST /users/login', () => {
        it('keeps internal login failures out of the response and console output', async () => {
            const secret = 'database-password-fixture';
            const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
            vi.mocked(userRepository.getUserByEmail).mockRejectedValueOnce(new Error(`Database failure: ${secret}`));

            const res = await request(app)
                .post('/users/login')
                .send({ email: 'test@test.com', password: 'Password123' });

            expect(res.status).toBe(SERVER_ERROR);
            expect(res.body).toEqual({ success: false, message: 'Something went wrong. Please try again later.' });
            expect(log.mock.calls.flat().join(' ')).not.toContain(secret);
        });

        it('should login with valid email and return tokens', async () => {
            vi.mocked(userRepository.getUserByEmail).mockResolvedValue(buildUser());
            vi.mocked(tokenRepository.create).mockResolvedValue(buildRefreshToken());

            const res = await request(app).post('/users/login').send({
                email: 'test@test.com',
                password: 'password123',
                rememberMe: true,
            });

            expect(res.status).toBe(OK);
            expect(res.body.success).toBe(true);
            expect(res.body.data.user).toBeDefined();
            expect(res.body.data.user.password).toBeUndefined();
            expect(res.body.data.accessToken).toBeDefined();
            expect(res.body.data.refreshToken).toBeDefined();
        });

        it('should login without refresh token when rememberMe is false', async () => {
            vi.mocked(userRepository.getUserByEmail).mockResolvedValue(buildUser());

            const res = await request(app).post('/users/login').send({
                email: 'test@test.com',
                password: 'password123',
            });

            expect(res.status).toBe(OK);
            expect(res.body.data.accessToken).toBeDefined();
            expect(res.body.data.refreshToken).toBeUndefined();
            expect(tokenRepository.create).not.toHaveBeenCalled();
        });

        it('should set cookies on login', async () => {
            vi.mocked(userRepository.getUserByEmail).mockResolvedValue(buildUser());
            vi.mocked(tokenRepository.create).mockResolvedValue(buildRefreshToken());

            const res = await request(app).post('/users/login').send({
                email: 'test@test.com',
                password: 'password123',
                rememberMe: true,
            });

            const cookies = res.headers['set-cookie'];
            expect(cookies).toBeDefined();

            const cookieStr = Array.isArray(cookies) ? cookies.join('; ') : cookies;
            expect(cookieStr).toContain('access_token');
            expect(cookieStr).toContain('refresh_token');
        });

        it('uses the same public error for unknown email and wrong password', async () => {
            vi.mocked(userRepository.getUserByEmail).mockResolvedValue(null);
            const compare = vi.spyOn(bcrypt, 'compare');
            const unknown = await request(app).post('/users/login').send({
                email: 'unknown@test.com',
                password: 'wrongpassword',
            });
            expect(compare).toHaveBeenCalledOnce();
            vi.mocked(userRepository.getUserByEmail).mockResolvedValue(buildUser());
            const wrong = await request(app).post('/users/login').send({
                email: 'test@test.com',
                password: 'wrongpassword',
            });
            expect(unknown.status).toBe(UNAUTHORIZED);
            expect(wrong.status).toBe(UNAUTHORIZED);
            expect(unknown.body).toEqual(wrong.body);
            expect(unknown.headers['set-cookie']).toBeUndefined();
            expect(wrong.headers['set-cookie']).toBeUndefined();
        });
    });

    describe('POST /users/refresh', () => {
        const NEW_REFRESH_TOKEN_ID = randomUUID();

        it('should rotate tokens with valid refresh token', async () => {
            const oldToken = buildRefreshToken();
            const newToken = buildRefreshToken({ id: NEW_REFRESH_TOKEN_ID });
            vi.mocked(tokenRepository.rotate).mockResolvedValue({ user: buildUser(), token: newToken });

            const res = await request(app).post('/users/refresh').send({ refreshToken: TEST_REFRESH_TOKEN_ID });

            expect(res.status).toBe(OK);
            expect(res.body.data.accessToken).toBeDefined();
            expect(res.body.data.refreshToken).toBe(NEW_REFRESH_TOKEN_ID);
            expect(tokenRepository.rotate).toHaveBeenCalledWith(oldToken.id, expect.any(Date), undefined);
        });

        it('should return 401 when the refresh credential is rejected', async () => {
            vi.mocked(tokenRepository.rotate).mockResolvedValue(null);

            const res = await request(app).post('/users/refresh').send({ refreshToken: TEST_REFRESH_TOKEN_ID });

            expect(res.status).toBe(UNAUTHORIZED);
        });

        it('should return 401 when no refresh token provided', async () => {
            const res = await request(app).post('/users/refresh').send({});

            expect(res.status).toBe(UNAUTHORIZED);
        });
    });

    describe('email codes', () => {
        it('does not reveal whether a password-reset account exists', async () => {
            vi.mocked(userRepository.getUserByEmail).mockResolvedValueOnce(buildUser()).mockResolvedValueOnce(null);

            const known = await request(app).post('/users/reset-password/request').send({ email: 'test@test.com' });
            const missing = await request(app)
                .post('/users/reset-password/request')
                .send({ email: 'missing@test.com' });

            expect({ status: missing.status, body: missing.body }).toEqual({ status: known.status, body: known.body });
            expect(issueEmailOtp).toHaveBeenCalledOnce();
            expect(issueEmailOtp).toHaveBeenCalledWith(expect.objectContaining({ id: TEST_USER_ID }), 'PASSWORD_RESET');
        });

        it('rejects an invalid email verification code', async () => {
            vi.mocked(userRepository.getUserByEmail).mockResolvedValue(buildUser());
            vi.mocked(emailOtpRepository.verifyEmail).mockResolvedValue(false);

            const res = await request(app).post('/users/verify-email').send({
                email: 'test@test.com',
                code: '123456',
            });

            expect(res.status).toBe(UNPROCESSABLE_ENTITY);
        });
    });

    describe('POST /users/logout', () => {
        it('should clear tokens and cookies', async () => {
            const res = await request(app)
                .post('/users/logout')
                .set('Cookie', `refresh_token=${TEST_REFRESH_TOKEN_ID}`);

            expect(res.status).toBe(OK);
            expect(tokenRepository.revokeSession).toHaveBeenCalledWith(null, TEST_REFRESH_TOKEN_ID, undefined);
        });

        it('should clear tokens using a refresh token in the request body', async () => {
            const res = await request(app).post('/users/logout').send({ refreshToken: TEST_REFRESH_TOKEN_ID });

            expect(res.status).toBe(OK);
            expect(tokenRepository.revokeSession).toHaveBeenCalledWith(null, TEST_REFRESH_TOKEN_ID, undefined);
        });

        it('should succeed even without a refresh token cookie', async () => {
            const res = await request(app).post('/users/logout');

            expect(res.status).toBe(OK);
        });
    });

    describe('DELETE /users', () => {
        it('should delete the authenticated account', async () => {
            const deletionResult = {
                deleted: true,
                idempotencyLogsDeleted: 2,
            } satisfies Awaited<ReturnType<typeof userRepository.deleteAccount>>;

            vi.mocked(userRepository.deleteAccount).mockResolvedValue(deletionResult);

            const res = await request(app).delete('/users');

            expect(res.status).toBe(OK);
            expect(res.body.success).toBe(true);
            expect(userRepository.deleteAccount).toHaveBeenCalledWith(TEST_USER_ID);
        });

        it('should clear access and refresh cookies after deletion', async () => {
            const deletionResult = {
                deleted: true,
                idempotencyLogsDeleted: 0,
            } satisfies Awaited<ReturnType<typeof userRepository.deleteAccount>>;

            vi.mocked(userRepository.deleteAccount).mockResolvedValue(deletionResult);

            const res = await request(app)
                .delete('/users')
                .set('Cookie', [`access_token=old-access`, `refresh_token=${TEST_REFRESH_TOKEN_ID}`]);

            const cookies = res.headers['set-cookie'];
            const cookieStr = Array.isArray(cookies) ? cookies.join('; ') : cookies;

            expect(res.status).toBe(OK);
            expect(cookieStr).toContain('access_token=;');
            expect(cookieStr).toContain('refresh_token=;');
            expect(cookieStr).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
        });

        it('should succeed when the account is already deleted', async () => {
            const deletionResult = {
                deleted: false,
                idempotencyLogsDeleted: 0,
            } satisfies Awaited<ReturnType<typeof userRepository.deleteAccount>>;

            vi.mocked(userRepository.deleteAccount).mockResolvedValue(deletionResult);

            const res = await request(app).delete('/users');

            expect(res.status).toBe(OK);
            expect(res.body.success).toBe(true);
        });

        it('should reject unauthenticated deletion', async () => {
            const res = await request(app).delete('/users').set('Authorization', 'Bearer invalid-token');

            expect(res.status).toBe(UNAUTHORIZED);
            expect(userRepository.deleteAccount).not.toHaveBeenCalled();
        });
    });
});
