import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ClientCounter } from '@tally/core';
import { io as createSocket } from 'socket.io-client';
import type { Server } from 'socket.io';
import type { AddressInfo } from 'node:net';

import { digestEmailOtp } from '../../src/services/email-otp.service.js';
import * as userRepository from '../../src/db/repositories/user.repository.js';
import jwtUtil from '../../src/util/jwt.util.js';
import { cleanup } from '../../src/db/cron.js';

let app: Express;
let prisma: PrismaClient;
let io: Server;
let socketUrl: string;

beforeAll(async () => {
    const [{ default: loadedApp }, { default: loadedPrisma }] = await Promise.all([
        import('../../src/app.js'),
        import('../../src/db/prisma.js'),
    ]);

    app = loadedApp;
    prisma = loadedPrisma;
    const { default: initializeIO } = await import('../../src/socket/index.js');
    const server = createServer(app);
    io = initializeIO(server);
    app.set('io', io);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    socketUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
    await new Promise<void>((resolve) => io.close(() => resolve()));
});

async function sharingAccount(tier: 'BASIC' | 'PREMIUM') {
    const email = `sharing.${randomUUID()}@example.com`;
    const password = 'Integration-password1';
    await request(app).post('/users').send({ email, password }).expect(201);
    const login = await request(app).post('/users/login').send({ email, password }).expect(200);
    const { user, accessToken } = login.body.data;
    await prisma.user.update({ where: { id: user.id }, data: { tier } });
    return { id: user.id as string, email, password, authorization: `Bearer ${accessToken}` };
}

