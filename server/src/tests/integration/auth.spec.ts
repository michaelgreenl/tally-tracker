import { OK, CREATED, UNAUTHORIZED, NOT_FOUND, UNPROCESSABLE_ENTITY } from '../../constants/status-codes.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app.js';
import { buildUser, buildClientUser } from '../fixtures/user.fixture.js';
import { buildRefreshToken, TEST_USER_ID, TEST_REFRESH_TOKEN_ID } from '../fixtures/counter.fixture.js';

vi.mock('../../db/repositories/user.repository', () => ({
    createUser: vi.fn(),
    getUserByEmail: vi.fn(),
    getUserByPhone: vi.fn(),
    getUserById: vi.fn(),
    updateUserInfo: vi.fn(),
    deleteUser: vi.fn(),
}));

vi.mock('../../db/repositories/token.repository', () => ({
    create: vi.fn(),
    get: vi.fn(),
    remove: vi.fn(),
    removeAllForUser: vi.fn(),
}));

import * as userRepository from '../../db/repositories/user.repository.js';
import * as tokenRepository from '../../db/repositories/token.repository.js';

describe('Auth Routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('POST /users (register)', () => {
        it('should create a user and return 201', async () => {
            vi.mocked(userRepository.createUser).mockResolvedValue(buildUser());

            const res = await request(app).post('/users').send({
                email: 'new@test.com',
                password: 'password123',
            });

            expect(res.status).toBe(CREATED);
            expect(res.body.success).toBe(true);
            expect(userRepository.createUser).toHaveBeenCalledWith(expect.objectContaining({ email: 'new@test.com' }));
        });

        it('should reject registration without email or phone', async () => {
            const res = await request(app).post('/users').send({
                password: 'password123',
            });

            expect(res.status).toBe(UNPROCESSABLE_ENTITY);
        });

        it('should reject weak passwords', async () => {
            const res = await request(app).post('/users').send({
                email: 'new@test.com',
                password: '123',
            });

            expect(res.status).toBe(UNPROCESSABLE_ENTITY);
        });
    });

    describe('POST /users/login', () => {
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

        it('should return 404 for unknown email', async () => {
            vi.mocked(userRepository.getUserByEmail).mockResolvedValue(null);

            const res = await request(app).post('/users/login').send({
                email: 'unknown@test.com',
                password: 'password123',
            });

            expect(res.status).toBe(NOT_FOUND);
        });

        it('should return 401 for wrong password', async () => {
            vi.mocked(userRepository.getUserByEmail).mockResolvedValue(buildUser());

            const res = await request(app).post('/users/login').send({
                email: 'test@test.com',
                password: 'wrongpassword',
            });

            expect(res.status).toBe(UNAUTHORIZED);
        });

        it('should login with phone number', async () => {
            vi.mocked(userRepository.getUserByPhone).mockResolvedValue(
                buildUser({ email: null, phone: '+15551234567' }),
            );

            const res = await request(app).post('/users/login').send({
                phone: '+15551234567',
                password: 'password123',
            });

            expect(res.status).toBe(OK);
            expect(res.body.data.user.phone).toBe('+15551234567');
        });
    });

    describe('POST /users/refresh', () => {
        const NEW_REFRESH_TOKEN_ID = randomUUID();

        it('should rotate tokens with valid refresh token', async () => {
            const oldToken = buildRefreshToken();
            const newToken = buildRefreshToken({ id: NEW_REFRESH_TOKEN_ID });

            vi.mocked(tokenRepository.get).mockResolvedValue(oldToken);
            vi.mocked(tokenRepository.remove).mockResolvedValue(oldToken);
            vi.mocked(tokenRepository.create).mockResolvedValue(newToken);
            vi.mocked(userRepository.getUserById).mockResolvedValue(buildClientUser() as any);

            const res = await request(app).post('/users/refresh').send({ refreshToken: TEST_REFRESH_TOKEN_ID });

            expect(res.status).toBe(OK);
            expect(res.body.data.accessToken).toBeDefined();
            expect(res.body.data.refreshToken).toBe(NEW_REFRESH_TOKEN_ID);
            expect(tokenRepository.remove).toHaveBeenCalledWith(TEST_REFRESH_TOKEN_ID);
        });

        it('should return 401 for expired refresh token', async () => {
            const expiredToken = buildRefreshToken({
                expiresAt: new Date('2020-01-01'),
            });

            vi.mocked(tokenRepository.get).mockResolvedValue(expiredToken);
            vi.mocked(tokenRepository.remove).mockResolvedValue(expiredToken);

            const res = await request(app).post('/users/refresh').send({ refreshToken: TEST_REFRESH_TOKEN_ID });

            expect(res.status).toBe(UNAUTHORIZED);
            expect(tokenRepository.remove).toHaveBeenCalledWith(TEST_REFRESH_TOKEN_ID);
        });

        it('should return 401 for unknown refresh token', async () => {
            vi.mocked(tokenRepository.get).mockResolvedValue(null);

            const res = await request(app).post('/users/refresh').send({ refreshToken: TEST_REFRESH_TOKEN_ID });

            expect(res.status).toBe(UNAUTHORIZED);
        });

        it('should return 401 when no refresh token provided', async () => {
            const res = await request(app).post('/users/refresh').send({});

            expect(res.status).toBe(UNAUTHORIZED);
        });
    });

    describe('POST /users/logout', () => {
        it('should clear tokens and cookies', async () => {
            const token = buildRefreshToken();
            vi.mocked(tokenRepository.get).mockResolvedValue(token);
            vi.mocked(tokenRepository.removeAllForUser).mockResolvedValue({ count: 1 } as any);

            const res = await request(app)
                .post('/users/logout')
                .set('Cookie', `refresh_token=${TEST_REFRESH_TOKEN_ID}`);

            expect(res.status).toBe(OK);
            expect(tokenRepository.removeAllForUser).toHaveBeenCalledWith(TEST_USER_ID);
        });

        it('should succeed even without a refresh token cookie', async () => {
            const res = await request(app).post('/users/logout');

            expect(res.status).toBe(OK);
        });
    });
});
