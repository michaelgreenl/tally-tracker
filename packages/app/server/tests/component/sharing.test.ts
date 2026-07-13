import { OK, CREATED, FORBIDDEN, NOT_FOUND, CONFLICT } from '@tally/utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import app from '../../src/app.js';
import {
    buildCounter,
    buildShare,
    TEST_COUNTER_ID,
    TEST_USER_ID,
    TEST_OTHER_USER_ID,
} from '../fixtures/counter.fixture.js';

vi.mock('../../src/middleware/auth.middleware', () => ({
    jwt: (req: Request, res: Response, next: NextFunction) => {
        req.user = { id: TEST_USER_ID, email: 'test@test.com', tier: 'BASIC' };
        next();
    },
}));

vi.mock('../../src/db/repositories/counter.repository', () => ({
    post: vi.fn(),
    getAllByUser: vi.fn(),
    getByIdOrShare: vi.fn(),
    remove: vi.fn(),
    put: vi.fn(),
    increment: vi.fn(),
    getParticipants: vi.fn(),
    join: vi.fn(),
    countAcceptedJoinedSharesByUserId: vi.fn(),
    createShare: vi.fn(),
    updateShare: vi.fn(),
}));

vi.mock('../../src/db/repositories/user.repository', () => ({
    getUserTierById: vi.fn(),
}));

import * as counterRepo from '../../src/db/repositories/counter.repository.js';
import * as userRepo from '../../src/db/repositories/user.repository.js';

