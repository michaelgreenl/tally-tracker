import bcrypt from 'bcrypt';
import request from 'supertest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import app from '../../src/app.js';
import prisma from '../../src/db/prisma.js';
import { verifyGoogleToken } from '../../src/services/google-auth.service.js';
import { sendEmailOtp } from '../../src/services/email.service.js';

// JWT signature and claims are tested with real signed tokens in unit/google-auth.test.ts.
// This suite keeps the API, account locks, sessions, and PostgreSQL constraints real.
vi.mock('../../src/services/google-auth.service.js', () => ({ verifyGoogleToken: vi.fn() }));
vi.mock('../../src/services/email.service.js', () => ({ sendEmailOtp: vi.fn().mockResolvedValue(undefined) }));

const identity = { subject: 'google-subject', email: 'person@gmail.com', emailVerified: true };
const google = (body = {}) =>
    request(app)
        .post('/users/google')
        .send({ idToken: 'google-token', rememberMe: true, ...body });

async function existingAccount(email = 'existing@example.com') {
    const password = 'Existing-password1';
    const user = await prisma.user.create({ data: { email, password: await bcrypt.hash(password, 10) } });
    const login = await request(app).post('/users/login').send({ email, password, rememberMe: true }).expect(200);
    return {
        user,
        accessToken: login.body.data.accessToken as string,
        refreshToken: login.body.data.refreshToken as string,
    };
}

const connect = (accessToken: string) =>
    request(app)
        .post('/users/google/connect')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ idToken: 'google-token' });
const methods = (accessToken: string) =>
    request(app).get('/users/sign-in-methods').set('Authorization', `Bearer ${accessToken}`);

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('GOOGLE_WEB_CLIENT_ID', '123-tally.apps.googleusercontent.com');
    vi.mocked(verifyGoogleToken).mockResolvedValue(identity);
});
afterEach(() => vi.unstubAllEnvs());

it('connects Google to the current account without replacing its email, counters, or session', async () => {
    const { user, accessToken } = await existingAccount();
    const counter = await prisma.counter.create({ data: { userId: user.id, title: 'Water' } });
    await prisma.user.update({
        where: { id: user.id },
        data: { appleSubject: 'existing-apple', appleRefreshToken: 'encrypted-token' },
    });
    expect((await methods(accessToken).expect(200)).body.data).toEqual({ google: false, apple: true });
    const result = await connect(accessToken).expect(200);
    expect(result.headers['set-cookie']).toBeUndefined();
    expect(result.body.data).toBeUndefined();
    expect((await methods(accessToken).expect(200)).body.data).toEqual({ google: true, apple: true });
    const checked = await request(app)
        .get('/users/check-auth')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    expect(checked.body.data.user).toMatchObject({ id: user.id, email: user.email, emailVerified: false });
    expect((await google().expect(200)).body.data.user.id).toBe(user.id);
    const counters = await request(app).get('/counters').set('Authorization', `Bearer ${accessToken}`).expect(200);
    expect(counters.body.data.counters.map((item: { id: string }) => item.id)).toEqual([counter.id]);
    expect(await prisma.user.count()).toBe(1);
});

it('does not let two accounts claim the same Google identity or replace a linked identity', async () => {
    const first = await existingAccount();
    const second = await existingAccount('second@example.com');
    const responses = await Promise.all([connect(first.accessToken), connect(second.accessToken)]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    const winner = responses[0].status === 200 ? first : second;
    const other = winner === first ? second : first;
    expect((await methods(winner.accessToken)).body.data.google).toBe(true);
    expect((await methods(other.accessToken)).body.data.google).toBe(false);
    expect((await google().expect(200)).body.data.user.id).toBe(winner.user.id);
    await connect(winner.accessToken).expect(200);
    vi.mocked(verifyGoogleToken).mockResolvedValue({ ...identity, subject: 'replacement' });
    await connect(winner.accessToken).expect(409);
    expect(await prisma.user.findUnique({ where: { id: winner.user.id } })).toMatchObject({
        googleSubject: identity.subject,
    });
});

it('rejects unsigned or unauthenticated connection requests without linking an account', async () => {
    const { user, accessToken } = await existingAccount(identity.email);
    await request(app).get('/users/sign-in-methods').expect(401);
    await request(app).post('/users/google/connect').send({ idToken: 'google-token' }).expect(401);
    await request(app)
        .post('/users/google/connect')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: identity.email })
        .expect(422);
    vi.mocked(verifyGoogleToken).mockRejectedValue(new Error('Invalid token'));
    await connect(accessToken).expect(401);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toMatchObject({
        googleSubject: null,
        emailVerifiedAt: null,
    });
    expect(await prisma.user.count()).toBe(1);
});

it('rejects a connection that finishes verification after logout', async () => {
    const { user, accessToken, refreshToken } = await existingAccount();
    let finish!: (value: typeof identity) => void;
    let started!: () => void;
    const verifying = new Promise<void>((resolve) => {
        started = resolve;
    });
    vi.mocked(verifyGoogleToken).mockImplementation(() => {
        started();
        return new Promise((resolve) => {
            finish = resolve;
        });
    });
    const pending = connect(accessToken).then((response) => response);
    await verifying;
    await request(app).post('/users/logout').send({ refreshToken }).expect(200);
    finish(identity);
    expect((await pending).status).toBe(401);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toMatchObject({ googleSubject: null });
});

