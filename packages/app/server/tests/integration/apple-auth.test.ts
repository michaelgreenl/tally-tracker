import bcrypt from 'bcrypt';
import request from 'supertest';
import { beforeEach, expect, it, vi } from 'vitest';
import app from '../../src/app.js';
import prisma from '../../src/db/prisma.js';
import {
    AppleAuthError,
    exchangeAppleCode,
    revokeAppleToken,
    verifyAppleNotification,
} from '../../src/services/apple-auth.service.js';

// Unit tests exercise signed Apple tokens and the HTTP contract. Here PostgreSQL, locks, and sessions stay real.
vi.mock('../../src/services/apple-auth.service.js', async (original) => ({
    ...(await original<typeof import('../../src/services/apple-auth.service.js')>()),
    exchangeAppleCode: vi.fn(),
    revokeAppleToken: vi.fn(),
    verifyAppleNotification: vi.fn(),
}));

const credentials = {
    authorizationCode: 'apple-code',
    nonce: '126a59c2-18b8-4d47-97ed-cda5afec5167',
    rememberMe: true,
};
const identity = {
    subject: 'apple-subject',
    email: 'person@privaterelay.appleid.com',
    emailVerified: true,
    authenticatedAt: new Date(Math.floor(Date.now() / 1000) * 1000),
    refreshToken: 'encrypted-apple-token',
};
const apple = (body = {}) =>
    request(app)
        .post('/users/apple')
        .send({ ...credentials, ...body });
const password = 'Existing-password1';

async function existingAccount(email = 'existing@gmail.com') {
    const user = await prisma.user.create({
        data: { email, password: await bcrypt.hash(password, 10), tier: 'PREMIUM' },
    });
    const login = await request(app).post('/users/login').send({ email, password, rememberMe: true }).expect(200);
    return { user, accessToken: login.body.data.accessToken as string };
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(exchangeAppleCode).mockResolvedValue(identity);
    vi.mocked(revokeAppleToken).mockResolvedValue(undefined);
});

it('creates one account across concurrent sign-ins and recognizes it without another email claim', async () => {
    const [first, second] = await Promise.all([apple().expect(200), apple().expect(200)]);
    const { user, accessToken, refreshToken } = first.body.data;
    expect(second.body.data.user.id).toBe(user.id);
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toMatchObject({
        password: null,
        appleSubject: identity.subject,
    });
    expect(user).not.toHaveProperty('appleRefreshToken');
    await request(app).get('/users/check-auth').set('Authorization', `Bearer ${accessToken}`).expect(200);
    await request(app).post('/users/refresh').send({ refreshToken }).expect(200);
    vi.mocked(exchangeAppleCode).mockResolvedValue({ ...identity, email: undefined, emailVerified: false });
    expect((await apple().expect(200)).body.data.user.id).toBe(user.id);
});

it('does not merge by email, but linking from the existing account preserves its counters and tier', async () => {
    const { user, accessToken } = await existingAccount(identity.email);
    const counter = await prisma.counter.create({ data: { userId: user.id, title: 'Water' } });
    const rejected = await apple().expect(409);
    expect(rejected.headers['set-cookie']).toBeUndefined();
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toMatchObject({ appleSubject: null });
    await request(app).post('/users/apple/connect').send(credentials).expect(401);
    await request(app)
        .post('/users/apple/connect')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(credentials)
        .expect(200);
    const linked = await apple().expect(200);
    expect(linked.body.data.user).toMatchObject({ id: user.id, tier: 'PREMIUM' });
    const counters = await request(app)
        .get('/counters')
        .set('Authorization', `Bearer ${linked.body.data.accessToken}`)
        .expect(200);
    expect(counters.body.data.counters.map((item: { id: string }) => item.id)).toEqual([counter.id]);
});

