import { randomUUID } from 'node:crypto';
import request from 'supertest';
import rateLimit from 'express-rate-limit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../../src/app.js';
import prisma from '../../src/db/prisma.js';
import { loginRateLimitStore } from '../../src/db/login-rate-limit.store.js';

let trustProxy: unknown;
beforeEach(() => {
    trustProxy = app.get('trust proxy');
    app.set('trust proxy', 1);
});
afterEach(() => {
    app.set('trust proxy', trustProxy);
    vi.unstubAllEnvs();
});

describe('Production login limits', () => {
    it('shares an account limit across casing and IPs, counts success, and permits login after expiry', async () => {
        const email = `limits.${randomUUID()}@example.com`;
        const password = 'New-password123';
        await request(app).post('/users').send({ email, password }).expect(201);
        vi.stubEnv('NODE_ENV', 'production');
        for (let attempt = 1; attempt <= 9; attempt++) {
            await request(app)
                .post('/users/login')
                .set('X-Forwarded-For', `198.51.100.${attempt}`)
                .send({ email: attempt % 2 ? ` ${email.toUpperCase()} ` : email, password: 'Wrong-password1' })
                .expect(401);
        }
        await request(app)
            .post('/users/login')
            .set('X-Forwarded-For', '198.51.100.10')
            .send({ email, password })
            .expect(200);
        expect((await prisma.loginRateLimit.aggregate({ _max: { hits: true } }))._max.hits).toBe(10);
        const blocked = await request(app)
            .post('/users/login')
            .set('X-Forwarded-For', '198.51.100.12')
            .send({ email, password })
            .expect(429);
        expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
        expect(blocked.headers['set-cookie']).toBeUndefined();

        await prisma.loginRateLimit.updateMany({ data: { resetAt: new Date('2020-01-01') } });
        await request(app)
            .post('/users/login')
            .set('X-Forwarded-For', '198.51.100.13')
            .send({ email, password })
            .expect(200);
        const active = await prisma.loginRateLimit.findMany({ where: { resetAt: { gt: new Date() } } });
        expect(active.map((row) => row.hits)).toEqual([1, 1]);
    });

    it('limits one IP across different accounts under concurrent login attempts', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        const responses = await Promise.all(
            Array.from({ length: 31 }, (_, attempt) =>
                request(app)
                    .post('/users/login')
                    .set('X-Forwarded-For', '203.0.113.1')
                    .send({ email: `unknown-${attempt}@example.com`, password: 'Wrong-password1' }),
            ),
        );
        expect(responses.map((response) => response.status).sort()).toEqual([...Array(30).fill(401), 429]);
    });

    it('shares atomic counts across separate store instances', async () => {
        const stores = [loginRateLimitStore('shared-test'), loginRateLimitStore('shared-test')];
        for (const store of stores) rateLimit({ store, windowMs: 60_000 });
        const counts = await Promise.all(
            Array.from({ length: 20 }, (_, index) => stores[index % 2].increment('same-client')),
        );
        expect(counts.map((result) => result.totalHits).sort((a, b) => a - b)).toEqual(
            Array.from({ length: 20 }, (_, index) => index + 1),
        );
        const restarted = loginRateLimitStore('shared-test');
        rateLimit({ store: restarted, windowMs: 60_000 });
        expect((await restarted.increment('same-client')).totalHits).toBe(21);
    });
});
