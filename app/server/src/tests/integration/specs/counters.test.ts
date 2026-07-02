import { OK, CREATED, FORBIDDEN, NOT_FOUND, UNPROCESSABLE_ENTITY, SERVER_ERROR } from '@tally/utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../../app.js';
import { buildCounter, TEST_COUNTER_ID, TEST_OTHER_USER_ID, TEST_USER_ID } from '../fixtures/counter.fixture.js';

const prismaMock = vi.hoisted(() => {
    type IdempotencyLog = {
        key: string;
        userId: string;
        requestHash?: string;
        status: 'IN_PROGRESS' | 'COMPLETED';
        responseStatus?: number;
        responseBody?: unknown;
        createdAt: Date;
        updatedAt: Date;
    };

    const idempotencyLogs = new Map<string, IdempotencyLog>();

    const restoreLogs = (snapshot: Map<string, IdempotencyLog>) => {
        idempotencyLogs.clear();
        snapshot.forEach((value, key) => idempotencyLogs.set(key, { ...value }));
    };

    const tx = {
        idempotencyLog: {
            create: vi.fn(async ({ data }: { data: Omit<IdempotencyLog, 'createdAt' | 'updatedAt'> }) => {
                if (idempotencyLogs.has(data.key)) {
                    throw { code: 'P2002' };
                }

                const log = {
                    ...data,
                    createdAt: new Date('2026-01-01'),
                    updatedAt: new Date('2026-01-01'),
                };
                idempotencyLogs.set(data.key, log);
                return log;
            }),
            update: vi.fn(async ({ where, data }: { where: { key: string }; data: Partial<IdempotencyLog> }) => {
                const existing = idempotencyLogs.get(where.key);
                if (!existing) throw new Error(`Missing idempotency log ${where.key}`);

                const log = {
                    ...existing,
                    ...data,
                    updatedAt: new Date('2026-01-01'),
                };
                idempotencyLogs.set(where.key, log);
                return log;
            }),
        },
    };

    const prisma = {
        $transaction: vi.fn(async (handler: (txClient: unknown) => Promise<unknown>) => {
            const snapshot = new Map(idempotencyLogs);

            try {
                return await handler(tx);
            } catch (error) {
                restoreLogs(snapshot);
                throw error;
            }
        }),
        idempotencyLog: {
            findUnique: vi.fn(async ({ where }: { where: { key: string } }) => idempotencyLogs.get(where.key) ?? null),
        },
    };

    return { idempotencyLogs, prisma, tx };
});

vi.mock('../../../middleware/auth.middleware', () => ({
    jwt: (req: Request, res: Response, next: NextFunction) => {
        req.user = { id: TEST_USER_ID, email: 'test@test.com', tier: 'PREMIUM' };
        next();
    },
}));

vi.mock('../../../db/prisma', () => ({
    default: prismaMock.prisma,
}));

vi.mock('../../../db/repositories/counter.repository', () => ({
    post: vi.fn(),
    getAllByUser: vi.fn(),
    getByIdOrShare: vi.fn(),
    remove: vi.fn(),
    put: vi.fn(),
    setCount: vi.fn(),
    increment: vi.fn(),
    getParticipants: vi.fn(),
    join: vi.fn(),
    createShare: vi.fn(),
    updateShare: vi.fn(),
}));

vi.mock('../../../db/repositories/user.repository', () => ({
    getUserTierById: vi.fn(),
}));

import * as counterRepository from '../../../db/repositories/counter.repository.js';
import * as userRepository from '../../../db/repositories/user.repository.js';