describe('PostgreSQL integration', () => {
    it('does not repeat an offline increment after maintenance ages its receipt', async () => {
        const account = await sharingAccount('BASIC');
        const created = await request(app)
            .post('/counters')
            .set('Authorization', account.authorization)
            .send({ title: 'Offline counter' })
            .expect(201);
        const counterId = created.body.data.counter.id;
        const key = randomUUID();
        const increment = () =>
            request(app)
                .put(`/counters/increment/${counterId}`)
                .set('Authorization', account.authorization)
                .set('X-Idempotency-Key', key)
                .send({ amount: 1 })
                .expect(200);
        await increment();
        await prisma.idempotencyLog.update({ where: { key }, data: { createdAt: new Date('2020-01-01') } });
        await cleanup();
        await increment();
        expect((await prisma.counter.findUniqueOrThrow({ where: { id: counterId } })).count.toNumber()).toBe(1);
    });

    it('does not expose a credential or tier update through an ordinary session', async () => {
        const account = await sharingAccount('BASIC');
        const select = { email: true, password: true, emailVerifiedAt: true, tier: true } as const;
        const before = await prisma.user.findUniqueOrThrow({ where: { id: account.id }, select });

        await request(app)
            .put('/users')
            .set('Authorization', account.authorization)
            .send({ email: 'changed@example.com', password: 'Changed-password1', tier: 'PREMIUM' })
            .expect(404);

        expect(await prisma.user.findUniqueOrThrow({ where: { id: account.id }, select })).toEqual(before);
    });

    it.each(['websocket', 'polling'])('revokes credentials and %s sockets on access-only logout', async (transport) => {
        const account = await sharingAccount('BASIC');
        const other = await sharingAccount('BASIC');
        const remembered = await request(app)
            .post('/users/login')
            .send({ email: account.email, password: account.password, rememberMe: true })
            .expect(200);
        const socket = createSocket(socketUrl, {
            auth: { token: account.authorization.slice(7) },
            transports: [transport],
            autoConnect: false,
        });
        try {
            const connected = new Promise<void>((resolve) => socket.once('session-ready', resolve));
            socket.connect();
            await connected;
            await vi.waitFor(async () => expect(await io.in(account.id).fetchSockets()).toHaveLength(1));
            await request(app).post('/users/logout').set('Authorization', account.authorization).expect(200);
            await request(app).get('/users/check-auth').set('Authorization', account.authorization).expect(401);
            await request(app)
                .get('/users/check-auth')
                .set('Authorization', `Bearer ${remembered.body.data.accessToken}`)
                .expect(401);
            await request(app)
                .post('/users/refresh')
                .send({ refreshToken: remembered.body.data.refreshToken })
                .expect(401);
            await vi.waitFor(() => expect(socket.connected).toBe(false));
            const stillSignedIn = await request(app)
                .get('/users/check-auth')
                .set('Authorization', other.authorization)
                .expect(200);
            expect(stillSignedIn.body.data.user.id).toBe(other.id);
        } finally {
            socket.disconnect();
        }
    });

    it('clears the previous remembered account when another browser account logs in without Remember me', async () => {
        const a = await sharingAccount('BASIC');
        const b = await sharingAccount('BASIC');
        const browser = request.agent(app);
        await browser.post('/users/login').send({ email: a.email, password: a.password, rememberMe: true }).expect(200);
        await browser
            .post('/users/login')
            .send({ email: b.email, password: b.password, rememberMe: false })
            .expect(200);
        await browser.post('/users/refresh').send({}).expect(401);
        const current = await browser.get('/users/check-auth').expect(200);
        expect(current.body.data.user.id).toBe(b.id);
    });

    it('never admits a socket whose handshake finished before logout but whose room admission finishes afterward', async () => {
        const account = await sharingAccount('BASIC');
        const originalLock = userRepository.withLockedUser;
        let release!: () => void;
        let entered!: () => void;
        const arrived = new Promise<void>((resolve) => {
            entered = resolve;
        });
        const barrier = new Promise<void>((resolve) => {
            release = resolve;
        });
        const lock = vi.spyOn(userRepository, 'withLockedUser').mockImplementationOnce(async (id, action) => {
            entered();
            await barrier;
            return originalLock(id, action);
        });
        const socket = createSocket(socketUrl, {
            auth: { token: account.authorization.slice(7) },
            transports: ['websocket'],
            autoConnect: false,
        });
        const ready = vi.fn();
        socket.on('session-ready', ready);
        const disconnected = new Promise<void>((resolve) => socket.once('disconnect', () => resolve()));
        try {
            socket.connect();
            await arrived;
            lock.mockRestore();
            await request(app).post('/users/logout').set('Authorization', account.authorization).expect(200);
            release();
            await disconnected;
            expect(ready).not.toHaveBeenCalled();
            expect(await io.in(account.id).fetchSockets()).toHaveLength(0);
        } finally {
            lock.mockRestore();
            release();
            socket.disconnect();
        }
    });

    it('replays only the direct refresh successor briefly and revokes it through the original token', async () => {
        const account = await sharingAccount('BASIC');
        const login = await request(app)
            .post('/users/login')
            .send({ email: account.email, password: account.password, rememberMe: true })
            .expect(200);
        const original = login.body.data.refreshToken;
        const refresh = (token: string) => request(app).post('/users/refresh').send({ refreshToken: token });
        const expired = await prisma.refreshToken.create({ data: { userId: account.id, expiresAt: new Date(0) } });
        await refresh(expired.id).expect(401);
        const [first, retry] = await Promise.all([refresh(original).expect(200), refresh(original).expect(200)]);
        expect(retry.body.data.refreshToken).toBe(first.body.data.refreshToken);
        expect(
            await prisma.refreshToken.count({
                where: { userId: account.id, rotatedAt: null, expiresAt: { gt: new Date() } },
            }),
        ).toBe(1);
        await prisma.refreshToken.update({
            where: { id: original },
            data: { rotatedAt: new Date(Date.now() - 31_000) },
        });
        await refresh(original).expect(401);
        await request(app).post('/users/logout').send({ refreshToken: original }).expect(200);
        await refresh(first.body.data.refreshToken).expect(401);
        await request(app)
            .get('/users/check-auth')
            .set('Authorization', `Bearer ${first.body.data.accessToken}`)
            .expect(401);
        expect(await prisma.refreshToken.count({ where: { userId: account.id } })).toBe(0);
    });

    it('does not issue a refresh credential when logout wins the user lock', async () => {
        const account = await sharingAccount('BASIC');
        const login = await request(app)
            .post('/users/login')
            .send({ email: account.email, password: account.password, rememberMe: true })
            .expect(200);
        const originalLock = userRepository.withLockedUser;
        let release!: () => void;
        let entered!: () => void;
        const arrived = new Promise<void>((resolve) => {
            entered = resolve;
        });
        const barrier = new Promise<void>((resolve) => {
            release = resolve;
        });
        const lock = vi.spyOn(userRepository, 'withLockedUser').mockImplementationOnce(async (id, action) => {
            entered();
            await barrier;
            return originalLock(id, action);
        });
        const refreshing = request(app)
            .post('/users/refresh')
            .send({ refreshToken: login.body.data.refreshToken })
            .then((response) => response);
        try {
            await arrived;
            lock.mockRestore();
            await request(app).post('/users/logout').set('Authorization', account.authorization).expect(200);
            release();
            expect((await refreshing).status).toBe(401);
            expect(await prisma.refreshToken.count({ where: { userId: account.id } })).toBe(0);
        } finally {
            lock.mockRestore();
            release();
            await refreshing;
        }
    });

    it('rejects stale browser account identity without changing data or cookies', async () => {
        const a = await sharingAccount('BASIC');
        const b = await sharingAccount('BASIC');
        const cookie = `access_token=${b.authorization.slice(7)}`;
        const mismatch = await request(app)
            .post('/counters')
            .set('Cookie', cookie)
            .set('X-Account-Id', a.id)
            .send({ title: 'Wrong account' })
            .expect(401);
        expect(mismatch.headers['set-cookie']).toBeUndefined();
        const logout = await request(app)
            .post('/users/logout')
            .set('Cookie', cookie)
            .set('X-Account-Id', a.id)
            .expect(401);
        expect(logout.headers['set-cookie']).toBeUndefined();
        expect(await prisma.counter.count({ where: { userId: b.id } })).toBe(0);
        await request(app).get('/users/check-auth').set('Authorization', b.authorization).expect(200);
        const native = await request(app)
            .get('/users/check-auth')
            .set('Cookie', cookie)
            .set('Authorization', a.authorization)
            .set('X-Account-Id', a.id)
            .expect(200);
        expect(native.body.data.user.id).toBe(a.id);
    });

    it('disconnects an authenticated socket when its access token expires', async () => {
        const account = await sharingAccount('BASIC');
        const token = jwtUtil.sign({ id: account.id, email: account.email, sessionVersion: 0 }, '2s');
        const socket = createSocket(socketUrl, { auth: { token }, transports: ['websocket'], autoConnect: false });
        try {
            const connected = new Promise<void>((resolve) => socket.once('session-ready', resolve));
            socket.connect();
            await connected;
            await vi.waitFor(() => expect(socket.connected).toBe(false), { timeout: 3000 });
        } finally {
            socket.disconnect();
        }
    });

    it('saves the validated metric on create and update, including idempotent retries', async () => {
        const account = await sharingAccount('BASIC');
        const key = randomUUID();
        const create = (metric: string) =>
            request(app)
                .post('/counters')
                .set('Authorization', account.authorization)
                .set('X-Idempotency-Key', key)
                .send({ title: 'Water', metric });
        const created = await create(' '.repeat(81) + 'oz ').expect(201);
        const id = created.body.data.counter.id;
        const readMetric = () => prisma.counter.findUniqueOrThrow({ where: { id }, select: { metric: true } });
        expect(await readMetric()).toEqual({ metric: 'oz' });

        const retry = await create('oz').expect(201);
        expect(retry.body.data.counter.id).toBe(id);
        await request(app)
            .put(`/counters/update/${id}`)
            .set('Authorization', account.authorization)
            .send({ metric: ' '.repeat(81) + 'ml ' })
            .expect(200);
        expect(await readMetric()).toEqual({ metric: 'ml' });
    });

    it('persists decimal settings and keeps concurrent shared taps exact and idempotent', async () => {
        const owner = await sharingAccount('PREMIUM');
        const member = await sharingAccount('BASIC');
        const created = await request(app)
            .post('/counters')
            .set('Authorization', owner.authorization)
            .send({ title: 'Water', metric: '16oz water bottle', increment: 0.1, count: 0.1 })
            .expect(201);
        const counterId = created.body.data.counter.id;
        expect(created.body.data.counter).toMatchObject({ metric: '16oz water bottle', increment: 0.1, count: 0.1 });
        const shared = await request(app)
            .post(`/counters/${counterId}/share`)
            .set('Authorization', owner.authorization)
            .expect(200);
        const joined = await request(app)
            .post('/counters/join')
            .set('Authorization', member.authorization)
            .send({ inviteCode: shared.body.data.counter.inviteCode })
            .expect(201);
        expect(joined.body.data.counter).toMatchObject({ metric: '16oz water bottle', increment: 0.1, count: 0.1 });

        const memberSocket = createSocket(socketUrl, {
            auth: { token: member.authorization.replace('Bearer ', '') },
            transports: ['websocket'],
            autoConnect: false,
        });
        try {
            await new Promise<void>((resolve, reject) => {
                memberSocket.once('connect', resolve);
                memberSocket.once('connect_error', reject);
                memberSocket.connect();
            });
            let received: ClientCounter | undefined;
            memberSocket.once('counter-update', (counter: ClientCounter) => {
                received = counter;
            });
            await request(app)
                .put(`/counters/update/${counterId}`)
                .set('Authorization', owner.authorization)
                .send({ title: 'Water bottles', increment: 0.25, metric: 'Bottle' })
                .expect(200);
            await vi.waitFor(() =>
                expect(received).toMatchObject({
                    id: counterId,
                    title: 'Water bottles',
                    increment: 0.25,
                    metric: 'Bottle',
                    count: 0.1,
                }),
            );
        } finally {
            memberSocket.disconnect();
        }
        const key = randomUUID();
        const tap = (authorization: string, id: string, amount: number) =>
            request(app)
                .put(`/counters/increment/${counterId}`)
                .set('Authorization', authorization)
                .set('X-Idempotency-Key', id)
                .send({ amount })
                .expect(200);
        await Promise.all([tap(owner.authorization, key, 0.1), tap(member.authorization, randomUUID(), 0.1)]);
        await tap(owner.authorization, key, 0.1);
        let fetched = await request(app).get('/counters').set('Authorization', member.authorization).expect(200);
        expect(fetched.body.data.counters[0]).toMatchObject({ count: 0.3, increment: 0.25, metric: 'Bottle' });
        await tap(member.authorization, randomUUID(), -0.25);
        await request(app)
            .put(`/counters/update/${counterId}`)
            .set('Authorization', owner.authorization)
            .send({ metric: null })
            .expect(200);
        fetched = await request(app).get('/counters').set('Authorization', owner.authorization).expect(200);
        expect(fetched.body.data.counters[0]).toMatchObject({ count: 0.05, increment: 0.25, metric: null });
    });
    it('denies sharing to basic owners and unrelated premium users without changing the counter', async () => {
        const owner = await sharingAccount('BASIC');
        const outsider = await sharingAccount('PREMIUM');
        const created = await request(app)
            .post('/counters')
            .set('Authorization', owner.authorization)
            .send({ title: 'Private counter', count: 7 })
            .expect(201);
        const counter = created.body.data.counter;

        await request(app).post(`/counters/${counter.id}/share`).expect(401);
        await request(app).post(`/counters/${counter.id}/share`).set('Authorization', owner.authorization).expect(403);
        await request(app)
            .post(`/counters/${counter.id}/share`)
            .set('Authorization', outsider.authorization)
            .expect(404);
        expect(await prisma.counter.findUnique({ where: { id: counter.id } })).toMatchObject({
            type: 'PERSONAL',
            inviteCode: null,
            count: new Prisma.Decimal(7),
        });
    });

    it('reuses one invite for concurrent share requests and preserves count updates after sharing', async () => {
        const owner = await sharingAccount('PREMIUM');
        const member = await sharingAccount('PREMIUM');
        const created = await request(app)
            .post('/counters')
            .set('Authorization', owner.authorization)
            .send({ title: 'Share an existing counter', count: 7 })
            .expect(201);
        const counterId = created.body.data.counter.id;
        const share = () => request(app).post(`/counters/${counterId}/share`).set('Authorization', owner.authorization);

        const [first, second] = await Promise.all([share().expect(200), share().expect(200)]);
        const inviteCode = first.body.data.counter.inviteCode;
        expect(inviteCode).toMatch(/^[0-9a-f-]{36}$/);
        expect(second.body.data.counter.inviteCode).toBe(inviteCode);
        await request(app)
            .post('/counters/join')
            .set('Authorization', member.authorization)
            .send({ inviteCode })
            .expect(201);

        // An owner can still have a PERSONAL snapshot when another device starts sharing.
        await Promise.all(
            [owner, member].map(({ authorization }) =>
                request(app)
                    .put(`/counters/increment/${counterId}`)
                    .set('Authorization', authorization)
                    .send({ amount: 1 })
                    .expect(200),
            ),
        );
        const forwarded = await request(app)
            .post(`/counters/${counterId}/share`)
            .set('Authorization', member.authorization)
            .expect(200);
        expect(forwarded.body.data.counter.inviteCode).toBe(inviteCode);
        expect(await prisma.counter.findUnique({ where: { id: counterId } })).toMatchObject({
            count: new Prisma.Decimal(9),
            type: 'SHARED',
            inviteCode,
        });

        await prisma.user.update({ where: { id: owner.id }, data: { tier: 'BASIC' } });
        await share().expect(403);
    });

    it('normalizes mixed-case email registration and login while rejecting a case-insensitive duplicate', async () => {
        const email = `Mixed.${randomUUID()}@Example.COM`;
        const password = 'Integration-password1';

        const registration = await request(app).post('/users').send({ email, password });
        expect(registration.status).toBe(201);
        expect(registration.body).toEqual({ success: true });

        const login = await request(app).post('/users/login').send({ email: email.toUpperCase(), password });
        expect(login.status).toBe(200);
        expect(login.body.data.user.email).toBe(email.toLowerCase());

        const duplicate = await request(app).post('/users').send({ email: email.toUpperCase(), password });
        expect(duplicate.status).toBe(422);
        expect(duplicate.body).toEqual({ success: false, message: 'Account is already in use.' });
        expect(await prisma.user.count({ where: { email: email.toLowerCase() } })).toBe(1);
    });

    it('consumes email codes and invalidates sessions after a password reset', async () => {
        const email = `email-auth.${randomUUID()}@example.com`;
        const password = 'Integration-password1';
        const newPassword = 'New-integration-password1';
        const verificationCode = '123456';
        const resetCode = '654321';

        const registration = await request(app).post('/users').send({ email, password });
        expect(registration.status).toBe(201);

        const user = await prisma.user.findUniqueOrThrow({ where: { email } });
        await expect
            .poll(() => prisma.emailOtp.count({ where: { userId: user.id, purpose: 'EMAIL_VERIFICATION' } }))
            .toBe(1);
        await prisma.emailOtp.upsert({
            where: { userId_purpose: { userId: user.id, purpose: 'EMAIL_VERIFICATION' } },
            create: {
                userId: user.id,
                purpose: 'EMAIL_VERIFICATION',
                digest: digestEmailOtp(user.id, 'EMAIL_VERIFICATION', verificationCode),
                expiresAt: new Date(Date.now() + 60_000),
            },
            update: {
                digest: digestEmailOtp(user.id, 'EMAIL_VERIFICATION', verificationCode),
                expiresAt: new Date(Date.now() + 60_000),
                consumedAt: null,
                attempts: 0,
            },
        });

        const verification = await request(app).post('/users/verify-email').send({
            email,
            code: verificationCode,
        });
        expect(verification.status).toBe(200);

        const verifiedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
        const verificationToken = await prisma.emailOtp.findUniqueOrThrow({
            where: { userId_purpose: { userId: user.id, purpose: 'EMAIL_VERIFICATION' } },
        });
        expect(verifiedUser.emailVerifiedAt).toBeInstanceOf(Date);
        expect(verificationToken.consumedAt).toBeInstanceOf(Date);

        const replay = await request(app).post('/users/verify-email').send({ email, code: verificationCode });
        expect(replay.status).toBe(422);

        const login = await request(app).post('/users/login').send({ email, password, rememberMe: true });
        expect(login.status).toBe(200);
        const { accessToken, refreshToken } = login.body.data;

        await prisma.emailOtp.create({
            data: {
                userId: user.id,
                purpose: 'PASSWORD_RESET',
                digest: digestEmailOtp(user.id, 'PASSWORD_RESET', resetCode),
                expiresAt: new Date(Date.now() + 60_000),
            },
        });

        await request(app).post('/users/reset-password/verify').send({ email, code: resetCode }).expect(200);
        const checkedCode = await prisma.emailOtp.findUniqueOrThrow({
            where: { userId_purpose: { userId: user.id, purpose: 'PASSWORD_RESET' } },
        });
        expect(checkedCode.consumedAt).toBeNull();

        const reset = await request(app).post('/users/reset-password').send({
            email,
            code: resetCode,
            password: newPassword,
        });
        expect(reset.status).toBe(200);

        await request(app).post('/users/reset-password/verify').send({ email, code: resetCode }).expect(422);
        await request(app)
            .post('/users/reset-password')
            .send({ email, code: resetCode, password: 'Another-password1' })
            .expect(422);

        const oldAccess = await request(app).get('/counters').set('Authorization', `Bearer ${accessToken}`);
        const oldRefresh = await request(app).post('/users/refresh').send({ refreshToken });
        expect(oldAccess.status).toBe(401);
        expect(oldRefresh.status).toBe(401);

        const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
        expect(updatedUser.sessionVersion).toBe(1);
        expect(await prisma.refreshToken.count({ where: { userId: user.id } })).toBe(0);

        const newLogin = await request(app).post('/users/login').send({ email, password: newPassword });
        expect(newLogin.status).toBe(200);
    });

    it('rejects the current password without consuming a valid reset code', async () => {
        const email = `password-reuse.${randomUUID()}@example.com`;
        const password = 'Integration-password1';
        const newPassword = 'New-integration-password1';
        const resetCode = '654321';

        const registration = await request(app).post('/users').send({ email, password });
        expect(registration.status).toBe(201);

        const user = await prisma.user.findUniqueOrThrow({ where: { email } });
        await prisma.emailOtp.create({
            data: {
                userId: user.id,
                purpose: 'PASSWORD_RESET',
                digest: digestEmailOtp(user.id, 'PASSWORD_RESET', resetCode),
                expiresAt: new Date(Date.now() + 60_000),
            },
        });

        const reused = await request(app).post('/users/reset-password').send({ email, code: resetCode, password });
        expect(reused.status).toBe(422);

        const reset = await request(app)
            .post('/users/reset-password')
            .send({ email, code: resetCode, password: newPassword });
        expect(reset.status).toBe(200);

        const oldLogin = await request(app).post('/users/login').send({ email, password });
        const newLogin = await request(app).post('/users/login').send({ email, password: newPassword });
        expect(oldLogin.status).toBe(401);
        expect(newLogin.status).toBe(200);
    });

    it('shares reset-code attempt limits between verification and saving, and rejects expired codes', async () => {
        const email = `reset-attempts.${randomUUID()}@example.com`;
        const password = 'Integration-password1';
        const code = '123456';
        await request(app).post('/users').send({ email, password }).expect(201);
        const user = await prisma.user.findUniqueOrThrow({ where: { email } });
        const where = { userId_purpose: { userId: user.id, purpose: 'PASSWORD_RESET' as const } };
        await prisma.emailOtp.create({
            data: {
                userId: user.id,
                purpose: 'PASSWORD_RESET',
                digest: digestEmailOtp(user.id, 'PASSWORD_RESET', code),
                expiresAt: new Date(Date.now() - 1_000),
            },
        });
        await request(app).post('/users/reset-password/verify').send({ email, code }).expect(422);
        await prisma.emailOtp.update({ where, data: { expiresAt: new Date(Date.now() + 60_000) } });
        for (let attempt = 0; attempt < 5; attempt += 1) {
            await request(app)
                .post(attempt % 2 === 0 ? '/users/reset-password/verify' : '/users/reset-password')
                .send({ email, code: '000000', password: 'New-password1' })
                .expect(422);
        }
        await request(app).post('/users/reset-password/verify').send({ email, code }).expect(422);
        await request(app).post('/users/reset-password').send({ email, code, password: 'New-password1' }).expect(422);
        expect((await prisma.emailOtp.findUniqueOrThrow({ where })).attempts).toBe(5);
        await request(app).post('/users/login').send({ email, password }).expect(200);
    });

    it('locks an email code after five incorrect attempts', async () => {
        const email = `email-attempts.${randomUUID()}@example.com`;
        const password = 'Integration-password1';
        const code = '123456';

        const registration = await request(app).post('/users').send({ email, password });
        expect(registration.status).toBe(201);

        const user = await prisma.user.findUniqueOrThrow({ where: { email } });
        await expect
            .poll(() => prisma.emailOtp.count({ where: { userId: user.id, purpose: 'EMAIL_VERIFICATION' } }))
            .toBe(1);
        await prisma.emailOtp.update({
            where: { userId_purpose: { userId: user.id, purpose: 'EMAIL_VERIFICATION' } },
            data: {
                digest: digestEmailOtp(user.id, 'EMAIL_VERIFICATION', code),
                expiresAt: new Date(Date.now() + 60_000),
                consumedAt: null,
                attempts: 0,
            },
        });

        for (let attempt = 0; attempt < 5; attempt += 1) {
            const invalid = await request(app).post('/users/verify-email').send({ email, code: '000000' });
            expect(invalid.status).toBe(422);
        }

        const locked = await request(app).post('/users/verify-email').send({ email, code });
        expect(locked.status).toBe(422);

        const [updatedUser, otp] = await Promise.all([
            prisma.user.findUniqueOrThrow({ where: { id: user.id } }),
            prisma.emailOtp.findUniqueOrThrow({
                where: { userId_purpose: { userId: user.id, purpose: 'EMAIL_VERIFICATION' } },
            }),
        ]);
        expect(updatedUser.emailVerifiedAt).toBeNull();
        expect(otp.attempts).toBe(5);
    });

    it('replays an idempotent personal-counter create and cascades account cleanup', async () => {
        const suffix = randomUUID();
        const email = `remember.${suffix}@example.com`;
        const password = 'Integration-password1';
        const counterId = randomUUID();
        const idempotencyKey = `create-personal-${suffix}`;
        const agent = request.agent(app);

        const registration = await agent.post('/users').send({ email, password });
        expect(registration.status).toBe(201);

        const login = await agent.post('/users/login').send({ email, password, rememberMe: true });
        expect(login.status).toBe(200);
        expect(login.body.data.refreshToken).toEqual(expect.any(String));

        const { accessToken, refreshToken, user } = login.body.data;
        const createCounter = () =>
            agent
                .post('/counters')
                .set('Authorization', `Bearer ${accessToken}`)
                .set('X-Idempotency-Key', idempotencyKey)
                .send({ id: counterId, title: 'Idempotent personal counter' });

        const firstCreate = await createCounter();
        const replayedCreate = await createCounter();

        expect(firstCreate.status).toBe(201);
        expect(replayedCreate.status).toBe(201);
        expect(replayedCreate.body).toEqual(firstCreate.body);

        const [counterCount, idempotencyLogs] = await Promise.all([
            prisma.counter.count({ where: { id: counterId, userId: user.id } }),
            prisma.idempotencyLog.findMany({ where: { key: idempotencyKey } }),
        ]);
        expect(counterCount).toBe(1);
        expect(idempotencyLogs).toHaveLength(1);
        expect(idempotencyLogs[0]).toEqual(
            expect.objectContaining({
                key: idempotencyKey,
                userId: user.id,
                status: 'COMPLETED',
                responseStatus: 201,
            }),
        );

        const bearerGet = await request(app).get('/counters').set('Authorization', `Bearer ${accessToken}`);
        expect(bearerGet.status).toBe(200);
        expect(bearerGet.body.data.counters).toHaveLength(1);
        expect(bearerGet.body.data.counters[0]).toEqual(expect.objectContaining({ id: counterId, userId: user.id }));

        expect(await prisma.refreshToken.count({ where: { id: refreshToken, userId: user.id } })).toBe(1);

        const deletion = await request(app).delete('/users').set('Authorization', `Bearer ${accessToken}`);
        expect(deletion.status).toBe(200);
        expect(deletion.body).toEqual({ success: true });

        const [usersAfterDelete, countersAfterDelete, tokensAfterDelete, logsAfterDelete] = await Promise.all([
            prisma.user.count({ where: { id: user.id } }),
            prisma.counter.count({ where: { userId: user.id } }),
            prisma.refreshToken.count({ where: { userId: user.id } }),
            prisma.idempotencyLog.count({ where: { userId: user.id } }),
        ]);
        expect({
            users: usersAfterDelete,
            counters: countersAfterDelete,
            refreshTokens: tokensAfterDelete,
            idempotencyLogs: logsAfterDelete,
        }).toEqual({ users: 0, counters: 0, refreshTokens: 0, idempotencyLogs: 0 });
    });

    it('persists shared-counter membership and excludes a removed share from subsequent reads', async () => {
        const suffix = randomUUID();
        const password = 'Integration-password1';
        const ownerEmail = `owner.${suffix}@example.com`;
        const memberEmail = `member.${suffix}@example.com`;
        const counterId = randomUUID();
        const ownerAgent = request.agent(app);
        const memberAgent = request.agent(app);

        const ownerRegistration = await ownerAgent.post('/users').send({ email: ownerEmail, password });
        const memberRegistration = await memberAgent.post('/users').send({ email: memberEmail, password });
        expect(ownerRegistration.status).toBe(201);
        expect(memberRegistration.status).toBe(201);

        const ownerLogin = await ownerAgent.post('/users/login').send({ email: ownerEmail, password });
        const memberLogin = await memberAgent.post('/users/login').send({ email: memberEmail, password });
        expect(ownerLogin.status).toBe(200);
        expect(memberLogin.status).toBe(200);

        const owner = ownerLogin.body.data.user;
        const member = memberLogin.body.data.user;
        const ownerAccessToken = ownerLogin.body.data.accessToken;
        const memberAccessToken = memberLogin.body.data.accessToken;

        await prisma.user.update({ where: { id: owner.id }, data: { tier: 'PREMIUM' } });

        const createShared = await ownerAgent
            .post('/counters')
            .set('Authorization', `Bearer ${ownerAccessToken}`)
            .send({
                id: counterId,
                title: 'Real shared counter',
            });
        expect(createShared.status).toBe(201);
        const shared = await ownerAgent
            .post(`/counters/${counterId}/share`)
            .set('Authorization', `Bearer ${ownerAccessToken}`);
        expect(shared.status).toBe(200);
        const inviteCode = shared.body.data.counter.inviteCode;

        const joinShared = await memberAgent
            .post('/counters/join')
            .set('Authorization', `Bearer ${memberAccessToken}`)
            .send({ inviteCode });
        expect(joinShared.status).toBe(201);
        expect(joinShared.body).toEqual(
            expect.objectContaining({ success: true, message: 'Shared counter successfully joined' }),
        );

        const acceptedShare = await prisma.counterShare.findUnique({
            where: { counterId_userId: { counterId, userId: member.id } },
        });
        expect(acceptedShare).toEqual(expect.objectContaining({ counterId, userId: member.id, status: 'ACCEPTED' }));

        const countersAfterJoin = await memberAgent
            .get('/counters')
            .set('Authorization', `Bearer ${memberAccessToken}`);
        expect(countersAfterJoin.status).toBe(200);
        expect(countersAfterJoin.body.data.counters.map(({ id }: { id: string }) => id)).toContain(counterId);

        const removeShare = await memberAgent
            .put(`/counters/remove-shared/${counterId}`)
            .set('Authorization', `Bearer ${memberAccessToken}`);
        expect(removeShare.status).toBe(200);
        expect(removeShare.body).toEqual({ success: true, message: 'Shared counter successfully removed' });

        const rejectedShare = await prisma.counterShare.findUnique({
            where: { counterId_userId: { counterId, userId: member.id } },
        });
        expect(rejectedShare?.status).toBe('REJECTED');

        const countersAfterRemoval = await memberAgent
            .get('/counters')
            .set('Authorization', `Bearer ${memberAccessToken}`);
        expect(countersAfterRemoval.status).toBe(200);
        expect(countersAfterRemoval.body.data.counters.map(({ id }: { id: string }) => id)).not.toContain(counterId);
    });
});
