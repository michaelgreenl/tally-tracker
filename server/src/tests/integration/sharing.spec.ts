import { OK, CREATED, NOT_FOUND, CONFLICT } from '../../constants/status-codes.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import app from '../../app.js';
import {
    buildCounter,
    buildShare,
    TEST_COUNTER_ID,
    TEST_USER_ID,
    TEST_OTHER_USER_ID,
} from '../fixtures/counter.fixture.js';

vi.mock('../../middleware/auth.middleware', () => ({
    jwt: (req: Request, res: Response, next: NextFunction) => {
        req.user = { id: TEST_USER_ID, email: 'test@test.com', tier: 'BASIC' };
        next();
    },
}));

vi.mock('../../db/repositories/counter.repository', () => ({
    post: vi.fn(),
    getAllByUser: vi.fn(),
    getByIdOrShare: vi.fn(),
    remove: vi.fn(),
    put: vi.fn(),
    increment: vi.fn(),
    getParticipants: vi.fn(),
    join: vi.fn(),
    createShare: vi.fn(),
    updateShare: vi.fn(),
}));

vi.mock('../../db/repositories/idempotency.repository', () => ({
    get: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
}));

import * as counterRepo from '../../db/repositories/counter.repository.js';

describe('Sharing Routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        app.set('io', { to: () => ({ emit: vi.fn() }) });
    });

    describe('POST /counters/join', () => {
        it('should join a shared counter', async () => {
            const counter = buildCounter({
                type: 'SHARED',
                inviteCode: 'ABC123',
                userId: TEST_OTHER_USER_ID,
            });
            vi.mocked(counterRepo.join).mockResolvedValue(counter);
            vi.mocked(counterRepo.createShare).mockResolvedValue(buildShare());

            const res = await request(app).post('/counters/join').send({ inviteCode: 'ABC123' });

            expect(res.status).toBe(CREATED);
            expect(counterRepo.createShare).toHaveBeenCalledWith(
                expect.objectContaining({
                    counterId: TEST_COUNTER_ID,
                    userId: TEST_USER_ID,
                    status: 'ACCEPTED',
                }),
            );
        });

        it('should return 404 for invalid invite code', async () => {
            vi.mocked(counterRepo.join).mockResolvedValue(null);

            const res = await request(app).post('/counters/join').send({ inviteCode: 'INVALID' });

            expect(res.status).toBe(NOT_FOUND);
        });

        it('should return 409 when owner tries to join own counter', async () => {
            const counter = buildCounter({
                type: 'SHARED',
                inviteCode: 'ABC123',
                userId: TEST_USER_ID,
            });
            vi.mocked(counterRepo.join).mockResolvedValue(counter);

            const res = await request(app).post('/counters/join').send({ inviteCode: 'ABC123' });

            expect(res.status).toBe(CONFLICT);
        });

        it('should return 200 when already joined', async () => {
            const counter = buildCounter({
                type: 'SHARED',
                userId: TEST_OTHER_USER_ID,
                shares: [buildShare({ userId: TEST_USER_ID, status: 'ACCEPTED' })],
            });
            vi.mocked(counterRepo.join).mockResolvedValue(counter);

            const res = await request(app).post('/counters/join').send({ inviteCode: 'ABC123' });

            expect(res.status).toBe(OK);
            expect(res.body.message).toContain('Already joined');
            expect(counterRepo.createShare).not.toHaveBeenCalled();
        });

        it('should re-accept a previously rejected share', async () => {
            const counter = buildCounter({
                type: 'SHARED',
                userId: TEST_OTHER_USER_ID,
                shares: [buildShare({ userId: TEST_USER_ID, status: 'REJECTED' })],
            });
            vi.mocked(counterRepo.join).mockResolvedValue(counter);
            vi.mocked(counterRepo.updateShare).mockResolvedValue(buildShare({ status: 'ACCEPTED' }));

            const res = await request(app).post('/counters/join').send({ inviteCode: 'ABC123' });

            expect(res.status).toBe(CREATED);
            expect(counterRepo.updateShare).toHaveBeenCalledWith(expect.objectContaining({ status: 'ACCEPTED' }));
            expect(counterRepo.createShare).not.toHaveBeenCalled();
        });
    });

    describe('PUT /counters/remove-shared/:counterId', () => {
        it('should set share status to rejected', async () => {
            const counter = buildCounter({ userId: TEST_OTHER_USER_ID });
            vi.mocked(counterRepo.getByIdOrShare).mockResolvedValue(counter);
            vi.mocked(counterRepo.updateShare).mockResolvedValue(buildShare({ status: 'REJECTED' }));

            const res = await request(app).put(`/counters/remove-shared/${TEST_COUNTER_ID}`);

            expect(res.status).toBe(OK);
            expect(counterRepo.updateShare).toHaveBeenCalledWith(expect.objectContaining({ status: 'REJECTED' }));
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