it('links a relay address without changing or verifying a different existing email, and cannot steal another account’s identity', async () => {
    const first = await existingAccount();
    const second = await existingAccount('second@gmail.com');
    await request(app)
        .post('/users/apple/connect')
        .set('Authorization', `Bearer ${first.accessToken}`)
        .send(credentials)
        .expect(200);
    await request(app)
        .post('/users/apple/connect')
        .set('Authorization', `Bearer ${second.accessToken}`)
        .send(credentials)
        .expect(409);
    expect((await apple().expect(200)).body.data.user).toMatchObject({
        id: first.user.id,
        email: first.user.email,
        emailVerified: false,
    });
    expect(await prisma.user.findUnique({ where: { id: second.user.id } })).toMatchObject({ appleSubject: null });
});

it('does not create an account or session from failed or missing Apple credentials', async () => {
    vi.mocked(exchangeAppleCode).mockRejectedValue(new AppleAuthError(401));
    const rejected = await apple().expect(401);
    expect(rejected.headers['set-cookie']).toBeUndefined();
    await apple({ nonce: 'invalid' }).expect(422);
    await request(app).post('/users/apple').type('form').send(credentials).expect(422);
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.refreshToken.count()).toBe(0);
});

it('retains account data when Apple revocation fails, then deletes it after revocation succeeds', async () => {
    const signedIn = await apple().expect(200);
    const { user, accessToken } = signedIn.body.data;
    await prisma.counter.create({ data: { userId: user.id, title: 'Water' } });
    vi.mocked(revokeAppleToken).mockRejectedValueOnce(new AppleAuthError(503));
    await request(app).delete('/users').set('Authorization', `Bearer ${accessToken}`).expect(500);
    expect(await prisma.counter.count({ where: { userId: user.id } })).toBe(1);
    await request(app).delete('/users').set('Authorization', `Bearer ${accessToken}`).expect(200);
    expect(revokeAppleToken).toHaveBeenLastCalledWith(identity.subject, identity.refreshToken);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(await prisma.counter.count()).toBe(0);
});

it('revokes sessions on Apple consent withdrawal, permits reauthorization, and ignores an old notification', async () => {
    const first = await apple().expect(200);
    const { user, accessToken, refreshToken } = first.body.data;
    const eventTime = Math.floor(identity.authenticatedAt.getTime() / 1000);
    vi.mocked(verifyAppleNotification).mockResolvedValue({
        type: 'consent-revoked',
        sub: identity.subject,
        event_time: eventTime,
    });
    const notify = () => request(app).post('/users/apple/notifications').send({ payload: 'signed-event' }).expect(200);
    await notify();
    await request(app).get('/users/check-auth').set('Authorization', `Bearer ${accessToken}`).expect(401);
    await request(app).post('/users/refresh').send({ refreshToken }).expect(401);
    // A repeated notification must not revoke a newer authorization.
    vi.mocked(exchangeAppleCode).mockResolvedValue({
        ...identity,
        authenticatedAt: new Date(identity.authenticatedAt.getTime() + 1000),
    });
    const next = await apple().expect(200);
    expect(next.body.data.user.id).toBe(user.id);
    await notify();
    await request(app)
        .get('/users/check-auth')
        .set('Authorization', `Bearer ${next.body.data.accessToken}`)
        .expect(200);
});

it.each([0, 1])('rejects a code whose authorization timestamp precedes revocation by %s seconds', async (seconds) => {
    await apple().expect(200);
    vi.mocked(verifyAppleNotification).mockResolvedValue({
        type: 'consent-revoked',
        sub: identity.subject,
        event_time: Math.floor(identity.authenticatedAt.getTime() / 1000) + seconds,
    });
    await request(app).post('/users/apple/notifications').send({ payload: 'signed-event' }).expect(200);
    const late = await apple().expect(401);
    expect(late.headers['set-cookie']).toBeUndefined();
    expect(await prisma.refreshToken.count()).toBe(0);
    expect(await prisma.user.findUnique({ where: { appleSubject: identity.subject } })).toMatchObject({
        appleRefreshToken: null,
    });
});
