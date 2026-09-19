import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { verifyGoogleToken } from '../../src/services/google-auth.service.js';
import type { JWTPayload } from 'jose';

const audience = '123-tally.apps.googleusercontent.com';
let key: Awaited<ReturnType<typeof generateKeyPair>>;
let otherKey: Awaited<ReturnType<typeof generateKeyPair>>;

beforeAll(async () => {
    key = await generateKeyPair('RS256');
    otherKey = await generateKeyPair('RS256');
    const publicKey = { ...(await exportJWK(key.publicKey)), kid: 'google-test-key', alg: 'RS256' };
    vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(JSON.stringify({ keys: [publicKey] }))),
    );
    vi.stubEnv('GOOGLE_WEB_CLIENT_ID', audience);
});

afterAll(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

function token(claims: JWTPayload = {}, signingKey = key.privateKey) {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({
        sub: 'google-subject',
        email: 'Person@gmail.com',
        email_verified: true,
        iss: 'https://accounts.google.com',
        aud: audience,
        iat: now,
        exp: now + 3600,
        ...claims,
    })
        .setProtectedHeader({ alg: 'RS256', kid: 'google-test-key' })
        .sign(signingKey);
}

it.each([
    { email: 'Person@gmail.com', emailVerified: true },
    { email: 'person@company.example', hd: 'company.example', emailVerified: true },
    { email: 'person@example.com', emailVerified: false },
])('only trusts Google-controlled email: $email', async ({ email, hd, emailVerified }) => {
    await expect(verifyGoogleToken(await token({ email, hd }))).resolves.toEqual({
        subject: 'google-subject',
        email: email.toLowerCase(),
        emailVerified,
    });
});

it.each([
    { aud: 'another-client' },
    { iss: 'https://attacker.example' },
    { exp: Math.floor(Date.now() / 1000) - 60 },
    { exp: undefined },
    { iat: Math.floor(Date.now() / 1000) + 300 },
    { sub: '' },
    { email: 'not-an-email' },
    { email_verified: false },
])('rejects invalid Google claims: %j', async (claims) => {
    await expect(verifyGoogleToken(await token(claims))).rejects.toThrow();
});

it('rejects a forged signature even with the expected key ID and claims', async () => {
    await expect(verifyGoogleToken(await token({}, otherKey.privateKey))).rejects.toThrow();
});
