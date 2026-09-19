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

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('GOOGLE_WEB_CLIENT_ID', '123-tally.apps.googleusercontent.com');
    vi.mocked(verifyGoogleToken).mockResolvedValue(identity);
});
afterEach(() => vi.unstubAllEnvs());

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
