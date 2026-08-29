import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { digestEmailOtp } from '../../src/services/email-otp.service.js';

let app: Express;
let prisma: PrismaClient;

beforeAll(async () => {
    const [{ default: loadedApp }, { default: loadedPrisma }] = await Promise.all([
        import('../../src/app.js'),
        import('../../src/db/prisma.js'),
    ]);

    app = loadedApp;
    prisma = loadedPrisma;
});

describe('PostgreSQL integration', () => {
    it('normalizes mixed-case email registration and login while rejecting a case-insensitive duplicate', async () => {
        const email = `Mixed.${randomUUID()}@Example.COM`;
        const password = 'integration-password';

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
        const password = 'integration-password';
        const newPassword = 'new-integration-password';
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

        const reset = await request(app).post('/users/reset-password').send({
            email,
            code: resetCode,
            password: newPassword,
        });
        expect(reset.status).toBe(200);

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

    it('locks an email code after five incorrect attempts', async () => {
        const email = `email-attempts.${randomUUID()}@example.com`;
        const password = 'integration-password';
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
        const password = 'integration-password';
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
                .send({ id: counterId, title: 'Idempotent personal counter', type: 'PERSONAL' });

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
        const password = 'integration-password';
        const ownerEmail = `owner.${suffix}@example.com`;
        const memberEmail = `member.${suffix}@example.com`;
        const counterId = randomUUID();
        const inviteCode = `integration-share-${suffix}`;
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
                type: 'SHARED',
                inviteCode,
            });
        expect(createShared.status).toBe(201);
        expect(createShared.body.data.counter).toEqual(
            expect.objectContaining({ id: counterId, userId: owner.id, type: 'SHARED', inviteCode }),
        );

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
