import { OK, CREATED, NOT_FOUND, UNPROCESSABLE_ENTITY } from '../../constants/status-codes.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app.js';
import { buildCounter, TEST_COUNTER_ID, TEST_OTHER_USER_ID, TEST_USER_ID } from '../fixtures/counter.fixture.js';

vi.mock('../../middleware/auth.middleware', () => ({
    jwt: (req: Request, res: Response, next: NextFunction) => {
        req.user = { id: TEST_USER_ID, email: 'test@test.com', tier: 'PREMIUM' };
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

import * as counterRepository from '../../db/repositories/counter.repository.js';

describe('Counter Routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        app.set('io', { to: () => ({ emit: vi.fn() }) });
    });

    describe('POST /counters', () => {
        it('should create a personal counter', async () => {
            const counter = buildCounter({ title: 'Push Ups' });
            vi.mocked(counterRepository.post).mockResolvedValue(counter);

            const res = await request(app).post('/counters').send({ title: 'Push Ups' });

            expect(res.status).toBe(CREATED);
            expect(res.body.data.counter.title).toBe('Push Ups');
        });

        it('should create a shared counter with invite code', async () => {
            const counter = buildCounter({ type: 'SHARED', inviteCode: 'ABC123' });
            vi.mocked(counterRepository.post).mockResolvedValue(counter);

            const res = await request(app)
                .post('/counters')
                .send({ title: 'Shared', type: 'SHARED', inviteCode: 'ABC123' });

            expect(res.status).toBe(CREATED);
            expect(res.body.data.counter.type).toBe('SHARED');
        });

        it('should reject shared counter without invite code', async () => {
            const res = await request(app).post('/counters').send({ title: 'Broken', type: 'SHARED' });

            expect(res.status).toBe(UNPROCESSABLE_ENTITY);
        });

        it('should reject empty title', async () => {
            const res = await request(app).post('/counters').send({ title: '' });

            expect(res.status).toBe(UNPROCESSABLE_ENTITY);
        });

        it('should reject title over 50 characters', async () => {
            const res = await request(app)
                .post('/counters')
                .send({ title: 'A'.repeat(51) });

            expect(res.status).toBe(UNPROCESSABLE_ENTITY);
        });
    });

    describe('GET /counters', () => {
        it('should return all counters for the user', async () => {
            const counters = [
                buildCounter({ id: randomUUID(), title: 'Counter A' }),
                buildCounter({ id: randomUUID(), title: 'Counter B' }),
            ];
            vi.mocked(counterRepository.getAllByUser).mockResolvedValue(counters);

            const res = await request(app).get('/counters');

            expect(res.status).toBe(OK);
            expect(res.body.data.counters).toHaveLength(2);
        });

        it('should return empty array when user has no counters', async () => {
            vi.mocked(counterRepository.getAllByUser).mockResolvedValue([]);

            const res = await request(app).get('/counters');

            expect(res.status).toBe(OK);
            expect(res.body.data.counters).toHaveLength(0);
        });
    });

    describe('DELETE /counters/:counterId', () => {
        it('should delete an owned counter', async () => {
            vi.mocked(counterRepository.remove).mockResolvedValue(buildCounter());

            const res = await request(app).delete(`/counters/${TEST_COUNTER_ID}`);

            expect(res.status).toBe(OK);
            expect(counterRepository.remove).toHaveBeenCalledWith({
                counterId: TEST_COUNTER_ID,
                userId: TEST_USER_ID,
            });
        });

        it('should reject invalid UUID', async () => {
            const res = await request(app).delete('/counters/not-a-uuid');

            expect(res.status).toBe(UNPROCESSABLE_ENTITY);
        });
    });

    describe('PUT /counters/increment/:counterId', () => {
        // sure
        it('should increment and broadcast to participants', async () => {
            const counter = buildCounter({ count: 6 });
            vi.mocked(counterRepository.increment).mockResolvedValue(counter);
            vi.mocked(counterRepository.getParticipants).mockResolvedValue([TEST_USER_ID, TEST_OTHER_USER_ID]);

            const mockEmit = vi.fn();
            app.set('io', { to: () => ({ emit: mockEmit }) });

            const res = await request(app).put(`/counters/increment/${TEST_COUNTER_ID}`).send({ amount: 1 });

            expect(res.status).toBe(OK);
            expect(res.body.data.counter.count).toBe(6);
            expect(counterRepository.getParticipants).toHaveBeenCalledWith(TEST_COUNTER_ID);
            expect(mockEmit).toHaveBeenCalledTimes(2);
            expect(mockEmit).toHaveBeenCalledWith('counter-update', counter);
        });

        it('should return 404 when user has no access', async () => {
            vi.mocked(counterRepository.increment).mockResolvedValue(null);

            const res = await request(app).put(`/counters/increment/${TEST_COUNTER_ID}`).send({ amount: 1 });

            expect(res.status).toBe(NOT_FOUND);
        });

        it('should allow negative increments (decrement)', async () => {
            const counter = buildCounter({ count: 4 });
            vi.mocked(counterRepository.increment).mockResolvedValue(counter);
            vi.mocked(counterRepository.getParticipants).mockResolvedValue([TEST_USER_ID]);
            app.set('io', { to: () => ({ emit: vi.fn() }) });

            const res = await request(app).put(`/counters/increment/${TEST_COUNTER_ID}`).send({ amount: -1 });

            expect(res.status).toBe(OK);
        });
    });

    describe('PUT /counters/update/:counterId', () => {
        it('should update counter fields', async () => {
            const counter = buildCounter({ title: 'Updated Title', color: '#FF0000' });
            vi.mocked(counterRepository.put).mockResolvedValue(counter);

            const res = await request(app)
                .put(`/counters/update/${TEST_COUNTER_ID}`)
                .send({ title: 'Updated Title', color: '#FF0000' });

            expect(res.status).toBe(OK);
            expect(res.body.data.counter.title).toBe('Updated Title');
        });

        it('should return 404 when counter not found', async () => {
            vi.mocked(counterRepository.put).mockResolvedValue(null);

            const res = await request(app).put(`/counters/update/${TEST_COUNTER_ID}`).send({ title: 'Nope' });

            expect(res.status).toBe(NOT_FOUND);
        });
    });
});