describe('Sharing Routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        app.set('io', { to: () => ({ emit: vi.fn() }) });
    });

    describe('POST /counters/join', () => {
        it('should return 404 for invalid invite code without tier lookup', async () => {
            vi.mocked(counterRepo.join).mockResolvedValue(null);

            const res = await request(app).post('/counters/join').send({ inviteCode: 'INVALID' });

            expect(res.status).toBe(NOT_FOUND);
            expect(userRepo.getUserTierById).not.toHaveBeenCalled();
            expect(counterRepo.countAcceptedJoinedSharesByUserId).not.toHaveBeenCalled();
        });

        it('should return 404 when invite code resolves to a personal counter', async () => {
            const counter = buildCounter({
                type: 'PERSONAL',
                inviteCode: 'ABC123',
                userId: TEST_OTHER_USER_ID,
            });
            vi.mocked(counterRepo.join).mockResolvedValue(counter);

            const res = await request(app).post('/counters/join').send({ inviteCode: 'ABC123' });

            expect(res.status).toBe(NOT_FOUND);
            expect(res.body.message).toBe('Invalid or expired invite link');
            expect(userRepo.getUserTierById).not.toHaveBeenCalled();
            expect(counterRepo.countAcceptedJoinedSharesByUserId).not.toHaveBeenCalled();
            expect(counterRepo.createShare).not.toHaveBeenCalled();
            expect(counterRepo.updateShare).not.toHaveBeenCalled();
        });

        it('should return 409 when owner tries to join own counter without tier lookup', async () => {
            const counter = buildCounter({
                type: 'SHARED',
                inviteCode: 'ABC123',
                userId: TEST_USER_ID,
            });
            vi.mocked(counterRepo.join).mockResolvedValue(counter);

            const res = await request(app).post('/counters/join').send({ inviteCode: 'ABC123' });

            expect(res.status).toBe(CONFLICT);
            expect(userRepo.getUserTierById).not.toHaveBeenCalled();
            expect(counterRepo.countAcceptedJoinedSharesByUserId).not.toHaveBeenCalled();
        });

        it('should return 200 when already joined without tier lookup', async () => {
            const counter = buildCounter({
                type: 'SHARED',
                userId: TEST_OTHER_USER_ID,
                shares: [buildShare({ userId: TEST_USER_ID, status: 'ACCEPTED' })],
            });
            vi.mocked(counterRepo.join).mockResolvedValue(counter);

            const res = await request(app).post('/counters/join').send({ inviteCode: 'ABC123' });

            expect(res.status).toBe(OK);
            expect(res.body.message).toContain('Already joined');
            expect(userRepo.getUserTierById).not.toHaveBeenCalled();
            expect(counterRepo.countAcceptedJoinedSharesByUserId).not.toHaveBeenCalled();
            expect(counterRepo.createShare).not.toHaveBeenCalled();
        });

        it('should return 404 when the persisted user record is missing', async () => {
            const counter = buildCounter({
                type: 'SHARED',
                inviteCode: 'ABC123',
                userId: TEST_OTHER_USER_ID,
            });
            vi.mocked(counterRepo.join).mockResolvedValue(counter);
            vi.mocked(userRepo.getUserTierById).mockResolvedValue(null);

            const res = await request(app).post('/counters/join').send({ inviteCode: 'ABC123' });

            expect(res.status).toBe(NOT_FOUND);
            expect(res.body.message).toBe('User not found');
            expect(counterRepo.countAcceptedJoinedSharesByUserId).not.toHaveBeenCalled();
            expect(counterRepo.createShare).not.toHaveBeenCalled();
            expect(counterRepo.updateShare).not.toHaveBeenCalled();
        });

        it('should allow a BASIC user to join a first shared counter', async () => {
            const counter = buildCounter({
                type: 'SHARED',
                inviteCode: 'ABC123',
                userId: TEST_OTHER_USER_ID,
            });
            vi.mocked(counterRepo.join).mockResolvedValue(counter);
            vi.mocked(userRepo.getUserTierById).mockResolvedValue({ id: TEST_USER_ID, tier: 'BASIC' });
            vi.mocked(counterRepo.countAcceptedJoinedSharesByUserId).mockResolvedValue(0);
            vi.mocked(counterRepo.createShare).mockResolvedValue(buildShare());

            const res = await request(app).post('/counters/join').send({ inviteCode: 'ABC123' });

            expect(res.status).toBe(CREATED);
            expect(userRepo.getUserTierById).toHaveBeenCalledWith(TEST_USER_ID, expect.anything());
            expect(counterRepo.countAcceptedJoinedSharesByUserId).toHaveBeenCalledWith(TEST_USER_ID, expect.anything());
            expect(counterRepo.createShare).toHaveBeenCalledWith(
                expect.objectContaining({
                    counterId: TEST_COUNTER_ID,
                    userId: TEST_USER_ID,
                    status: 'ACCEPTED',
                }),
                expect.anything(),
            );
        });

        it('should reject a BASIC user joining a second distinct shared counter', async () => {
            const counter = buildCounter({
                type: 'SHARED',
                inviteCode: 'ABC123',
                userId: TEST_OTHER_USER_ID,
            });
            vi.mocked(counterRepo.join).mockResolvedValue(counter);
            vi.mocked(userRepo.getUserTierById).mockResolvedValue({ id: TEST_USER_ID, tier: 'BASIC' });
            vi.mocked(counterRepo.countAcceptedJoinedSharesByUserId).mockResolvedValue(1);

            const res = await request(app).post('/counters/join').send({ inviteCode: 'ABC123' });

            expect(res.status).toBe(FORBIDDEN);
            expect(res.body.message).toBe('Basic accounts can only join one shared counter.');
            expect(counterRepo.createShare).not.toHaveBeenCalled();
            expect(counterRepo.updateShare).not.toHaveBeenCalled();
        });

        it('should allow a BASIC user to re-accept a rejected share when no accepted shares exist', async () => {
            const counter = buildCounter({
                type: 'SHARED',
                userId: TEST_OTHER_USER_ID,
                shares: [buildShare({ userId: TEST_USER_ID, status: 'REJECTED' })],
            });
            vi.mocked(counterRepo.join).mockResolvedValue(counter);
            vi.mocked(userRepo.getUserTierById).mockResolvedValue({ id: TEST_USER_ID, tier: 'BASIC' });
            vi.mocked(counterRepo.countAcceptedJoinedSharesByUserId).mockResolvedValue(0);
            vi.mocked(counterRepo.updateShare).mockResolvedValue(buildShare({ status: 'ACCEPTED' }));

            const res = await request(app).post('/counters/join').send({ inviteCode: 'ABC123' });

            expect(res.status).toBe(CREATED);
            expect(counterRepo.updateShare).toHaveBeenCalledWith(
                expect.objectContaining({ status: 'ACCEPTED' }),
                expect.anything(),
            );
            expect(counterRepo.createShare).not.toHaveBeenCalled();
        });

        it('should reject a BASIC user re-accepting a rejected share when another accepted share exists', async () => {
            const counter = buildCounter({
                type: 'SHARED',
                userId: TEST_OTHER_USER_ID,
                shares: [buildShare({ userId: TEST_USER_ID, status: 'REJECTED' })],
            });
            vi.mocked(counterRepo.join).mockResolvedValue(counter);
            vi.mocked(userRepo.getUserTierById).mockResolvedValue({ id: TEST_USER_ID, tier: 'BASIC' });
            vi.mocked(counterRepo.countAcceptedJoinedSharesByUserId).mockResolvedValue(1);

            const res = await request(app).post('/counters/join').send({ inviteCode: 'ABC123' });

            expect(res.status).toBe(FORBIDDEN);
            expect(res.body.message).toBe('Basic accounts can only join one shared counter.');
            expect(counterRepo.createShare).not.toHaveBeenCalled();
            expect(counterRepo.updateShare).not.toHaveBeenCalled();
        });

        it('should allow a PREMIUM user to join even when the BASIC cap would block the request', async () => {
            const counter = buildCounter({
                type: 'SHARED',
                inviteCode: 'ABC123',
                userId: TEST_OTHER_USER_ID,
            });
            vi.mocked(counterRepo.join).mockResolvedValue(counter);
            vi.mocked(userRepo.getUserTierById).mockResolvedValue({ id: TEST_USER_ID, tier: 'PREMIUM' });
            vi.mocked(counterRepo.countAcceptedJoinedSharesByUserId).mockResolvedValue(1);
            vi.mocked(counterRepo.createShare).mockResolvedValue(buildShare());

            const res = await request(app).post('/counters/join').send({ inviteCode: 'ABC123' });

            expect(res.status).toBe(CREATED);
            expect(counterRepo.countAcceptedJoinedSharesByUserId).not.toHaveBeenCalled();
            expect(counterRepo.createShare).toHaveBeenCalledWith(
                expect.objectContaining({ status: 'ACCEPTED' }),
                expect.anything(),
            );
        });
    });

    describe('PUT /counters/remove-shared/:counterId', () => {
        it('should set share status to rejected', async () => {
            const counter = buildCounter({ userId: TEST_OTHER_USER_ID });
            vi.mocked(counterRepo.getByIdOrShare).mockResolvedValue(counter);
            vi.mocked(counterRepo.updateShare).mockResolvedValue(buildShare({ status: 'REJECTED' }));

            const res = await request(app).put(`/counters/remove-shared/${TEST_COUNTER_ID}`);

            expect(res.status).toBe(OK);
            expect(counterRepo.updateShare).toHaveBeenCalledWith(
                expect.objectContaining({ status: 'REJECTED' }),
                expect.anything(),
            );
        });

        it('should return 409 when owner tries to remove own counter', async () => {
            const counter = buildCounter({ userId: TEST_USER_ID });
            vi.mocked(counterRepo.getByIdOrShare).mockResolvedValue(counter);

            const res = await request(app).put(`/counters/remove-shared/${TEST_COUNTER_ID}`);

            expect(res.status).toBe(CONFLICT);
        });

        it('should return 404 when counter not found', async () => {
            vi.mocked(counterRepo.getByIdOrShare).mockResolvedValue(null);

            const res = await request(app).put(`/counters/remove-shared/${TEST_COUNTER_ID}`);

            expect(res.status).toBe(NOT_FOUND);
        });
    });
});