describe('Counter Routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        prismaMock.idempotencyLogs.clear();
        app.set('io', { to: () => ({ emit: vi.fn() }) });
    });

    describe('POST /counters', () => {
        it('should create a personal counter without tier lookup', async () => {
            const counter = buildCounter({ title: 'Push Ups' });
            vi.mocked(userRepository.getUserTierById).mockResolvedValue({ id: TEST_USER_ID, tier: 'BASIC' });
            vi.mocked(counterRepository.post).mockResolvedValue(counter);

            const res = await request(app).post('/counters').send({ title: 'Push Ups' });

            expect(res.status).toBe(CREATED);
            expect(res.body.data.counter.title).toBe('Push Ups');
            expect(userRepository.getUserTierById).not.toHaveBeenCalled();
        });

        it('should reject shared counter creation for persisted BASIC users', async () => {
            vi.mocked(userRepository.getUserTierById).mockResolvedValue({ id: TEST_USER_ID, tier: 'BASIC' });

            const res = await request(app)
                .post('/counters')
                .send({ title: 'Shared', type: 'SHARED', inviteCode: 'ABC123' });

            expect(res.status).toBe(FORBIDDEN);
            expect(res.body.message).toBe('Basic accounts cannot create shared counters.');
            expect(userRepository.getUserTierById).toHaveBeenCalledWith(TEST_USER_ID, expect.anything());
            expect(counterRepository.post).not.toHaveBeenCalled();
        });

        it('should create a shared counter for persisted PREMIUM users', async () => {
            const counter = buildCounter({ type: 'SHARED', inviteCode: 'ABC123' });
            vi.mocked(userRepository.getUserTierById).mockResolvedValue({ id: TEST_USER_ID, tier: 'PREMIUM' });
            vi.mocked(counterRepository.post).mockResolvedValue(counter);

            const res = await request(app)
                .post('/counters')
                .send({ title: 'Shared', type: 'SHARED', inviteCode: 'ABC123' });

            expect(res.status).toBe(CREATED);
            expect(res.body.data.counter.type).toBe('SHARED');
            expect(userRepository.getUserTierById).toHaveBeenCalledWith(TEST_USER_ID, expect.anything());
        });

        it('should return 404 when the persisted user record is missing for shared counters', async () => {
            vi.mocked(userRepository.getUserTierById).mockResolvedValue(null);

            const res = await request(app)
                .post('/counters')
                .send({ title: 'Shared', type: 'SHARED', inviteCode: 'ABC123' });

            expect(res.status).toBe(NOT_FOUND);
            expect(res.body.message).toBe('User not found');
            expect(userRepository.getUserTierById).toHaveBeenCalledWith(TEST_USER_ID, expect.anything());
            expect(counterRepository.post).not.toHaveBeenCalled();
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
            expect(counterRepository.remove).toHaveBeenCalledWith(
                {
                    counterId: TEST_COUNTER_ID,
                    userId: TEST_USER_ID,
                },
                expect.anything(),
            );
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
            expect(counterRepository.getParticipants).toHaveBeenCalledWith(TEST_COUNTER_ID, expect.anything());
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

        it('should reject count updates on the metadata update route', async () => {
            const res = await request(app).put(`/counters/update/${TEST_COUNTER_ID}`).send({ count: 0 });

            expect(res.status).toBe(UNPROCESSABLE_ENTITY);
            expect(counterRepository.put).not.toHaveBeenCalled();
        });

        it('should return 404 when counter not found', async () => {
            vi.mocked(counterRepository.put).mockResolvedValue(null);

            const res = await request(app).put(`/counters/update/${TEST_COUNTER_ID}`).send({ title: 'Nope' });

            expect(res.status).toBe(NOT_FOUND);
        });

        it('should retry a failed mutation with the same idempotency key', async () => {
            const idempotencyKey = 'retry-after-failure';
            const counter = buildCounter({ title: 'Retried Title' });

            vi.mocked(counterRepository.put)
                .mockRejectedValueOnce(new Error('Transient database failure'))
                .mockResolvedValueOnce(counter);

            const first = await request(app)
                .put(`/counters/update/${TEST_COUNTER_ID}`)
                .set('X-Idempotency-Key', idempotencyKey)
                .send({ title: 'Retried Title' });

            const second = await request(app)
                .put(`/counters/update/${TEST_COUNTER_ID}`)
                .set('X-Idempotency-Key', idempotencyKey)
                .send({ title: 'Retried Title' });

            expect(first.status).toBe(SERVER_ERROR);
            expect(second.status).toBe(OK);
            expect(counterRepository.put).toHaveBeenCalledTimes(2);
            expect(second.body.data.counter.title).toBe('Retried Title');
        });

        it('should replay a completed mutation response for duplicate idempotency keys', async () => {
            const idempotencyKey = 'already-completed';
            const counter = buildCounter({ title: 'Saved Title' });

            vi.mocked(counterRepository.put).mockResolvedValue(counter);

            const first = await request(app)
                .put(`/counters/update/${TEST_COUNTER_ID}`)
                .set('X-Idempotency-Key', idempotencyKey)
                .send({ title: 'Saved Title' });

            const second = await request(app)
                .put(`/counters/update/${TEST_COUNTER_ID}`)
                .set('X-Idempotency-Key', idempotencyKey)
                .send({ title: 'Saved Title' });

            expect(first.status).toBe(OK);
            expect(second.status).toBe(OK);
            expect(counterRepository.put).toHaveBeenCalledTimes(1);
            expect(second.body.data.counter.title).toBe('Saved Title');
        });
    });

    describe('PUT /counters/:counterId/count', () => {
        it.each([0, -1])('should accept %i as an absolute personal counter count', async (count) => {
            const counter = buildCounter({ count });
            vi.mocked(counterRepository.setCount).mockResolvedValue(counter);

            const res = await request(app).put(`/counters/${TEST_COUNTER_ID}/count`).send({ count });

            expect(res.status).toBe(OK);
            expect(counterRepository.setCount).toHaveBeenCalledWith(
                {
                    counterId: TEST_COUNTER_ID,
                    userId: TEST_USER_ID,
                    count,
                },
                expect.anything(),
            );
            expect(res.body.data.counter.count).toBe(count);
        });

        it('should reject requests without a count', async () => {
            const res = await request(app).put(`/counters/${TEST_COUNTER_ID}/count`).send({});

            expect(res.status).toBe(UNPROCESSABLE_ENTITY);
            expect(counterRepository.setCount).not.toHaveBeenCalled();
        });

        it('should return 404 when the counter is not an owned personal counter', async () => {
            vi.mocked(counterRepository.setCount).mockResolvedValue(null);

            const res = await request(app).put(`/counters/${TEST_COUNTER_ID}/count`).send({ count: 0 });

            expect(res.status).toBe(NOT_FOUND);
        });
    });
});