it('creates one account across concurrent sign-ins and keeps its identity when the Google email changes', async () => {
    const responses = await Promise.all([google(), google()]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const { user, accessToken, refreshToken } = responses[0]!.body.data;
    expect(responses[1]!.body.data.user.id).toBe(user.id);
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toMatchObject({
        password: null,
        googleSubject: identity.subject,
    });
    expect(user).not.toHaveProperty('googleSubject');
    await request(app).get('/users/check-auth').set('Authorization', `Bearer ${accessToken}`).expect(200);
    const cookies = responses[0]!.headers['set-cookie'] as unknown as string[];
    await request(app)
        .get('/users/check-auth')
        .set('Cookie', cookies.map((cookie) => cookie.split(';')[0]!).join('; '))
        .expect(200);
    await request(app).post('/users/refresh').send({ refreshToken }).expect(200);
    vi.mocked(verifyGoogleToken).mockResolvedValue({ ...identity, email: 'changed@gmail.com' });
    expect((await google().expect(200)).body.data.user.id).toBe(user.id);
});

it('requires the existing password before linking and preserves the original account and counters', async () => {
    const password = 'Existing-password1';
    const existing = await prisma.user.create({
        data: { email: identity.email, password: await bcrypt.hash(password, 10), tier: 'PREMIUM' },
    });
    const counter = await prisma.counter.create({ data: { userId: existing.id, title: 'Water' } });
    const needsPassword = await google().expect(409);
    expect(needsPassword.body.code).toBe('GOOGLE_LINK_REQUIRED');
    expect(needsPassword.headers['set-cookie']).toBeUndefined();
    await google({ password: 'Wrong-password1' }).expect(401);
    expect(await prisma.user.findUnique({ where: { id: existing.id } })).toMatchObject({ googleSubject: null });
    const linked = await google({ password }).expect(200);
    expect(linked.body.data.user).toMatchObject({ id: existing.id, tier: 'PREMIUM', emailVerified: true });
    const counters = await request(app)
        .get('/counters')
        .set('Authorization', `Bearer ${linked.body.data.accessToken}`)
        .expect(200);
    expect(counters.body.data.counters.map((item: { id: string }) => item.id)).toEqual([counter.id]);
    expect((await google().expect(200)).body.data.user.id).toBe(existing.id);
    await request(app).post('/users/login').send({ email: identity.email, password }).expect(200);
});

it('does not overwrite a different linked Google account with the same email', async () => {
    const first = await google().expect(200);
    vi.mocked(verifyGoogleToken).mockResolvedValue({ ...identity, subject: 'different-google-subject' });
    const rejected = await google().expect(409);
    expect(rejected.headers['set-cookie']).toBeUndefined();
    expect(await prisma.user.findUnique({ where: { id: first.body.data.user.id } })).toMatchObject({
        googleSubject: identity.subject,
    });
    expect(await prisma.user.count()).toBe(1);
});

it('rejects invalid or missing tokens without creating users or sessions', async () => {
    vi.mocked(verifyGoogleToken).mockRejectedValue(new Error('Invalid token'));
    const rejected = await google().expect(401);
    expect(rejected.headers['set-cookie']).toBeUndefined();
    await request(app).post('/users/google').send({ email: identity.email }).expect(422);
    await request(app).post('/users/google').type('form').send({ idToken: 'token' }).expect(422);
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.refreshToken.count()).toBe(0);
});

it('does not trust client profile fields and requires email verification for third-party addresses', async () => {
    vi.mocked(verifyGoogleToken).mockResolvedValue({ ...identity, email: 'person@example.com', emailVerified: false });
    const signedIn = await google({ email: 'victim@example.com', tier: 'PREMIUM', emailVerified: true }).expect(200);
    expect(signedIn.body.data.user).toMatchObject({ email: 'person@example.com', tier: 'BASIC', emailVerified: false });
    await request(app)
        .get('/billing/eligibility')
        .set('Authorization', `Bearer ${signedIn.body.data.accessToken}`)
        .expect(403);
    await expect.poll(() => vi.mocked(sendEmailOtp).mock.calls.length).toBe(1);
    expect(
        await prisma.emailOtp.count({ where: { userId: signedIn.body.data.user.id, purpose: 'EMAIL_VERIFICATION' } }),
    ).toBe(1);
});

it('lets a Google-only account set a password through email recovery and revokes its old session', async () => {
    const signedIn = await google().expect(200);
    const { accessToken, refreshToken, user } = signedIn.body.data;
    const password = 'Recovered-password1';
    await request(app).post('/users/login').send({ email: identity.email, password }).expect(401);
    await request(app).post('/users/reset-password/request').send({ email: identity.email }).expect(200);
    await expect.poll(() => vi.mocked(sendEmailOtp).mock.calls.length).toBe(1);
    const code = vi.mocked(sendEmailOtp).mock.calls[0]![1];
    await request(app).post('/users/reset-password').send({ email: identity.email, code, password }).expect(200);
    const recovered = await request(app).post('/users/login').send({ email: identity.email, password }).expect(200);
    expect(recovered.body.data.user.id).toBe(user.id);
    await request(app).get('/users/check-auth').set('Authorization', `Bearer ${accessToken}`).expect(401);
    await request(app).post('/users/refresh').send({ refreshToken }).expect(401);
    expect((await google().expect(200)).body.data.user.id).toBe(user.id);
});

it('removes the Google identity on account deletion so it cannot recover deleted counters', async () => {
    const signedIn = await google().expect(200);
    const { user, accessToken } = signedIn.body.data;
    await prisma.counter.create({ data: { userId: user.id, title: 'Deleted counter' } });
    await request(app).delete('/users').set('Authorization', `Bearer ${accessToken}`).expect(200);
    const next = await google().expect(200);
    expect(next.body.data.user.id).not.toBe(user.id);
    expect(await prisma.counter.count()).toBe(0);
});
